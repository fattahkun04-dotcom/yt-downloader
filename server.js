const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Find yt-dlp executable
function getYtDlpPath() {
  const { execSync } = require('child_process');
  
  const candidates = [
    'yt-dlp',
    'yt-dlp.exe',
    path.join(process.env.APPDATA || '', 'Python', 'Python314', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    path.join(process.env.APPDATA || '', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
  ];
  
  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, { stdio: 'ignore', timeout: 5000 });
      console.log('✅ Found yt-dlp at:', candidate);
      return candidate;
    } catch (e) {
      continue;
    }
  }
  
  return 'yt-dlp';
}

const YTDLP_PATH = getYtDlpPath();

// Store for batch progress tracking
const batchJobs = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Validate YouTube URL
function isValidUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
  return pattern.test(url);
}

// Format duration from seconds to HH:MM:SS or MM:SS
function formatDuration(seconds) {
  const secs = parseInt(seconds);
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remainingSecs = secs % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 200);
}

// Helper function to run yt-dlp
function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    // Add JavaScript runtime flag - using node (Node.js)
    // Add cookies from Firefox browser to avoid bot detection
    const finalArgs = [
      '--js-runtimes', 'node',
      '--cookies-from-browser', 'firefox',
      ...args
    ];
    console.log('🔧 Running:', YTDLP_PATH, finalArgs.join(' '));

    const ytDlp = spawn(YTDLP_PATH, finalArgs, {
      windowsHide: true,
      timeout: 120000, // 2 minute timeout
      env: { ...process.env } // Ensure environment variables are passed
    });
    
    let stdout = '';
    let stderr = '';
    
    ytDlp.stdout.on('data', (data) => {
      const msg = data.toString();
      stdout += msg;
    });
    
    ytDlp.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      // Log progress and warnings
      if (msg.includes('ERROR')) {
        console.error('❌ yt-dlp ERROR:', msg.trim());
      } else if (msg.includes('WARNING')) {
        console.log('⚠️ yt-dlp:', msg.trim());
      } else if (msg.includes('%') && !stderr.includes(msg.trim())) {
        // Progress indicator
        const progress = msg.match(/(\d+\.?\d*)%/);
        if (progress) {
          process.stdout.write(`\r   Progress: ${progress[1]}%`);
        }
      }
    });
    
    ytDlp.on('error', (err) => {
      console.error('❌ Failed to spawn yt-dlp:', err.message);
      reject(new Error(`Failed to start yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
    });
    
    ytDlp.on('close', (code) => {
      process.stdout.write('\n'); // New line after progress
      if (code === 0) {
        resolve(stdout);
      } else {
        const errorMsg = stderr || `yt-dlp exited with code ${code}`;
        console.error('❌ yt-dlp failed with code:', code);
        reject(new Error(errorMsg));
      }
    });
    
    ytDlp.on('timeout', () => {
      ytDlp.kill();
      reject(new Error('yt-dlp timed out after 120 seconds'));
    });
  });
}

// GET /api/info - Get video information using yt-dlp
app.get('/api/info', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    console.log('📥 Fetching info for:', url);
    
    // Use yt-dlp to get video info as JSON
    const args = [
      '--dump-json',
      '--no-playlist',
      url
    ];
    
    const output = await runYtDlp(args);
    const info = JSON.parse(output);
    
    console.log('✅ Successfully fetched:', info.title);

    const videoDetails = {
      title: info.title || 'Unknown Title',
      duration: formatDuration(info.duration || 0),
      thumbnail: info.thumbnail || '',
      author: info.uploader || info.channel || 'Unknown'
    };

    res.json(videoDetails);
  } catch (error) {
    console.error('❌ Error fetching video info:');
    console.error('  Message:', error.message);
    
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('private') || errorMsg.includes('unavailable')) {
      return res.status(404).json({ error: 'Video is unavailable or private' });
    }

    if (errorMsg.includes('age') || errorMsg.includes('sign in')) {
      return res.status(403).json({ error: 'Age-restricted video. This feature is not supported.' });
    }
    
    if (errorMsg.includes('timeout')) {
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    
    if (errorMsg.includes('yt-dlp') && errorMsg.includes('not found')) {
      return res.status(500).json({ error: 'yt-dlp is not installed. Please install yt-dlp first.' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch video information. Please check the URL and try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/download - Download audio as MP3 stream using yt-dlp
app.get('/api/download', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  try {
    console.log('🎵 Starting download for:', url);
    
    // First, get video info for filename
    const infoArgs = ['--dump-json', '--no-playlist', url];
    const infoOutput = await runYtDlp(infoArgs);
    const info = JSON.parse(infoOutput);
    
    const title = sanitizeFilename(info.title || 'audio');
    const filename = `${title}.mp3`;

    console.log('📄 Filename:', filename);

    // Set response headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Use yt-dlp to download and convert to MP3, streaming to stdout
    const downloadArgs = [
      '--format', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--output', '-',
      '--no-playlist',
      url
    ];

    const ytDlp = spawn('yt-dlp', downloadArgs, {
      windowsHide: true,
      timeout: 300000 // 5 minutes timeout for download
    });

    // Pipe stdout directly to response
    ytDlp.stdout.pipe(res, { end: true });

    let errorMsg = '';
    ytDlp.stderr.on('data', (data) => {
      errorMsg += data.toString();
      // Log progress (yt-dlp sends progress to stderr)
      const line = data.toString().trim();
      if (line && !line.includes('ETA') && !line.includes('%')) {
        console.log('  Progress:', line);
      }
    });

    ytDlp.on('error', (err) => {
      console.error('❌ yt-dlp process error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start download process' });
      }
    });

    ytDlp.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ yt-dlp exited with code ${code}`);
        console.error('Error details:', errorMsg);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed. The video might be unavailable.' });
        }
      } else {
        console.log('✅ Download completed successfully');
      }
    });

    ytDlp.on('timeout', () => {
      ytDlp.kill();
      console.error('❌ Download timed out');
      if (!res.headersSent) {
        res.status(504).json({ error: 'Download timed out. The video might be too long.' });
      }
    });

  } catch (error) {
    console.error('❌ Download error:', error.message);
    
    if (!res.headersSent) {
      if (error.message.includes('yt-dlp') && error.message.includes('not found')) {
        return res.status(500).json({ error: 'yt-dlp is not installed. Please install yt-dlp first.' });
      }
      res.status(500).json({ error: 'Failed to download audio. Please try again.' });
    }
  }
});

