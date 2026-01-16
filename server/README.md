# Backend Server Deployment

This server proxies OpenAI and ElevenLabs API requests to avoid CORS issues when running the game from a browser.

## Local Development

```bash
cd server
npm install
npm run dev
```

Server runs on `http://localhost:3001`

## Docker Deployment (Synology)

### 1. Build the image

```bash
cd server
docker build -t galactic-command-server .
```

### 2. Run with Docker

```bash
docker run -d \
  --name galactic-server \
  -p 3001:3001 \
  --restart unless-stopped \
  galactic-command-server
```

### 3. On Synology Container Manager

1. Upload the `server` folder to your Synology
2. In **Container Manager** → **Project** → **Create**
3. Set the path to the `server` folder
4. Or import the Dockerfile directly

### 4. Configure Frontend

Update your `.env` file before building the frontend:

```bash
VITE_OPENAI_PROXY_URL=https://your-server-domain:3001/api/openai/chat/completions
```

Then rebuild:

```bash
npm run build
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /api/openai/chat/completions` | Proxy to OpenAI |
| `POST /api/elevenlabs/tts/:voiceId` | Proxy to ElevenLabs |
