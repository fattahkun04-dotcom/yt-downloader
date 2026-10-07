// DOM Elements
const videoUrlInput = document.getElementById('videoUrl');
const checkInfoBtn = document.getElementById('checkInfoBtn');
const loading = document.getElementById('loading');
const videoInfo = document.getElementById('videoInfo');
const videoTitle = document.getElementById('videoTitle');
const videoAuthor = document.getElementById('videoAuthor');
const videoDuration = document.getElementById('videoDuration');
const videoThumbnail = document.getElementById('videoThumbnail');
const downloadBtn = document.getElementById('downloadBtn');
const downloadFormat = document.getElementById('downloadFormat');
const downloadLoading = document.getElementById('downloadLoading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const closeErrorBtn = document.getElementById('closeError');
const urlError = document.getElementById('urlError');
const transcriptBtn = document.getElementById('transcriptBtn'); // Added

// Batch download elements
const batchFileInput = document.getElementById('batchFileInput');
const batchUrlsInput = document.getElementById('batchUrls');
const startBatchBtn = document.getElementById('startBatchBtn');
const batchProgress = document.getElementById('batchProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const batchLog = document.getElementById('batchLog');
const cancelBatchBtn = document.getElementById('cancelBatchBtn');
const uploadArea = document.getElementById('uploadArea');
const playlistUrlInput = document.getElementById('playlistUrl'); // Added
const extractPlaylistBtn = document.getElementById('extractPlaylistBtn'); // Added

// Validate YouTube URL format
function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;

    const match = url.trim().match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return Boolean(match && match[1]);
}

// Clean YouTube URL - extract just the video ID
function cleanYouTubeUrl(url) {
    const trimmedUrl = url.trim();

    const match = trimmedUrl.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (match && match[1]) {
        return `https://www.youtube.com/watch?v=${match[1]}`;
    }

    return trimmedUrl;
}

// Show/hide loading
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
        videoInfo.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Show/hide download loading
function showDownloadLoading(show) {
    if (show) {
        downloadLoading.classList.remove('hidden');
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Converting...';
        if (window.lucide) lucide.createIcons({ root: downloadBtn });
    } else {
        downloadLoading.classList.add('hidden');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i data-lucide="download"></i> Download MP3';
        if (window.lucide) lucide.createIcons({ root: downloadBtn });
    }
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    videoInfo.classList.add('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
    urlError.textContent = '';
}

// Fetch video information from backend
async function fetchVideoInfo() {
    const rawUrl = videoUrlInput.value;
    
    // Clear previous errors
    hideError();
    urlError.textContent = '';

    // Validate URL
    if (!rawUrl.trim()) {
        urlError.textContent = 'Please enter a YouTube URL';
        return;
    }

    if (!isValidYouTubeUrl(rawUrl)) {
        urlError.textContent = 'Invalid YouTube URL. Please enter a valid URL.';
        return;
    }

    // Clean the URL to remove extra parameters
    const url = cleanYouTubeUrl(rawUrl);
    console.log('Cleaned URL:', url);

    // Show loading
    showLoading(true);
    checkInfoBtn.disabled = true;

    try {
        const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video information');
        }

        // Display video information
        videoTitle.textContent = data.title;
        videoAuthor.textContent = data.author;
        videoDuration.textContent = data.duration;
        videoThumbnail.src = data.thumbnail;
        videoThumbnail.alt = data.title;

        // Show video info and hide loading
        showLoading(false);
        videoInfo.classList.remove('hidden');

        // Store cleaned URL for download
        downloadBtn.dataset.url = url;

    } catch (error) {
        console.error('Error fetching video info:', error);
        showLoading(false);
        showError(error.message || 'Failed to fetch video information. Please try again.');
    } finally {
        checkInfoBtn.disabled = false;
    }
}

// Download selected audio or video format
async function downloadSelectedMedia() {
    const url = downloadBtn.dataset.url;
    const format = downloadFormat.value;

    if (!url) {
        showError('No video URL available for download');
        return;
    }

    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(format)}`;

    if (format === 'video') {
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        downloadLink.download = '';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        return;
    }

    // Show download loading
    showDownloadLoading(true);
    hideError();

    try {
        // Fetch the file as a blob
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
            throw new Error(errorData.error || 'Failed to download audio');
        }
        
        // Get the blob
        const blob = await response.blob();
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'audio.mp3';
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }
        
        // Create a download link and trigger it
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Clean up the object URL
        setTimeout(() => {
            URL.revokeObjectURL(downloadLink.href);
        }, 1000);
        
        console.log('✅ Download started:', filename);
        
    } catch (error) {
        console.error('❌ Download error:', error);
        showError(error.message || 'Failed to download audio. Please try again.');
    } finally {
        showDownloadLoading(false);
    }
}

// Download Transcript
async function downloadTranscript() {
    const url = downloadBtn.dataset.url;
    if (!url) {
        showError('No video URL available');
        return;
    }

    transcriptBtn.disabled = true;
    const originalHtml = transcriptBtn.innerHTML;
    transcriptBtn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Fetching...';
    if (window.lucide) lucide.createIcons({ root: transcriptBtn });
    hideError();

    try {
        const downloadUrl = `/api/transcript?url=${encodeURIComponent(url)}`;
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Transcript failed' }));
            throw new Error(errorData.error || 'Failed to fetch transcript (may not exist)');
        }
        
        const blob = await response.blob();
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'transcript.srt';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        setTimeout(() => URL.revokeObjectURL(downloadLink.href), 1000);
        
    } catch (error) {
        console.error('❌ Transcript error:', error);
        showError(error.message);
    } finally {
        transcriptBtn.disabled = false;
        transcriptBtn.innerHTML = originalHtml;
        if (window.lucide) lucide.createIcons({ root: transcriptBtn });
    }
}

// Event Listeners
checkInfoBtn.addEventListener('click', fetchVideoInfo);

downloadBtn.addEventListener('click', downloadSelectedMedia);
if(transcriptBtn) transcriptBtn.addEventListener('click', downloadTranscript);

downloadFormat.addEventListener('change', () => {
    downloadBtn.innerHTML = downloadFormat.value === 'video'
        ? '<i data-lucide="download"></i> Download MP4'
        : '<i data-lucide="download"></i> Download MP3';
    if (window.lucide) lucide.createIcons({ root: downloadBtn });
});

closeErrorBtn.addEventListener('click', hideError);

// Allow Enter key to trigger fetch
videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchVideoInfo();
    }
});

// Clear error when user starts typing
videoUrlInput.addEventListener('input', () => {
    if (urlError.textContent) {
        urlError.textContent = '';
    }
});

// ==================== BATCH DOWNLOAD FUNCTIONS ====================

// Tab switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');
    });
});

// Extract URLs from text
function extractUrls(text) {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlPattern) || [];
    return matches.filter(url => isValidYouTubeUrl(url));
}

// Add log entry
function addLogEntry(message, type = 'processing') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    let iconName = 'loader';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'x-circle';
    
    entry.innerHTML = `
        <i data-lucide="${iconName}" class="log-icon"></i>
        <span class="log-text">${message}</span>
    `;
    
    batchLog.appendChild(entry);
    // Re-initialize icons for the new elements
    if (window.lucide) {
        lucide.createIcons({
            root: entry
        });
    }
    batchLog.scrollTop = batchLog.scrollHeight;
}

// Update progress
function updateProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${current} / ${total} completed`;
    progressPercent.textContent = `${percent}%`;
}