// GET /api/batch-status/:jobId - Get batch job progress
app.get('/api/batch-status/:jobId', (req, res) => {
  const job = batchJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// POST /api/batch-download - Start batch download job with auto-queueing
app.post('/api/batch-download', async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  const validUrls = urls.filter(url => isValidUrl(url));

  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid YouTube URLs provided' });
  }

  // No limit on URLs - auto-queueing handles large batches
  const batchSize = 10; // Process 10 URLs at a time
  const totalBatches = Math.ceil(validUrls.length / batchSize);

  const jobId = Date.now().toString();
  console.log(`📦 Batch job ${jobId}: ${validUrls.length} URLs in ${totalBatches} queues`);

  // Create job entry
  const job = {
    jobId,
    status: 'queued',
    total: validUrls.length,
    current: 0,
    success: 0,
    errors: 0,
    batchSize,
    totalBatches,
    currentBatch: 0,
    logs: [
      { type: 'processing', message: `📥 Total URLs: ${validUrls.length}` },
      { type: 'processing', message: `🔄 Auto-queue: ${totalBatches} group(s) of ${batchSize} URLs` },
      { type: 'processing', message: `⏳ Processing will start automatically...` }
    ],
    urls: validUrls,
    tempDir: path.join(__dirname, 'temp', jobId),
    downloadedFiles: []
  };

  batchJobs.set(jobId, job);
  fs.mkdirSync(job.tempDir, { recursive: true });

  res.json({ jobId, status: 'started', totalUrls: validUrls.length, totalBatches });

  // Process in background with auto-queueing
  processBatchJobWithQueue(jobId).catch(err => {
    console.error('❌ Batch job error:', err.message);
    job.status = 'error';
    job.logs.push({ type: 'error', message: `Error: ${err.message}` });
  });
});

