# YouTube Audio Downloader

A simple web application to download YouTube videos as MP3 audio files.

## Features

- ✅ Fetch video information (title, duration, author, thumbnail)
- ✅ Download audio directly as MP3 format
- ✅ No server-side file storage (direct streaming)
- ✅ Modern, responsive dark theme UI
- ✅ Error handling for common issues

## Prerequisites

- **Node.js** (v14 or higher)
- **FFmpeg** (must be installed globally)

### Installing FFmpeg

**Windows:**
1. Download from: https://www.gyan.dev/ffmpeg/builds/
2. Extract the archive
3. Add the `bin` folder to your system PATH
4. Verify installation: `ffmpeg -version`

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Server:**
   ```bash
   npm start
   ```
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. **Open the Application:**
   Navigate to: http://localhost:3000

## Usage

1. Copy a YouTube video URL (e.g., `https://www.youtube.com/watch?v=...`)
2. Paste it into the input field
3. Click "Check Info" to preview the video
4. Click "Download MP3" to download the audio

## Project Structure

```
youtube-audio-downloader/
├── public/
│   ├── index.html      # Main HTML file
│   ├── style.css       # Styling
│   └── script.js       # Frontend logic
├── server.js           # Express backend
├── package.json        # Dependencies
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## API Endpoints

### GET /api/info
Get video information without downloading.

**Parameters:**
- `url` - YouTube video URL

**Response:**
```json
{
  "title": "Video Title",
  "duration": "3:45",
  "author": "Channel Name",
  "thumbnail": "https://..."
}
```

### GET /api/download
Download video audio as MP3 stream.

**Parameters:**
- `url` - YouTube video URL

**Response:**
- Audio file stream (MP3 format)

## Testing Checklist

- [ ] Server starts without errors (`node server.js`)
- [ ] Application loads at http://localhost:3000
- [ ] Valid YouTube URL shows video information
- [ ] Video title, duration, and author display correctly
- [ ] "Download MP3" button appears after fetching info
- [ ] Download starts with correct filename
- [ ] Invalid URL shows proper error message
- [ ] Unavailable/private video shows error
- [ ] UI is responsive on mobile devices

## Troubleshooting

### Error: "FFmpeg not found"
- Ensure FFmpeg is installed and available in your system PATH
- Run `ffmpeg -version` to verify
- On Windows, restart your terminal/IDE after adding FFmpeg to PATH

### Error: "Failed to fetch video information"
- Check that the YouTube URL is valid
- The video might be private, deleted, or region-restricted
- Some age-restricted videos require authentication (not supported)

### Error: "Video unavailable"
- The video may have been made private or deleted
- Try with a different public video
- Some videos have geographic restrictions

### Error: "Sign in to confirm your age"
- Age-restricted videos require YouTube authentication
- This feature is not supported in this basic version
- Use a different video without age restrictions

### Download fails or hangs
- Check your internet connection
- The video might be very long (conversion takes time)
- Ensure FFmpeg is properly installed
- Check server console for detailed error messages

### ytdl-core errors
YouTube frequently updates their API which can break ytdl-core. If you encounter issues:
1. Update ytdl-core: `npm update ytdl-core`
2. Check for issues at: https://github.com/fent/node-ytdl-core
3. Consider using alternative libraries if the issue persists

## Deployment

### Deploy to Railway

1. Create a `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

2. Push your code to GitHub
3. Connect repository to Railway
4. Add FFmpeg in Railway settings (it's included by default in Nixpacks)

### Deploy to Render

Create `render.yaml`:
```yaml
services:
  - type: web
    name: youtube-audio-downloader
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t yt-audio-downloader .
docker run -p 3000:3000 yt-audio-downloader
```

## Important Notes

⚠️ **Legal Disclaimer:** This tool is for personal use only. Respect copyright laws and YouTube's Terms of Service. Only download content you have permission to use.

⚠️ **YouTube API Changes:** YouTube frequently updates their platform, which may break this application. Regular maintenance and library updates may be required.

⚠️ **Production Use:** For production deployment, consider adding rate limiting, input sanitization, and proper authentication mechanisms.

## License

MIT License - Feel free to use and modify for personal projects.

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Ensure all dependencies are installed
3. Verify FFmpeg is accessible in your PATH
4. Check the server console for detailed error messages
