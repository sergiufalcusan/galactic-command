/**
 * Game Action Manager
 * Executes game commands from AI or player input
 */

import gameState from './GameState.js';

export class GameActions {
    constructor(onBuildingCreated, onUnitCreated) {
        this.onBuildingCreated = onBuildingCreated;
        this.onUnitCreated = onUnitCreated;
    }

    executeAction(action) {
        const result = { success: false, message: '' };
        const count = action.target ? parseInt(action.target, 10) : null;

        switch (action.type) {
            case 'BUILD':
                return this.buildStructure(action.target);
            case 'PRODUCE':
                return this.produceUnit(action.target);
            case 'MINE':
                return this.assignMining(count);
            case 'HARVEST_GAS':
                return this.assignGasHarvesting(count);
            default:
                result.message = `Unknown action: ${action.type}`;
                return result;
        }
    }

    buildStructure(buildingType, manualPosition = null) {
        const result = { success: false, message: '' };
        const faction = gameState.faction;

        if (!faction) {
            result.message = 'No faction selected';
            return result;
        }

        // Normalize the building type to lowercase for switch matching
        const normalizedType = buildingType.toLowerCase();
        let buildingConfig;
        let placement = manualPosition ? { x: manualPosition.x, z: manualPosition.z } : { x: 0, z: 0 };
        const useAutoPlacement = !manualPosition;

        // Get building configuration
        switch (normalizedType) {
            case 'supply':
            case 'supplydepot':
            case 'pylon':
            case 'overlord':
                // Zerg uses Overlords (units) while other factions use buildings
                if (faction.id === 'zerg') {
                    // Spawn Overlord as a unit
                    return this.produceOverlord();
                }
                buildingConfig = faction.buildings.supply || faction.supplyUnit;
                // Auto-place supply buildings in a grid pattern
                if (useAutoPlacement) {
                    const supplyCount = gameState.getBuildingsByType('supply').length;
                    placement.x = 15 + (supplyCount % 3) * 4;
                    placement.z = -10 + Math.floor(supplyCount / 3) * 4;
                }
                break;

            case 'barracks':
            case 'spawningpool':
            case 'gateway':
                buildingConfig = faction.buildings.barracks;
                if (useAutoPlacement) {
                    const barracksCount = gameState.getBuildingsByType('barracks').length;
                    placement.x = -15 - barracksCount * 5;
                    placement.z = 5;
                }
                break;

            case 'factory':
            case 'roachwarren':
            case 'roboticsfacility':
                buildingConfig = faction.buildings.factory;
                if (useAutoPlacement) {
                    const factoryCount = gameState.getBuildingsByType('factory').length;
                    placement.x = -15 - factoryCount * 5;
                    placement.z = -5;
                }
                break;

            case 'gasextractor':
            case 'extractor':
            case 'refinery':
            case 'assimilator':
                buildingConfig = faction.buildings.gasExtractor;
                // Gas extractors MUST be placed on a geyser
                // Find nearest geyser to click position (manual) or first available (auto)
                const occupiedGeysers = gameState.buildings
                    .filter(b => ['gasextractor', 'extractor', 'refinery', 'assimilator'].includes(b.type?.toLowerCase()))
                    .map(b => ({ x: b.x, z: b.z }));

                let targetGeyser;
                if (manualPosition) {
                    // Find geyser closest to click position
                    targetGeyser = gameState.gasGeysers
                        .filter(g => {
                            if (g.hasExtractor) return false;
                            const isOccupied = occupiedGeysers.some(
                                b => Math.abs(b.x - g.x) < 2 && Math.abs(b.z - g.z) < 2
                            );
                            return !isOccupied;
                        })
                        .reduce((closest, g) => {
                            const dist = Math.sqrt(Math.pow(g.x - manualPosition.x, 2) + Math.pow(g.z - manualPosition.z, 2));
                            if (!closest || dist < closest.dist) {
                                return { geyser: g, dist };
                            }
                            return closest;
                        }, null)?.geyser;
                } else {
                    targetGeyser = gameState.gasGeysers.find(g => {
                        if (g.hasExtractor) return false;
                        const isOccupied = occupiedGeysers.some(
                            b => Math.abs(b.x - g.x) < 2 && Math.abs(b.z - g.z) < 2
                        );
                        return !isOccupied;
                    });
                }

                if (!targetGeyser) {
                    result.message = 'No available gas geysers';
                    return result;
                }
                placement.x = targetGeyser.x;
                placement.z = targetGeyser.z;
                break;

            default:
                result.message = `Unknown building type: ${buildingType}`;
                return result;
        }

        // Check resources
        if (!gameState.canAfford(buildingConfig.cost)) {
            result.message = `Not enough resources. Need ${buildingConfig.cost.minerals} minerals, ${buildingConfig.cost.gas} gas`;
            return result;
        }

        // Spend resources
        gameState.spendResources(buildingConfig.cost);

        // Create building (under construction)
        const building = gameState.addBuilding({
            type: buildingType,
            name: buildingConfig.name,
            x: placement.x,
            z: placement.z,
            health: 100,
            maxHealth: 100,
            isComplete: false
        });

        // Add to production queue
        gameState.addToProductionQueue({
            category: 'building',
            buildingId: building.id,
            type: buildingType,
            name: buildingConfig.name,
            buildTime: buildingConfig.buildTime,
            supplyProvided: buildingConfig.supplyProvided || 0
        });

        // Callback for renderer
        if (this.onBuildingCreated) {
            this.onBuildingCreated(building);
        }

        result.success = true;
        result.message = `Building ${buildingConfig.name}`;
        return result;
    }