// POST /api/batch-download/:jobId/download - Download ZIP when ready
app.get('/api/batch-download/:jobId/download', async (req, res) => {
  const job = batchJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Batch job not completed yet' });
  }

  if (!job.zipPath || !fs.existsSync(job.zipPath)) {
    return res.status(404).json({ error: 'ZIP file not found' });
  }

  console.log('📤 Sending ZIP file to client');
  
  res.download(job.zipPath, `youtube_audio_batch_${job.jobId}.zip`, (err) => {
    if (err) {
      console.error('❌ Error sending file:', err.message);
    }
    // Clean up after download
    setTimeout(() => {
      if (fs.existsSync(job.tempDir)) {
        fs.rm(job.tempDir, { recursive: true, force: true }, (cleanupErr) => {
          if (cleanupErr) console.error('Error cleaning up:', cleanupErr.message);
          else console.log('🧹 Cleaned up job', job.jobId);
        });
      }
      batchJobs.delete(job.jobId);
    }, 2000);
  });
});

// Async batch processing function with auto-queueing
async function processBatchJobWithQueue(jobId) {
  const job = batchJobs.get(jobId);
  if (!job) return;

  try {
    const { urls, tempDir, batchSize } = job;

    console.log(`\n📦 Processing batch job: ${jobId}`);
    console.log(`📁 Temp directory: ${tempDir}`);
    console.log(`🔗 Total URLs: ${urls.length}`);
    console.log(`🔄 Queue size: ${batchSize} URLs per group\n`);

    // Process URLs in batches (auto-queueing)
    for (let batchIndex = 0; batchIndex < urls.length; batchIndex += batchSize) {
      job.currentBatch = Math.floor(batchIndex / batchSize) + 1;
      
      const batchUrls = urls.slice(batchIndex, batchIndex + batchSize);
      const batchLabel = `Queue ${job.currentBatch}/${job.totalBatches}`;
      
      job.logs.push({ 
        type: 'processing', 
        message: `🔄 ${batchLabel}: Processing ${batchUrls.length} URLs` 
      });
      console.log(`\n📦 ${batchLabel}:`);

      // Process each URL in this batch
      for (let i = 0; i < batchUrls.length; i++) {
        if (job.status === 'cancelled') {
          job.logs.push({ type: 'error', message: '⚠️ Job cancelled by user' });
          return;
        }

        const url = batchUrls[i];
        const globalIndex = batchIndex + i;
        job.current = globalIndex + 1;
        
        job.logs.push({ 
          type: 'processing', 
          message: `📥 ${globalIndex + 1}/${urls.length}: ${url.substring(0, 50)}...` 
        });
        console.log(`  🎵 ${globalIndex + 1}/${urls.length}`);

        try {
          // Get video info
          const info = await getVideoInfoAsync(url);
          const title = sanitizeFilename(info.title || `audio_${globalIndex + 1}`);
          const filename = `${String(globalIndex + 1).padStart(3, '0')}_${title}.mp3`;
          const filepath = path.join(tempDir, filename);

          // Download audio
          await downloadAudioAsync(url, filepath);

          if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
            job.downloadedFiles.push({ path: filepath, name: filename });
            job.success++;
            const fileSizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
            job.logs.push({ 
              type: 'success', 
              message: `✅ ${filename} (${fileSizeMB} MB)` 
            });
            console.log(`    ✅ Success: ${fileSizeMB} MB`);
          } else {
            job.errors++;
            job.logs.push({ 
              type: 'error', 
              message: `❌ File empty or not created` 
            });
            console.error(`    ❌ Error: File empty`);
          }
        } catch (error) {
          job.errors++;
          const errMsg = error.message.substring(0, 100);
          job.logs.push({ 
            type: 'error', 
            message: `❌ Error: ${errMsg}` 
          });
          console.error(`    ❌ Error:`, errMsg);
        }
      }

      // Small delay between batches to avoid overwhelming
      if (batchIndex + batchSize < urls.length) {
        job.logs.push({ 
          type: 'processing', 
          message: `⏳ Waiting 2s before next queue...` 
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Create ZIP with all downloaded files
    if (job.downloadedFiles.length > 0) {
      job.logs.push({ type: 'processing', message: '📦 Creating ZIP file...' });
      job.zipPath = path.join(tempDir, 'batch.zip');

      console.log(`\n📦 Creating ZIP: ${job.zipPath}`);
      console.log(`📁 Files to include: ${job.downloadedFiles.length}\n`);

      await createZipFile(job.downloadedFiles, job.zipPath);

      const zipSizeMB = (fs.statSync(job.zipPath).size / 1024 / 1024).toFixed(2);
      job.status = 'completed';
      job.logs.push({ 
        type: 'success', 
        message: `✅ Complete! ${job.success}/${urls.length} files (${zipSizeMB} MB)` 
      });
      console.log(`✅ Job ${jobId} completed: ${zipSizeMB} MB ZIP\n`);
    } else {
      job.status = 'error';
      job.logs.push({ type: 'error', message: '❌ No files downloaded successfully' });
      console.error(`❌ Job ${jobId} failed: No files downloaded\n`);
    }

  } catch (error) {
    job.status = 'error';
    job.logs.push({ type: 'error', message: `❌ Fatal error: ${error.message}` });
    console.error(`❌ Job ${jobId} fatal error:`, error.message, '\n');
  }
}

// Legacy batch processing function (for backward compatibility)
async function processBatchJob(jobId) {
  const job = batchJobs.get(jobId);
  if (!job) return;

  try {
    const { urls, tempDir } = job;

    console.log(`\n📦 Processing batch job: ${jobId}`);
    console.log(`📁 Temp directory: ${tempDir}`);
    console.log(`🔗 Total URLs: ${urls.length}\n`);

    for (let i = 0; i < urls.length; i++) {
      if (job.status === 'cancelled') {
        job.logs.push({ type: 'error', message: 'Job cancelled by user' });
        return;
      }

      const url = urls[i];
      job.current = i + 1;
      job.logs.push({ type: 'processing', message: `Downloading ${i + 1}/${urls.length}: ${url}` });
      console.log(`🎵 [${jobId}] ${i + 1}/${urls.length}:`, url);

      try {
        // Get video info
        const info = await getVideoInfoAsync(url);
        const title = sanitizeFilename(info.title || `audio_${i + 1}`);
        const filename = `${String(i + 1).padStart(3, '0')}_${title}.mp3`;
        const filepath = path.join(tempDir, filename);

        console.log(`📄 File: ${filename}`);
        console.log(`📍 Full path: ${filepath}`);

        job.logs.push({ type: 'processing', message: `Converting: ${filename}` });

        // Download audio
        await downloadAudioAsync(url, filepath);

        if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
          job.downloadedFiles.push({ path: filepath, name: filename });
          job.success++;
          const fileSizeMB = (fs.statSync(filepath).size / 1024 / 1024).toFixed(2);
          job.logs.push({ type: 'success', message: `✅ ${filename} (${fileSizeMB} MB)` });
          console.log(`  ✅ Success: ${filename} (${fileSizeMB} MB)\n`);
        } else {
          job.errors++;
          job.logs.push({ type: 'error', message: `❌ Failed: File empty or not created` });
          console.error(`  ❌ Error: File not found or empty\n`);
        }
      } catch (error) {
        job.errors++;
        const errMsg = error.message.substring(0, 150);
        job.logs.push({ type: 'error', message: `❌ Error: ${errMsg}` });
        console.error(`  ❌ Error:`, errMsg, '\n');
      }
    }

    // Create ZIP
    if (job.downloadedFiles.length > 0) {
      job.logs.push({ type: 'processing', message: 'Creating ZIP file...' });
      job.zipPath = path.join(tempDir, 'batch.zip');

      console.log(`📦 Creating ZIP: ${job.zipPath}`);
      console.log(`📁 Files to include: ${job.downloadedFiles.length}\n`);

      await createZipFile(job.downloadedFiles, job.zipPath);

      const zipSizeMB = (fs.statSync(job.zipPath).size / 1024 / 1024).toFixed(2);
      job.status = 'completed';
      job.logs.push({ type: 'success', message: `✅ Batch complete! ${job.success} files ready (${zipSizeMB} MB)` });
      console.log(`✅ Job ${jobId} completed: ${zipSizeMB} MB ZIP\n`);
    } else {
      job.status = 'error';
      job.logs.push({ type: 'error', message: '❌ No files were downloaded successfully' });
      console.error(`❌ Job ${jobId} failed: No files downloaded\n`);
    }

  } catch (error) {
    job.status = 'error';
    job.logs.push({ type: 'error', message: `❌ Fatal error: ${error.message}` });
    console.error(`❌ Job ${jobId} fatal error:`, error.message, '\n');
  }
}

// Helper: Get video info async
function getVideoInfoAsync(url) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, [
      '--js-runtimes', 'node',
      '--cookies-from-browser', 'firefox',
      '--dump-json',
      '--no-playlist',
      url
    ], {
      windowsHide: true,
      timeout: 120000
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => stdout += data.toString());
    proc.stderr.on('data', data => stderr += data.toString());

    proc.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error('Failed to parse video info'));
        }
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });

    proc.on('error', err => reject(err));
  });
}

