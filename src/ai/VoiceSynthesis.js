/**
 * Voice Synthesis using ElevenLabs API
 * Provides text-to-speech for AI agents with faction-specific voices
 */

// ElevenLabs API configuration - use backend proxy in production
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ELEVENLABS_API_URL = API_BASE_URL
    ? `${API_BASE_URL}/api/elevenlabs/tts`
    : 'https://api.elevenlabs.io/v1/text-to-speech';

// Recommended ElevenLabs voice IDs for each faction
// Users can customize these in settings
const DEFAULT_VOICE_IDS = {
    zerg: 'HH3kybY6uEJ2ebSa9Vy3', // User-selected Zerg voice
    human: 'qXpMhyvQqiRxWQs4qSSB', // User-selected Human voice
    protoss: 'flHkNRp1BlvT73UL6gyz' // User-selected Protoss voice
};

// Voice settings per faction for optimal effect
const VOICE_SETTINGS = {
    zerg: {
        stability: 0.3, // More variation for alien feel
        similarity_boost: 0.7,
        style: 0.5,
        use_speaker_boost: true,
        playbackRate: 1.2 // Faster for aggressive swarm feel
    },
    human: {
        stability: 0.75, // More stable for military precision
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
        playbackRate: 1.0
    },
    protoss: {
        stability: 0.5, // Balanced for wisdom
        similarity_boost: 0.8,
        style: 0.7,
        use_speaker_boost: true,
        playbackRate: 0.95 // Slightly slower for deliberate wisdom
    }
};

export class VoiceSynthesis {
    constructor(factionId) {
        this.factionId = factionId;
        this.apiKey = null;
        this.voiceId = DEFAULT_VOICE_IDS[factionId] || DEFAULT_VOICE_IDS.human;
        this.settings = VOICE_SETTINGS[factionId] || VOICE_SETTINGS.human;
        this.isEnabled = false;
        this.isSpeaking = false;
        this.audioQueue = [];
        this.currentAudio = null;
        this.generation = 0;

        // Audio context for processing
        this.audioContext = null;
    }

    setApiKey(key) {
        this.apiKey = key;
        this.isEnabled = !!key;
    }

    setVoiceId(voiceId) {
        this.voiceId = voiceId;
    }

    async speak(text, interrupt = true) {
        if (!this.isEnabled) {
            return false;
        }

        if (!this.apiKey) {
            return false;
        }

        if (!text) {
            return false;
        }

        // Clean text of action commands
        const cleanText = text.replace(/\[ACTION:\w+:?\w*\]/g, '').trim();
        if (!cleanText) {
            return false;
        }

        // Interrupt current playback and clear queue if specified
        if (interrupt) {
            this.stop();
        }

        // Add to queue
        this.audioQueue.push(cleanText);

        // Process queue if not already speaking
        if (!this.isSpeaking) {
            this.processQueue(this.generation);
        }

        return true;
    }

    async processQueue(gen) {
        if (gen !== this.generation) return;

        if (this.audioQueue.length === 0) {
            this.isSpeaking = false;
            return;
        }

        this.isSpeaking = true;
        const text = this.audioQueue.shift();

        try {
            const audioData = await this.generateSpeech(text);

            // Check generation again after await
            if (gen !== this.generation) return;

            if (audioData) {
                await this.playAudio(audioData);
            }
        } catch (error) {
            console.error('[Voice] Synthesis error:', error);
        }

        // Process next in queue
        if (gen === this.generation) {
            this.processQueue(gen);
        }
    }

    async generateSpeech(text) {
        const url = `${ELEVENLABS_API_URL}/${this.voiceId}`;

        // Build headers - only include API key if not using proxy
        const headers = {
            'Content-Type': 'application/json'
        };
        if (!API_BASE_URL && this.apiKey) {
            headers['xi-api-key'] = this.apiKey;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: this.settings
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Voice] API Error:', response.status, errorText);
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        return await response.arrayBuffer();
    }

    async playAudio(audioData) {
        return new Promise((resolve, reject) => {
            // Create audio context if needed
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Convert array buffer to audio
            const blob = new Blob([audioData], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);

            // Apply custom playback rate if defined
            if (this.settings && this.settings.playbackRate) {
                audio.playbackRate = this.settings.playbackRate;
            }

            this.currentAudio = audio;
            this.resolvePlay = resolve;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
                this.resolvePlay = null;
                resolve();
            };

            audio.onerror = (error) => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
                this.resolvePlay = null;
                reject(error);
            };

            audio.play().catch((err) => {
                this.resolvePlay = null;
                reject(err);
            });
        });
    }

    stop() {
        this.generation++;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = ''; // Force stop and release resources
            this.currentAudio = null;
        }

        this.audioQueue = [];
        this.isSpeaking = false;

        if (this.resolvePlay) {
            this.resolvePlay();
            this.resolvePlay = null;
        }
    }

    setEnabled(enabled) {
        this.isEnabled = enabled && !!this.apiKey;
        if (!enabled) {
            this.stop();
        }
    }

    // Get available voices from ElevenLabs (for settings UI)
    async getAvailableVoices() {
        if (!this.apiKey) return [];

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.status}`);
            }

            const data = await response.json();
            return data.voices.map(v => ({
                id: v.voice_id,
                name: v.name,
                category: v.category
            }));
        } catch (error) {
            console.error('Error fetching voices:', error);
            return [];
        }
    }
    dispose() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}

export default VoiceSynthesis;