// Reset batch UI
function resetBatchUI() {
    batchProgress.classList.add('hidden');
    batchLog.innerHTML = '';
    updateProgress(0, 1);
}

// Handle batch download with polling
let batchCancelled = false;
let currentJobId = null;
let pollInterval = null;

async function startBatchDownload() {
    let urls = [];
    
    if (batchUrlsInput.value.trim()) {
        urls = extractUrls(batchUrlsInput.value);
    }
    
    if (urls.length === 0) {
        alert('Please provide at least one valid YouTube URL');
        return;
    }
    
    urls = [...new Set(urls)];
    
    console.log(`Starting batch download for ${urls.length} URLs`);
    
    batchProgress.classList.remove('hidden');
    startBatchBtn.disabled = true;
    cancelBatchBtn.disabled = false;
    batchCancelled = false;
    batchLog.innerHTML = '';
    
    addLogEntry(`Starting batch download: ${urls.length} URLs`, 'processing');
    updateProgress(0, urls.length);
    
    try {
        // Start the job
        const response = await fetch('/api/batch-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to start batch download');
        }
        
        const data = await response.json();
        currentJobId = data.jobId;
        
        addLogEntry(`Job started: ${currentJobId}`, 'processing');
        
        // Start polling for status
        pollInterval = setInterval(() => pollJobStatus(currentJobId), 1000);
        
    } catch (error) {
        console.error('Batch download error:', error);
        addLogEntry(`Error: ${error.message}`, 'error');
        startBatchBtn.disabled = false;
        cancelBatchBtn.disabled = true;
    }
}

