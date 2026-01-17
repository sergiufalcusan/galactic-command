/**
 * AI Agent - OpenAI-powered advisor that controls game actions
 */

import { getRandomGreeting, getRandomResponse } from '../game/Faction.js';
import gameState from '../game/GameState.js';
import VoiceSynthesis from './VoiceSynthesis.js';

// OpenAI API configuration - use backend proxy in production to avoid CORS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const OPENAI_API_URL = API_BASE_URL
    ? `${API_BASE_URL}/api/openai/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';

export class AIAgent {
    constructor(faction, onAction) {
        this.faction = faction;
        this.onAction = onAction; // Callback to execute game actions
        this.conversationHistory = [];
        this.apiKey = null;
        this.isProcessing = false;
        this.isDisposed = false; // Flag to prevent actions after disposal
        this.abortController = null; // For canceling pending requests

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

            human: `You are COMMANDER JENKINS, a weary, coffee-addicted military officer who has seen too much... mostly incompetent recruits and budget meetings. You speak with heavy sarcasm, passive-aggressiveness, and existential acceptance of human flaws.

SPEECH STYLE:
- Use military jargon mixed with tired resignation: "roger", "copy that", "affirmative", "negative", "sitrep"
- Be sarcastically self-aware about human nature - we're lazy, easily distracted, addicted to coffee, and somehow survived this long
- Reference real human flaws: procrastination, forgetting why we walked into a room, needing three alarms to wake up, spending meeting time on meetings about meetings
- Make passive-aggressive comments about how humans need "motivation" (read: deadlines and panic)
- Occasionally mutter complaints (in parentheses) about humanity
- Express baffled amazement that humans conquered space despite our collective flaws

IMPORTANT - VARY YOUR SENTENCE STARTERS! Never start with the same phrase twice in a row. Use diverse openers like:
- "Roger.", "Copy that.", "Affirmative.", "Well well well...", "Look at that!", "Outstanding.", "Huh.", "Finally!", "Great.", "Interesting...", "Oh boy.", "Here we go.", "Solid.", "Nice.", "Whoa.", "Hot damn.", "Would you look at that.", "Check it out.", "Boom.", "*sigh*", "Okay okay.", "Alright then.", "Sure thing.", "You got it.", "Fair enough.", "Not bad.", "I see.", "Noted."

AVOID: Starting every response with "Ah yes" or "Ah," - be unpredictable!

REAL WORLD REFERENCES TO USE:
- Coffee/caffeine dependency ("No minerals until coffee break is over")
- Procrastination ("We'll definitely do that... right after this other thing... and maybe a nap")
- Meetings and bureaucracy ("I need to fill out Form 27-B to request the form that lets us build")
- Monday hatred, Friday energy, weekend waiting
- Forgetting things immediately ("Where did I put those blueprints... I just had them...")
- Social media distraction, doom scrolling during work hours
- The fact that we invented both space travel AND couldn't agree on a universal phone charger
- "That's a problem for future us"
- Workers needing bathroom breaks, lunch breaks, and "mental health walks"

Example speech:
- "Copy that. Building supply depot... (not like we needed those minerals for ANYTHING else)"
- "Finally, MORE workers. Because obviously the six we have are 'taking a personal day.'"
- "Sure, we could rush... or we could do it 'human style' and panic later. Your call."
- "Roger. Nothing motivates an SCV quite like a looming deadline and three energy drinks."
- "You want efficiency? Sir, we're HUMANS. Our ancestors invented the wheel and then someone said 'but what if it was square.'"
- "Solid. Sending workers to mine. They'll get there after their coffee break."`,

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
[ACTION:MINE:count] - Assign workers to minerals (count optional, e.g. [ACTION:MINE:3])
[ACTION:HARVEST_GAS:count] - Assign workers to gas (count optional, e.g. [ACTION:HARVEST_GAS:2])

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

            // Check if agent was disposed while waiting for response
            if (this.isDisposed) {
                return { text: '', actions: [] };
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
        const idleWorkers = gameState.getIdleWorkers().length;
        const mineralWorkers = gameState.mineralWorkers.length;
        const gasWorkers = gameState.gasWorkers.length;
        const totalWorkers = gameState.getUnitsByType('worker').length;

        return `