// Helper: Download audio async
function downloadAudioAsync(url, outputPath) {
  return new Promise((resolve, reject) => {
    const tempDir = path.dirname(outputPath);
    const expectedFilename = path.basename(outputPath);

    console.log(`  📥 Downloading to: ${tempDir}`);
    console.log(`  📝 Expected filename: ${expectedFilename}`);

    // Use exact filename with --output flag
    const proc = spawn(YTDLP_PATH, [
      '--js-runtimes', 'node',
      '--cookies-from-browser', 'firefox',
      '--format', 'bestaudio',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--output', path.join(tempDir, expectedFilename),
      '--no-playlist',
      url
    ], {
      windowsHide: true,
      timeout: 300000,
      cwd: tempDir
    });

    let stderr = '';
    let stdout = '';

    proc.stderr.on('data', data => {
      const msg = data.toString();
      stderr += msg;
      
      // Log important messages
      if (msg.includes('ERROR') || msg.includes('ffmpeg')) {
        console.log('  📺 yt-dlp output:', msg.trim());
      }
      
      const progress = msg.match(/(\d+\.?\d*)%/);
      if (progress) {
        process.stdout.write(`\r   Progress: ${progress[1]}%`);
      }
    });

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.on('close', code => {
      process.stdout.write('\n');

      if (code === 0) {
        // Check if the expected file exists
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          console.log(`  ✅ Downloaded: ${expectedFilename} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
          resolve();
        } else {
          // Try to find any MP3 file that might have been created with different name
          try {
            const files = fs.readdirSync(tempDir);
            const mp3Files = files.filter(f => f.endsWith('.mp3') && f !== 'batch.zip');
            
            if (mp3Files.length > 0) {
              // Find the most recently created MP3 file
              const mp3File = mp3Files[mp3Files.length - 1];
              const downloadedPath = path.join(tempDir, mp3File);
              
              // Rename to expected filename
              fs.renameSync(downloadedPath, outputPath);
              console.log(`  📝 Renamed: ${mp3File} -> ${expectedFilename}`);
              resolve();
            } else {
              reject(new Error(`No MP3 file found in ${tempDir}`));
            }
          } catch (e) {
            reject(new Error(`Failed to locate downloaded file: ${e.message}`));
          }
        }
      } else {
        // Log full error for debugging
        console.error(`  ❌ yt-dlp exited with code ${code}`);
        console.error(`  ❌ stderr (last 500 chars):`, stderr.slice(-500));
        reject(new Error(stderr.slice(-300) || `Download failed with code ${code}`));
      }
    });

    proc.on('error', err => reject(err));
  });
}

// Helper: Create ZIP file
function createZipFile(files, outputPath) {
  return new Promise((resolve, reject) => {
    const zipOutput = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    zipOutput.on('close', () => resolve());
    archive.on('error', reject);

    archive.pipe(zipOutput);

    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    archive.finalize();
  });
}

// POST /api/batch-cancel/:jobId - Cancel batch job
app.post('/api/batch-cancel/:jobId', (req, res) => {
  const job = batchJobs.get(req.params.jobId);
  if (job) {
    job.status = 'cancelled';
    job.logs.push({ type: 'error', message: 'Job cancelled by user' });
    res.json({ status: 'cancelled' });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('\n🎵 YouTube Audio Downloader');
  console.log('🌐 Server running at http://localhost:' + PORT);
  console.log('✅ Using yt-dlp for reliable downloads\n');
});

module.exports = app;
