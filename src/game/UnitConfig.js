/**
 * Central configuration for all unit dimensions
 */

export const UNIT_CONFIG = {
    worker: {
        radius: 0.4,
        height: 2.0,
        visualScale: 1.5
    },
    larva: {
        radius: 0.5,
        height: 0.8,
        visualScale: 0.6
    },
    evolutionEgg: {
        radius: 1.2,
        height: 2.5,
        visualScale: 1.0
    },
    zergling: {
        radius: 0.7,
        height: 1.2,
        visualScale: 1.5
    },
    marine: {
        radius: 0.8,
        height: 2.0,
        visualScale: 1.5
    },
    zealot: {
        radius: 0.9,
        height: 2.2,
        visualScale: 1.5
    },
    overlord: {
        radius: 3.0,
        height: 4.0,
        visualScale: 10.0,
        flyHeight: 8.0  // Fly above ground
    }
};

/**
 * Gets the configuration for a specific unit type
 */
export function getUnitConfig(type) {
    if (!type) return UNIT_CONFIG.worker;

    const lowerType = type.toLowerCase();

    // Map specific unit types to config keys
    if (lowerType === 'drone' || lowerType === 'scv' || lowerType === 'probe' || lowerType === 'worker') {
        return UNIT_CONFIG.worker;
    }

    return UNIT_CONFIG[lowerType] || UNIT_CONFIG.worker;
}

export default {
    UNIT_CONFIG,
    getUnitConfig
};
