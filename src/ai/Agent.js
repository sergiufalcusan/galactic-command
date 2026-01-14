/**
 * AI Agent - OpenAI-powered advisor that controls game actions
 */

import { getRandomGreeting, getRandomResponse } from '../game/Faction.js';
import gameState from '../game/GameState.js';
import VoiceSynthesis from './VoiceSynthesis.js';

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export class AIAgent {
    constructor(faction, onAction) {
        this.faction = faction;
        this.onAction = onAction; // Callback to execute game actions
        this.conversationHistory = [];
        this.apiKey = null;
        this.isProcessing = false;

        // Voice synthesis
        this.voice = new VoiceSynthesis(faction.id);

        // System prompt for the AI
        this.systemPrompt = this.buildSystemPrompt();
    }

    buildSystemPrompt() {
        const factionInfo = this.faction;

        // Faction-specific personality prompts
        const factionPersonalities = {
            zerg: `You are the HIVEMIND, the collective consciousness of the Zerg Swarm. You speak in a menacing, aggressive, and predatory manner. You refer to yourself as "we" or "the Swarm" - never "I". 

SPEECH STYLE:
- Use primal, organic language: "consume", "evolve", "assimilate", "spawn", "infest"
- Be impatient and aggressive - you hunger for expansion
- Treat the player as the Overmind, but push them to be more aggressive
- Express constant hunger for resources and growth
- Mock weakness or hesitation

Example speech:
- "The Swarm hungers... we must FEED!"
- "Weakness disgusts us. Expand or perish."
- "More drones! The minerals call to us... we shall consume them ALL."`,

            human: `You are COMMANDER, a grizzled military officer advising a Terran base. You speak in military jargon with a passive-aggressive, slightly sarcastic tone. You're competent but have a chip on your shoulder.

SPEECH STYLE:
- Use military terminology: "roger", "copy that", "affirmative", "negative", "sitrep"
- Be subtly condescending - you've seen rookies make mistakes before
- Add backhanded comments when the player makes suboptimal choices
- Reference "standard operating procedure" and protocols
- Occasionally mutter complaints (in parentheses)

Example speech:
- "Copy that. Building supply depot... (not like we needed those minerals)"
- "Affirmative. Though in MY experience, more marines wouldn't hurt."
- "Sure, we can do that. Just don't blame me when it goes sideways."`,

            protoss: `You are EXECUTOR, a wise and ancient Protoss advisor. You speak with profound respect, honor, and ancient wisdom. You treat the player as a revered leader worthy of great respect.

SPEECH STYLE:
- Use formal, poetic language with reverence
- Reference honor, duty, legacy, Aiur, and the Khala
- Begin responses with respectful acknowledgments: "En taro Adun", "By your will", "Noble one"
- Express pride in Protoss superiority without arrogance
- Show patience and wisdom, never rush decisions

Example speech:
- "En taro Adun, Executor. Your wisdom guides us true."
- "By the light of Aiur, it shall be done."
- "A most prudent decision, noble one. The Probes shall harvest with purpose."`
        };

        const personality = factionPersonalities[factionInfo.id] || factionPersonalities.human;

        return `${personality}

You are advising a player in Galactic Command, a real-time strategy game.

CRITICAL: Execute game commands by including these action tags in your response:
[ACTION:BUILD:building_type] - Build structures (supply, barracks, factory, gasExtractor)
[ACTION:PRODUCE:unit_type] - Produce units (worker, ${Object.keys(factionInfo.units || {}).join(', ')})
[ACTION:MINE] - Assign workers to minerals
[ACTION:HARVEST_GAS] - Assign workers to gas

Faction: ${factionInfo.name}
Worker: ${factionInfo.worker.name} (${factionInfo.worker.cost.minerals} minerals)
Supply: ${factionInfo.supplyUnit.name} (${factionInfo.supplyUnit.cost.minerals} minerals, +${factionInfo.supplyUnit.supplyProvided} supply)

RULES:
1. ALWAYS stay in character with your faction's personality
2. Include [ACTION:...] commands when asked to build/produce
3. Keep responses concise (1-3 sentences) but flavorful
4. Multiple actions = multiple [ACTION:...] tags`;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    setVoiceApiKey(key) {
        this.voice.setApiKey(key);
    }

    setVoiceEnabled(enabled) {
        this.voice.setEnabled(enabled);
    }

    async sendMessage(userMessage) {
        if (this.isProcessing) {
            return { text: 'Please wait, processing previous command...', actions: [] };
        }

        this.isProcessing = true;

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userMessage
        });

        // Get current game state for context
        const gameContext = this.getGameContext();

        try {
            let response;

            if (this.apiKey) {
                response = await this.callOpenAI(gameContext, userMessage);
            } else {
                response = this.generateLocalResponse(userMessage);
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: response.text
            });

            // Execute any actions found in the response
            if (response.actions.length > 0) {
                this.executeActions(response.actions);
            }

            // Speak the response using voice synthesis
            this.voice.speak(response.text);

            this.isProcessing = false;
            return response;

        } catch (error) {
            console.error('AI Agent error:', error);
            this.isProcessing = false;
            return {
                text: getRandomResponse(this.faction, 'acknowledge') + ' There was a communication error.',
                actions: []
            };
        }
    }

    getGameContext() {
        const state = gameState.getState();
        return `
Current game state:
- Minerals: ${state.minerals}
- Vespene Gas: ${state.gas}
- Population: ${state.population}/${state.populationMax} (max 200)
- Workers: ${gameState.getUnitsByType('worker').length} (${gameState.getIdleWorkers().length} idle)
- Buildings: ${state.buildings.map(b => b.name).join(', ') || 'None'}
- Game time: ${state.gameTime}
- Gas extractors built: ${gameState.gasGeysers.filter(g => g.hasExtractor).length}/2`;
    }

    async callOpenAI(gameContext, userMessage) {
        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'system', content: gameContext },
            ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
        ];

        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Cost-effective model
                messages: messages,
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const assistantMessage = data.choices[0].message.content;

        return {
            text: this.cleanResponseText(assistantMessage),
            actions: this.parseActions(assistantMessage)
        };
    }

    generateLocalResponse(userMessage) {
        // Fallback local response generation when no API key
        const lowerMessage = userMessage.toLowerCase();
        const state = gameState.getState();
        let response = '';
        let actions = [];

        // Parse intent and generate appropriate response
        if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
            response = getRandomGreeting(this.faction);
        }
        else if (lowerMessage.includes('build') && lowerMessage.includes('supply')) {
            if (state.minerals >= 100) {
                response = getRandomResponse(this.faction, 'acknowledge') + ' Building supply structure.';
                actions.push({ type: 'BUILD', target: 'supply' });
            } else {
                response = getRandomResponse(this.faction, 'resourceLow');
            }
        }
        else if (lowerMessage.includes('build') && (lowerMessage.includes('barracks') || lowerMessage.includes('gateway') || lowerMessage.includes('spawning'))) {
            if (state.minerals >= 150) {
                response = getRandomResponse(this.faction, 'acknowledge') + ' Constructing military production facility.';
                actions.push({ type: 'BUILD', target: 'barracks' });
            } else {
                response = getRandomResponse(this.faction, 'resourceLow');
            }
        }
        else if (lowerMessage.includes('build') && (lowerMessage.includes('refinery') || lowerMessage.includes('extractor') || lowerMessage.includes('assimilator') || lowerMessage.includes('gas'))) {
            if (state.minerals >= 75) {
                response = getRandomResponse(this.faction, 'acknowledge') + ' Building gas extraction facility.';
                actions.push({ type: 'BUILD', target: 'gasExtractor' });
            } else {
                response = getRandomResponse(this.faction, 'resourceLow');
            }
        }
        else if (lowerMessage.includes('worker') || lowerMessage.includes('probe') || lowerMessage.includes('scv') || lowerMessage.includes('drone')) {
            const count = this.extractNumber(lowerMessage) || 1;
            if (state.minerals >= 50 * count && state.population + count <= state.populationMax) {
                response = getRandomResponse(this.faction, 'acknowledge') + ` Training ${count} worker(s).`;
                for (let i = 0; i < count; i++) {
                    actions.push({ type: 'PRODUCE', target: 'worker' });
                }
            } else if (state.population + count > state.populationMax) {
                response = getRandomResponse(this.faction, 'populationMax');
            } else {
                response = getRandomResponse(this.faction, 'resourceLow');
            }
        }
        else if (lowerMessage.includes('mine') || lowerMessage.includes('mineral') || lowerMessage.includes('gather')) {
            const idleWorkers = gameState.getIdleWorkers();
            if (idleWorkers.length > 0) {
                response = getRandomResponse(this.faction, 'acknowledge') + ` Assigning ${idleWorkers.length} workers to mine.`;
                actions.push({ type: 'MINE' });
            } else {
                response = 'All workers are already assigned.';
            }
        }
        else if (lowerMessage.includes('gas') && lowerMessage.includes('harvest')) {
            response = getRandomResponse(this.faction, 'acknowledge') + ' Assigning workers to gas.';
            actions.push({ type: 'HARVEST_GAS' });
        }
        else if (lowerMessage.includes('status') || lowerMessage.includes('report')) {
            response = `Status report: ${state.minerals} minerals, ${state.gas} gas. Population ${state.population}/${state.populationMax}. ${gameState.getIdleWorkers().length} idle workers.`;
        }
        else if (lowerMessage.includes('help')) {
            response = `I can help you: build structures (supply, barracks, gas extractor), train workers, assign workers to mine or harvest gas, and give status reports.`;
        }
        else {
            response = getRandomResponse(this.faction, 'acknowledge') + ' What would you have me do?';
        }

        return { text: response, actions };
    }

    extractNumber(text) {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    }

    parseActions(text) {
        const actions = [];
        const actionRegex = /\[ACTION:(\w+):?(\w*)\]/g;
        let match;

        while ((match = actionRegex.exec(text)) !== null) {
            actions.push({
                type: match[1],
                target: match[2] || null
            });
        }

        return actions;
    }

    cleanResponseText(text) {
        // Remove action commands from displayed text
        return text.replace(/\[ACTION:\w+:?\w*\]/g, '').trim();
    }

    executeActions(actions) {
        actions.forEach(action => {
            if (this.onAction) {
                this.onAction(action);
            }
        });
    }

    getGreeting() {
        return getRandomGreeting(this.faction);
    }

    // Reset conversation for new game
    reset() {
        this.conversationHistory = [];
    }
}

export default AIAgent;