    produceUnit(unitType) {
        const result = { success: false, message: '' };
        const faction = gameState.faction;

        if (!faction) {
            result.message = 'No faction selected';
            return result;
        }

        let unitConfig;

        // Normalize unit type aliases
        const unitTypeMap = {
            'worker': 'worker',
            'scv': 'worker',
            'drone': 'worker',
            'probe': 'worker',
            'marine': 'marine',
            'zergling': 'zergling',
            'zealot': 'zealot'
        };
        const normalizedType = unitTypeMap[unitType] || unitType;

        if (normalizedType === 'worker') {
            unitConfig = faction.worker;
        } else if (faction.units[normalizedType]) {
            unitConfig = faction.units[normalizedType];
        } else {
            result.message = `Unknown unit type: ${unitType}`;
            return result;
        }

        const populationCost = unitConfig.population || 1;

        // Check population
        if (!gameState.canAddPopulation(populationCost)) {
            result.message = 'Population cap reached. Build more supply structures.';
            return result;
        }

        // Check resources
        if (!gameState.canAfford(unitConfig.cost)) {
            result.message = `Not enough resources. Need ${unitConfig.cost.minerals} minerals, ${unitConfig.cost.gas} gas`;
            return result;
        }

        // Spend resources
        gameState.spendResources(unitConfig.cost);

        // Add to production queue
        gameState.addToProductionQueue({
            category: 'unit',
            unitType: normalizedType,
            name: unitConfig.name,
            buildTime: unitConfig.buildTime,
            population: populationCost,
            health: unitConfig.health || 40
        });

        result.success = true;
        result.message = `Training ${unitConfig.name}`;
        return result;
    }

    produceOverlord() {
        const result = { success: false, message: '' };
        const faction = gameState.faction;
        const overlordConfig = faction.supplyUnit;

        // Check resources
        if (!gameState.canAfford(overlordConfig.cost)) {
            result.message = `Not enough resources. Need ${overlordConfig.cost.minerals} minerals`;
            return result;
        }

        // Spend resources
        gameState.spendResources(overlordConfig.cost);

        // Add to production queue as a special supply unit
        gameState.addToProductionQueue({
            category: 'unit',
            unitType: 'overlord',
            name: overlordConfig.name,
            buildTime: overlordConfig.buildTime,
            population: 0, // Overlords don't cost supply
            health: 200,
            isSupplyUnit: true,
            supplyProvided: overlordConfig.supplyProvided
        });

        result.success = true;
        result.message = `Spawning ${overlordConfig.name}`;
        return result;
    }

    assignMining(count = null) {
        const result = { success: false, message: '' };
        const idleWorkers = gameState.getIdleWorkers();

        if (idleWorkers.length === 0) {
            result.message = 'No idle workers available';
            return result;
        }

        // Limit to count if specified
        const workersToAssign = count ? idleWorkers.slice(0, count) : idleWorkers;
        let assigned = 0;

        workersToAssign.forEach(worker => {
            if (gameState.assignWorkerToMinerals(worker.id)) {
                assigned++;
            }
        });

        result.success = assigned > 0;
        result.message = `Assigned ${assigned} workers to mine minerals`;
        return result;
    }

    assignGasHarvesting(count = null) {
        const result = { success: false, message: '' };

        // Determine how many workers to assign (default 3)
        const targetCount = count || 3;

        // Check if we have a gas extractor
        const hasExtractor = gameState.gasGeysers.some(g => g.hasExtractor);
        if (!hasExtractor) {
            result.message = 'No gas extractor built';
            return result;
        }

        // First try idle workers
        let availableWorkers = gameState.getIdleWorkers();

        // If not enough idle workers, pull from mineral workers
        if (availableWorkers.length < targetCount && gameState.mineralWorkers.length > 0) {
            const needed = targetCount - availableWorkers.length;
            // Get workers currently mining
            const miningWorkerIds = gameState.mineralWorkers.slice(0, needed);
            const miningWorkers = miningWorkerIds.map(id =>
                gameState.units.find(u => u.id === id)
            ).filter(Boolean);

            // Remove them from mineral workers and make idle
            miningWorkerIds.forEach(id => {
                gameState.mineralWorkers = gameState.mineralWorkers.filter(wid => wid !== id);
                const worker = gameState.units.find(u => u.id === id);
                if (worker) {
                    worker.state = 'idle';
                    worker.targetResource = null;
                }
            });

            availableWorkers = [...availableWorkers, ...miningWorkers];
        }

        if (availableWorkers.length === 0) {
            result.message = 'No workers available';
            return result;
        }

        // Limit to requested count and available gas slots
        const gasWorkersNeeded = Math.min(targetCount, 3 - gameState.gasWorkers.length);
        let assigned = 0;

        for (let i = 0; i < Math.min(gasWorkersNeeded, availableWorkers.length); i++) {
            if (gameState.assignWorkerToGas(availableWorkers[i].id)) {
                assigned++;
            }
        }

        result.success = assigned > 0;
        result.message = assigned > 0
            ? `Assigned ${assigned} workers to harvest gas`
            : 'Gas workers slots are full (max 3)';
        return result;
    }
}

export default GameActions;