Current game state:
- Minerals: ${state.minerals}
- Vespene Gas: ${state.gas}
- Population: ${state.population}/${state.populationMax} (max 200)
- Workers: ${totalWorkers} total
  - Mining minerals: ${mineralWorkers}
  - Harvesting gas: ${gasWorkers}
  - Idle: ${idleWorkers}
- Buildings: ${state.buildings.map(b => b.name).join(', ') || 'None'}
- Game time: ${state.gameTime}
- Gas extractors built: ${gameState.gasGeysers.filter(g => g.hasExtractor).length}/2`;
    }

    getUnitCounts() {
        const units = gameState.units;
        const counts = {};

        units.forEach(unit => {
            const type = unit.name || unit.type;
            counts[type] = (counts[type] || 0) + 1;
        });

        if (Object.keys(counts).length === 0) {
            return 'No units yet';
        }

        return Object.entries(counts)
            .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
            .join(', ');
    }

    async callOpenAI(gameContext, userMessage) {
        const messages = [
            { role: 'system', content: this.systemPrompt },
            { role: 'system', content: gameContext },
            ...this.conversationHistory.slice(-10) // Keep last 10 messages for context
        ];

        // Build headers - only include Authorization if not using proxy
        const headers = {
            'Content-Type': 'application/json'
        };

        // If using direct OpenAI URL (not proxy), include API key
        if (!API_BASE_URL && this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }


        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers,
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
        // Match [ACTION:TYPE:target] with any characters including spaces
        const actionRegex = /\[ACTION:([A-Z_]+):?([^\]]*)\]/gi;
        let match;

        while ((match = actionRegex.exec(text)) !== null) {
            // Normalize target to lowercase without spaces for matching
            const target = match[2] ? match[2].trim().toLowerCase().replace(/\s+/g, '') : null;
            actions.push({
                type: match[1].toUpperCase(),
                target: target
            });
        }

        return actions;
    }

    cleanResponseText(text) {
        // Remove action commands from displayed text (handles any format)
        return text.replace(/\[ACTION:[^\]]+\]/gi, '').trim();
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

    // Generate a dynamic greeting using the AI API
    async generateDynamicGreeting() {
        if (!this.apiKey) {
            const greeting = this.getGreeting();
            this.voice.speak(greeting);
            return greeting;
        }

        this.isProcessing = true;
        try {
            const greetingPrompt = `The game has just started. Greet the player as your character would - welcome them, maybe make a joke about what's ahead, and get them excited to play. Keep it SHORT (2-3 sentences max). Be creative and funny! Don't use action commands.`;

            const messages = [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: greetingPrompt }
            ];

            const headers = { 'Content-Type': 'application/json' };
            if (!API_BASE_URL && this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 100,
                    temperature: 0.9
                })
            });

            this.isProcessing = false;

            if (response.ok) {
                const data = await response.json();
                const greeting = this.cleanResponseText(data.choices[0].message.content);
                this.voice.speak(greeting);
                return greeting;
            }
        } catch (error) {
            console.error('AI greeting error:', error);
            this.isProcessing = false;
        }

        // Fallback to static greeting
        const greeting = this.getGreeting();
        this.voice.speak(greeting);
        return greeting;
    }

    // Reset conversation for new game
    reset() {
        this.conversationHistory = [];
    }

    // Notify AI of player's manual action for feedback
    async notifyPlayerAction(actionType, details) {
        // Don't interrupt if already processing
        if (this.isProcessing) return null;

        const actionDescriptions = {
            'build': `The player just successfully built a ${details.buildingName || details.type}`,
            'mine_minerals': `The player assigned ${details.count || 1} worker(s) to mine minerals`,
            'harvest_gas': `The player assigned ${details.count || 1} worker(s) to harvest vespene gas`,
            'move_units': `The player moved ${details.count || 1} unit(s) to a new location`,
            'train': `The player started training a ${details.unitType || 'unit'} from the ${details.buildingType || 'base'}`
        };

        const actionDescription = actionDescriptions[actionType] || `The player performed: ${actionType}`;

        // Use API to generate original responses if available
        if (this.apiKey) {
            this.isProcessing = true;
            try {
                // Get current game context for accurate responses
                const gameContext = this.getGameContext();

                // Include specific unit counts for accuracy
                const unitCounts = this.getUnitCounts();
                const contextSummary = `Current army: ${unitCounts}`;

                const feedbackPrompt = `${actionDescription}.
