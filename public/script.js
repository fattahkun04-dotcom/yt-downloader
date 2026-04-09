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
const downloadLoading = document.getElementById('downloadLoading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const closeErrorBtn = document.getElementById('closeError');
const urlError = document.getElementById('urlError');

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

// Validate YouTube URL format
function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/;
    return pattern.test(url.trim());
}

// Clean YouTube URL - extract just the video ID
function cleanYouTubeUrl(url) {
    url = url.trim();
    
    // Match various YouTube URL formats and extract video ID
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,  // Standard watch URL
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,     // Embed URL
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,         // Old embed URL
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,    // Shorts URL
        /youtu\.be\/([a-zA-Z0-9_-]{11})/                // Short URL
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return `https://www.youtube.com/watch?v=${match[1]}`;
        }
    }
    
    return url;
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
        downloadBtn.textContent = '⏳ Converting...';
    } else {
        downloadLoading.classList.add('hidden');
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download MP3';
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

// Download audio as MP3
async function downloadAudio() {
    const url = downloadBtn.dataset.url;

    if (!url) {
        showError('No video URL available for download');
        return;
    }

    // Show download loading
    showDownloadLoading(true);
    hideError();

    try {
        // Create download URL
        const downloadUrl = `/api/download?url=${encodeURIComponent(url)}`;
        
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

// Event Listeners
checkInfoBtn.addEventListener('click', fetchVideoInfo);

downloadBtn.addEventListener('click', downloadAudio);

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
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⏳';
    
    entry.innerHTML = `
        <span class="log-icon">${icon}</span>
        <span class="log-text">${message}</span>
    `;
    
    batchLog.appendChild(entry);
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
