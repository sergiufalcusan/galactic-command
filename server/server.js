/**
 * Galactic Command - Backend Proxy Server
 * Proxies OpenAI API requests to avoid CORS issues
 * API keys are stored securely on the server via environment variables
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// API Keys from environment variables (SECURE - not exposed to frontend)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Validate required API keys on startup
if (!OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set - OpenAI endpoints will fail');
}
if (!ELEVENLABS_API_KEY) {
    console.warn('⚠️  ELEVENLABS_API_KEY not set - ElevenLabs endpoints will fail');
}

// CORS - allow requests from your frontend
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://galactic.falcusan.ro'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        openai: OPENAI_API_KEY ? 'configured' : 'missing',
        elevenlabs: ELEVENLABS_API_KEY ? 'configured' : 'missing'
    });
});

// OpenAI Chat Completions Proxy
app.post('/api/openai/chat/completions', async (req, res) => {
    if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OpenAI API key not configured on server' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('OpenAI proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy request to OpenAI' });
    }
});

// ElevenLabs TTS Proxy
app.post('/api/elevenlabs/tts/:voiceId', async (req, res) => {
    if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: 'ElevenLabs API key not configured on server' });
    }

    const voiceId = req.params.voiceId;

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
        }

        // Stream audio back
        res.set('Content-Type', 'audio/mpeg');
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('ElevenLabs proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy request to ElevenLabs' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Galactic Command Server running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   OpenAI: http://localhost:${PORT}/api/openai/chat/completions`);
});