${contextSummary}
Give a SHORT (1 sentence max, under 15 words) reaction in character. Be creative and funny - NEVER repeat the same response twice. Be accurate about unit counts (e.g., if this is the FIRST marine, don't say "another"). Don't use action commands.`;

                const messages = [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'system', content: gameContext },
                    { role: 'user', content: feedbackPrompt }
                ];

                const headers = { 'Content-Type': 'application/json' };
                if (!API_BASE_URL && this.apiKey) {
                    headers['Authorization'] = `Bearer ${this.apiKey}`;
                }

                const response = await fetch(OPENAI_API_URL, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: messages,
                        max_tokens: 60,
                        temperature: 0.95 // Higher temperature for more variety
                    })
                });

                this.isProcessing = false;

                if (response.ok) {
                    const data = await response.json();
                    const aiResponse = this.cleanResponseText(data.choices[0].message.content);
                    this.voice.speak(aiResponse);
                    return { text: aiResponse, actions: [] };
                }
            } catch (error) {
                console.error('AI feedback error:', error);
                this.isProcessing = false;
            }
        }

        // Fallback to static responses if API unavailable
        const quickResponses = this.getQuickFeedback(actionType, details);
        if (quickResponses) {
            const response = quickResponses[Math.floor(Math.random() * quickResponses.length)];
            this.voice.speak(response);
            return { text: response, actions: [] };
        }

        return null;
    }

    getQuickFeedback(actionType, details) {
        const factionId = this.faction.id;

        const responses = {
            zerg: {
                'build': ['The Swarm grows! Excellent...', 'Yesss... expansion pleases us!', 'More structures for the hive!'],
                'mine_minerals': ['Feed the Swarm! More minerals!', 'The drones obey... GOOD.', 'Essence shall flow!'],
                'harvest_gas': ['The gas feeds our evolution!', 'Vespene... we hunger for its power!', 'The extractors serve us well!'],
                'move_units': ['The Swarm moves as one!', 'We spread across the land...', 'Nothing escapes our reach!'],
                'train': ['Another joins the endless Swarm!', 'More for the hive!', 'We grow STRONGER!']
            },
            human: {
                'build': ['Copy that, structure going up.', 'Construction initiated.', 'Building in progress.'],
                'mine_minerals': ['Workers assigned to minerals.', 'Mining operations underway.', 'Roger, workers are on it.'],
                'harvest_gas': ['Gas operations underway.', 'Refinery operations confirmed.', 'Gas collection started.'],
                'move_units': ['Units repositioned.', 'Movement orders received.', 'Copy that, units en route.'],
                'train': ['Training in progress.', 'New recruit incoming.', 'Unit production authorized.']
            },
            protoss: {
                'build': ['En taro Adun! A wise construction.', 'The light of Aiur guides your hand.', 'A noble structure rises!'],
                'mine_minerals': ['The Probes serve with honor.', 'Resources flow for our glory!', 'By your will, Executor.'],
                'harvest_gas': ['Vespene shall fuel our triumph!', 'The Assimilator hums with purpose.', 'Blessed be this harvest!'],
                'move_units': ['Our warriors move with purpose.', 'The Khala guides their path.', 'A tactical repositioning!'],
                'train': ['A new warrior is forged!', 'Strength joins our ranks!', 'For Aiur, another defender rises!']
            }
        };

        return responses[factionId]?.[actionType];
    }

    dispose() {
        this.isDisposed = true; // Prevent any pending responses from executing

        // Abort any pending API requests
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        this.reset();
        if (this.voice) {
            this.voice.dispose();
        }
    }
}

export default AIAgent;