async function pollJobStatus(jobId) {
    try {
        const response = await fetch(`/api/batch-status/${jobId}`);

        if (!response.ok) {
            clearInterval(pollInterval);
            throw new Error('Job not found');
        }

        const job = await response.json();

        // Update progress
        updateProgress(job.current, job.total);

        // Show queue status if available
        if (job.totalBatches && job.currentBatch) {
            const queueInfo = document.getElementById('queueInfo');
            if (!queueInfo) {
                const infoDiv = document.createElement('div');
                infoDiv.id = 'queueInfo';
                infoDiv.style.cssText = 'background: #2d3748; padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 14px; color: #90cdf4;';
                progressText.parentNode.insertBefore(infoDiv, progressText.nextSibling);
            }
            document.getElementById('queueInfo').textContent = 
                `🔄 Queue ${job.currentBatch}/${job.totalBatches} (${job.batchSize} URLs per queue)`;
        }

        // Show new logs
        const currentLogCount = batchLog.children.length;
        if (job.logs.length > currentLogCount) {
            const newLogs = job.logs.slice(currentLogCount);
            for (const log of newLogs) {
                addLogEntry(log.message, log.type);
            }
        }

        // Check if completed or errored
        if (job.status === 'completed') {
            clearInterval(pollInterval);
            
            // Remove queue info
            const queueInfo = document.getElementById('queueInfo');
            if (queueInfo) queueInfo.remove();
            
            addLogEntry('✅ Download ready! Starting ZIP download...', 'success');

            // Download the ZIP
            setTimeout(() => downloadBatchZip(jobId), 1000);
        } else if (job.status === 'error') {
            clearInterval(pollInterval);
            
            const queueInfo = document.getElementById('queueInfo');
            if (queueInfo) queueInfo.remove();
            
            addLogEntry('❌ Batch download failed', 'error');
            startBatchBtn.disabled = false;
            cancelBatchBtn.disabled = true;
        } else if (job.status === 'cancelled') {
            clearInterval(pollInterval);
            
            const queueInfo = document.getElementById('queueInfo');
            if (queueInfo) queueInfo.remove();
            
            startBatchBtn.disabled = false;
            cancelBatchBtn.disabled = true;
        }

    } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
    }
}

async function downloadBatchZip(jobId) {
    try {
        const response = await fetch(`/api/batch-download/${jobId}/download`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to download ZIP');
        }
        
        const blob = await response.blob();
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'youtube_audio_batch.zip';
        
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/i);
            if (filenameMatch && filenameMatch[1]) {
                filename = decodeURIComponent(filenameMatch[1]);
            }
        }
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = filename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        setTimeout(() => {
            URL.revokeObjectURL(downloadLink.href);
        }, 1000);
        
        addLogEntry(`✅ Downloaded: ${filename}`, 'success');
        
    } catch (error) {
        console.error('ZIP download error:', error);
        addLogEntry(`❌ Download error: ${error.message}`, 'error');
    } finally {
        startBatchBtn.disabled = false;
        cancelBatchBtn.disabled = true;
        currentJobId = null;
    }
}

// Handle file upload
function handleFileUpload(file) {
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const content = e.target.result;
        batchUrlsInput.value = content;
        addLogEntry(`File loaded: ${file.name}`, 'success');
    };
    
    reader.onerror = () => {
        addLogEntry('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// File input change event
batchFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
});

// Drag and drop events
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv') || file.name.endsWith('.list'))) {
        handleFileUpload(file);
    } else {
        addLogEntry('Please upload a .txt, .csv, or .list file', 'error');
    }
});

// Start batch button
startBatchBtn.addEventListener('click', startBatchDownload);

// Cancel batch button
cancelBatchBtn.addEventListener('click', async () => {
    if (currentJobId) {
        try {
            await fetch(`/api/batch-cancel/${currentJobId}`, { method: 'POST' });
            addLogEntry('️ Job cancellation requested', 'error');
        } catch (error) {
            console.error('Cancel error:', error);
        }
    } else {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        addLogEntry('Cancelled by user', 'error');
        startBatchBtn.disabled = false;
        cancelBatchBtn.disabled = true;
    }
});

// Extract Playlist
if (extractPlaylistBtn) {
    extractPlaylistBtn.addEventListener('click', async () => {
        const url = playlistUrlInput.value.trim();
        if (!url) {
            alert('Please enter a playlist URL');
            return;
        }

        extractPlaylistBtn.disabled = true;
        const originalHtml = extractPlaylistBtn.innerHTML;
        extractPlaylistBtn.innerHTML = '<i data-lucide="loader" class="spin-icon"></i> Extracting...';
        if (window.lucide) lucide.createIcons({ root: extractPlaylistBtn });

        try {
            const response = await fetch(`/api/playlist?url=${encodeURIComponent(url)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract playlist');
            }

            if (data.urls && data.urls.length > 0) {
                const currentUrls = batchUrlsInput.value ? batchUrlsInput.value + '\n' : '';
                batchUrlsInput.value = currentUrls + data.urls.join('\n');
                playlistUrlInput.value = '';
                
                // Show temporary success feedback
                extractPlaylistBtn.innerHTML = '<i data-lucide="check"></i> Added ' + data.urls.length + ' URLs!';
                extractPlaylistBtn.classList.add('btn-success');
                extractPlaylistBtn.classList.remove('btn-outline');
                if (window.lucide) lucide.createIcons({ root: extractPlaylistBtn });
                
                setTimeout(() => {
                    extractPlaylistBtn.innerHTML = originalHtml;
                    extractPlaylistBtn.classList.remove('btn-success');
                    extractPlaylistBtn.classList.add('btn-outline');
                    extractPlaylistBtn.disabled = false;
                    if (window.lucide) lucide.createIcons({ root: extractPlaylistBtn });
                }, 3000);
                return;
            } else {
                throw new Error('No valid URLs found in playlist');
            }

        } catch (error) {
            console.error('Playlist extraction error:', error);
            alert(error.message);
        }

        extractPlaylistBtn.disabled = false;
        extractPlaylistBtn.innerHTML = originalHtml;
        if (window.lucide) lucide.createIcons({ root: extractPlaylistBtn });
    });
}
