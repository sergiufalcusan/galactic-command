/**
 * Voice Synthesis using ElevenLabs API
 * Provides text-to-speech for AI agents with faction-specific voices
 */

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

// Recommended ElevenLabs voice IDs for each faction
// Users can customize these in settings
const DEFAULT_VOICE_IDS = {
    zerg: 'onwK4e9ZLuTAKqWW03F9', // Deep, menacing voice (Daniel)
    human: 'pNInz6obpgDQGcFmaJgB', // Military male voice (Adam)
    protoss: 'EXAVITQu4vr4xnSDxMaL' // Ethereal, wise voice (Bella)
};

// Voice settings per faction for optimal effect
const VOICE_SETTINGS = {
    zerg: {
        stability: 0.3, // More variation for alien feel
        similarity_boost: 0.7,
        style: 0.5,
        use_speaker_boost: true
    },
    human: {
        stability: 0.75, // More stable for military precision
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true
    },
    protoss: {
        stability: 0.5, // Balanced for wisdom
        similarity_boost: 0.8,
        style: 0.7,
        use_speaker_boost: true
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

    async speak(text) {
        if (!this.isEnabled || !this.apiKey || !text) {
            return false;
        }

        // Clean text of action commands
        const cleanText = text.replace(/\[ACTION:\w+:?\w*\]/g, '').trim();
        if (!cleanText) return false;

        // Add to queue
        this.audioQueue.push(cleanText);

        // Process queue if not already speaking
        if (!this.isSpeaking) {
            this.processQueue();
        }

        return true;
    }

    async processQueue() {
        if (this.audioQueue.length === 0) {
            this.isSpeaking = false;
            return;
        }

        this.isSpeaking = true;
        const text = this.audioQueue.shift();

        try {
            const audioData = await this.generateSpeech(text);
            if (audioData) {
                await this.playAudio(audioData);
            }
        } catch (error) {
            console.error('Voice synthesis error:', error);
        }

        // Process next in queue
        this.processQueue();
    }

    async generateSpeech(text) {
        const url = `${ELEVENLABS_API_URL}/${this.voiceId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKey
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: this.settings
            })
        });

        if (!response.ok) {
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

            this.currentAudio = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
                resolve();
            };

            audio.onerror = (error) => {
                URL.revokeObjectURL(url);
                this.currentAudio = null;
                reject(error);
            };

            audio.play().catch(reject);
        });
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.audioQueue = [];
        this.isSpeaking = false;
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
}

export default VoiceSynthesis;
