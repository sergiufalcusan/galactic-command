/**
 * Faction definitions with unique units, buildings, and characteristics
 */

export const FACTIONS = {
    zerg: {
        id: 'zerg',
        name: 'Zerg',
        description: 'Organic swarm. Overwhelm with numbers. Evolve and adapt.',
        colors: {
            primary: '#8b00ff',
            secondary: '#4a0080',
            glow: 'rgba(139, 0, 255, 0.5)'
        },
        advisor: {
            name: 'Hivemind',
            personality: 'collective, aggressive, adaptive',
            greetings: [
                'The Swarm AWAKENS. What is your will, Overmind? We hunger...',
                'We are many. We are one. We are HUNGRY. Command us!',
                'The hive stirs with anticipation. Speak, and we shall CONSUME.'
            ],
            responses: {
                acknowledge: ['The Swarm obeys... for now.', 'Yesss... it shall be done.', 'We adapt. We evolve. We CONQUER.'],
                resourceLow: ['FEED US! We require more minerals to grow!', 'The hive STARVES. More essence needed!'],
                populationMax: ['The Swarm is BLOATED. Spawn more Overlords or we stagnate!'],
                cannotBuild: ['Pathetic! We lack the essence for this evolution.', 'WEAK. More resources needed.'],
                built: ['The structure LIVES and breathes.', 'Evolution complete. The swarm grows stronger.'],
                produced: ['Another creature joins the endless Swarm!', 'More for the hive. Soon, we shall be UNSTOPPABLE.']
            }
        },
        worker: {
            name: 'Drone',
            cost: { minerals: 50, gas: 0 },
            buildTime: 17,
            population: 1
        },
        supplyUnit: {
            name: 'Overlord',
            cost: { minerals: 100, gas: 0 },
            buildTime: 25,
            supplyProvided: 8
        },
        buildings: {
            base: {
                name: 'Hatchery',
                cost: { minerals: 300, gas: 0 },
                buildTime: 120,
                supplyProvided: 10,
                produces: ['drone', 'zergling', 'overlord']
            },
            gasExtractor: {
                name: 'Extractor',
                cost: { minerals: 25, gas: 0 },
                buildTime: 30
            },
            barracks: {
                name: 'Spawning Pool',
                cost: { minerals: 200, gas: 0 },
                buildTime: 65,
                unlocks: ['zergling']
            },
            factory: {
                name: 'Roach Warren',
                cost: { minerals: 150, gas: 0 },
                buildTime: 55,
                unlocks: ['roach']
            }
        },
        units: {
            zergling: {
                name: 'Zergling',
                cost: { minerals: 50, gas: 0 },
                buildTime: 24,
                population: 1,
                attack: 5,
                health: 35
            },
            roach: {
                name: 'Roach',
                cost: { minerals: 75, gas: 25 },
                buildTime: 27,
                population: 2,
                attack: 16,
                health: 145
            },
            hydralisk: {
                name: 'Hydralisk',
                cost: { minerals: 100, gas: 50 },
                buildTime: 33,
                population: 2,
                attack: 12,
                health: 90
            }
        }
    },

    human: {
        id: 'human',
        name: 'Human',
        description: 'Industrial might. Balanced forces. Technological supremacy.',
        colors: {
            primary: '#00aaff',
            secondary: '#004488',
            glow: 'rgba(0, 170, 255, 0.5)'
        },
        advisor: {
            name: 'Commander',
            personality: 'strategic, practical, military',
            greetings: [
                'Commander on deck. Awaiting orders... (try not to mess this one up)',
                'Base operations online. Ready for commands. (here we go again)',
                'All systems operational. What are your orders? (let me guess, more SCVs?)'
            ],
            responses: {
                acknowledge: ['Roger that. (I guess that\'s fine)', 'Affirmative. Standard procedure.', 'Copy, Commander. (brilliant as always)'],
                resourceLow: ['We need resources, Commander. Shocking, I know.', 'Mineral reserves depleted. Who saw that coming?'],
                populationMax: ['Supply depot required. (I\'ve only said this a hundred times)', 'We hit our cap. Maybe build some depots?'],
                cannotBuild: ['Insufficient resources. Check the budget next time.', 'Can\'t do that. (obviously)'],
                built: ['Structure complete. Finally.', 'Building operational. You\'re welcome.'],
                produced: ['Unit ready. Try to keep this one alive.', 'Reporting for duty. (here goes nothing)']
            }
        },
        worker: {
            name: 'SCV',
            cost: { minerals: 50, gas: 0 },
            buildTime: 17,
            population: 1
        },
        supplyUnit: {
            name: 'Supply Depot',
            cost: { minerals: 100, gas: 0 },
            buildTime: 30,
            supplyProvided: 8
        },
        buildings: {
            base: {
                name: 'Command Center',
                cost: { minerals: 400, gas: 0 },
                buildTime: 100,
                supplyProvided: 15,
                produces: ['scv']
            },
            gasExtractor: {
                name: 'Refinery',
                cost: { minerals: 75, gas: 0 },
                buildTime: 30
            },
            supply: {
                name: 'Supply Depot',
                cost: { minerals: 100, gas: 0 },
                buildTime: 30,
                supplyProvided: 8
            },
            barracks: {
                name: 'Barracks',
                cost: { minerals: 150, gas: 0 },
                buildTime: 65,
                unlocks: ['marine', 'marauder']
            },
            factory: {
                name: 'Factory',
                cost: { minerals: 150, gas: 100 },
                buildTime: 60,
                unlocks: ['hellion', 'tank']
            }
        },
        units: {
            marine: {
                name: 'Marine',
                cost: { minerals: 50, gas: 0 },
                buildTime: 25,
                population: 1,
                attack: 6,
                health: 45
            },
            marauder: {
                name: 'Marauder',
                cost: { minerals: 100, gas: 25 },
                buildTime: 30,
                population: 2,
                attack: 10,
                health: 125
            },
            hellion: {
                name: 'Hellion',
                cost: { minerals: 100, gas: 0 },
                buildTime: 30,
                population: 2,
                attack: 8,
                health: 90
            }
        }
    },

    protoss: {
        id: 'protoss',
        name: 'Protoss',
        description: 'Psionic warriors. Quality over quantity. Shield technology.',
        colors: {
            primary: '#ffcc00',
            secondary: '#886600',
            glow: 'rgba(255, 204, 0, 0.5)'
        },
        advisor: {
            name: 'Executor',
            personality: 'wise, proud, honorable',
            greetings: [
                'En taro Adun, noble Executor. The Firstborn are honored to serve your wisdom.',
                'By the eternal light of Aiur, we stand ready. How may we honor you?',
                'The psionic matrix resonates with purpose. Your will guides our destiny.'
            ],
            responses: {
                acknowledge: ['By your will, noble one.', 'It shall be so, with honor.', 'For Aiur, and for you, Executor.'],
                resourceLow: ['We require more minerals, wise Executor. The crystals call to us.', 'Our resources grow thin, but our resolve does not.'],
                populationMax: ['You must construct additional pylons, noble one. The psionic matrix requires expansion.', 'We have insufficient psi, Executor. More pylons would honor Aiur.'],
                cannotBuild: ['We cannot warp this structure without more resources, wise one.', 'The void requires more essence. We await your guidance.'],
                built: ['Warp-in complete. The structure honors our legacy.', 'Structure materialized with the blessing of the Khala.'],
                produced: ['A warrior stands ready to serve. My life for Aiur!', 'The Firstborn answer your call, Executor. En taro Adun!']
            }
        },
        worker: {
            name: 'Probe',
            cost: { minerals: 50, gas: 0 },
            buildTime: 17,
            population: 1
        },
        supplyUnit: {
            name: 'Pylon',
            cost: { minerals: 100, gas: 0 },
            buildTime: 25,
            supplyProvided: 8
        },
        buildings: {
            base: {
                name: 'Nexus',
                cost: { minerals: 400, gas: 0 },
                buildTime: 100,
                supplyProvided: 15,
                produces: ['probe']
            },
            gasExtractor: {
                name: 'Assimilator',
                cost: { minerals: 75, gas: 0 },
                buildTime: 30
            },
            supply: {
                name: 'Pylon',
                cost: { minerals: 100, gas: 0 },
                buildTime: 25,
                supplyProvided: 8
            },
            barracks: {
                name: 'Gateway',
                cost: { minerals: 150, gas: 0 },
                buildTime: 65,
                unlocks: ['zealot', 'stalker']
            },
            factory: {
                name: 'Robotics Facility',
                cost: { minerals: 200, gas: 100 },
                buildTime: 65,
                unlocks: ['immortal']
            }
        },
        units: {
            zealot: {
                name: 'Zealot',
                cost: { minerals: 100, gas: 0 },
                buildTime: 38,
                population: 2,
                attack: 8,
                health: 100,
                shield: 50
            },
            stalker: {
                name: 'Stalker',
                cost: { minerals: 125, gas: 50 },
                buildTime: 42,
                population: 2,
                attack: 13,
                health: 80,
                shield: 80
            },
            immortal: {
                name: 'Immortal',
                cost: { minerals: 275, gas: 100 },
                buildTime: 55,
                population: 4,
                attack: 20,
                health: 200,
                shield: 100
            }
        }
    }
};

export function getFaction(factionId) {
    return FACTIONS[factionId] || null;
}

export function getRandomGreeting(faction) {
    const greetings = faction.advisor.greetings;
    return greetings[Math.floor(Math.random() * greetings.length)];
}

export function getRandomResponse(faction, type) {
    const responses = faction.advisor.responses[type];
    if (!responses || responses.length === 0) return '';
    return responses[Math.floor(Math.random() * responses.length)];
}
