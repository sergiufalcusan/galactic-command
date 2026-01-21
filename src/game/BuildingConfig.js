/**
 * Central configuration for all building dimensions and ranges
 */

export const BUILDING_DIMENSIONS = {
    base: {
        name: 'Command Center / Hatchery / Nexus',
        visualScale: 3.5,
        collisionWidth: 7.0,
        collisionHeight: 4.0,
        collisionDepth: 10.0,
        clickHitboxSize: 8
    },
    supply: {
        name: 'Supply Depot / Pylon / Creep Colony',
        visualScale: 2.0,
        collisionWidth: 5.0,
        collisionHeight: 4.0,
        collisionDepth: 5.0,
        clickHitboxSize: 6
    },
    barracks: {
        name: 'Barracks / Spawning Pool / Gateway',
        visualScale: 2.5,
        collisionWidth: 5.0,
        collisionHeight: 4.0,
        collisionDepth: 5.0,
        clickHitboxSize: 6
    },
    factory: {
        name: 'Factory / Roach Warren / Robotics Facility',
        visualScale: 2.8,
        collisionWidth: 5.0,
        collisionHeight: 4.0,
        collisionDepth: 5.0,
        clickHitboxSize: 6
    },
    gasExtractor: {
        name: 'Refinery / Extractor / Assimilator',
        visualScale: 4.0,
        collisionWidth: 0, // No collision so workers can enter
        collisionHeight: 0,
        collisionDepth: 0,
        clickHitboxSize: 6
    }
};

/**
 * Normalizes specific building types to their "canonical" types
 */
export function normalizeBuildingType(type) {
    if (!type) return 'base';

    const lowerType = type.toLowerCase();

    const typeMap = {
        'base': 'base',
        'hatchery': 'base',
        'nexus': 'base',
        'commandcenter': 'base',
        'supply': 'supply',
        'supplydepot': 'supply',
        'pylon': 'supply',
        'creepcolony': 'supply',
        'barracks': 'barracks',
        'spawningpool': 'barracks',
        'gateway': 'barracks',
        'factory': 'factory',
        'roachwarren': 'factory',
        'roboticsfacility': 'factory',
        'gasextractor': 'gasExtractor',
        'extractor': 'gasExtractor',
        'refinery': 'gasExtractor',
        'assimilator': 'gasExtractor'
    };

    return typeMap[lowerType] || 'base';
}

/**
 * Gets the dimensions for a specific building type
 */
export function getBuildingDimensions(type) {
    const canonicalType = normalizeBuildingType(type);
    return BUILDING_DIMENSIONS[canonicalType];
}

export default {
    BUILDING_DIMENSIONS,
    normalizeBuildingType,
    getBuildingDimensions
};
