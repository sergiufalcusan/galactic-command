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
                return this.trainUnit('base', action.target);
            case 'MINE':
                return this.assignMining(count);
            case 'HARVEST_GAS':
                return this.assignGasHarvesting(count);
            default:
                result.message = `Unknown action: ${action.type}`;
                return result;
        }
    }

    buildStructure(buildingType, manualPosition = null, selectedWorkerId = null) {
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
            case 'creepcolony':
                // All factions now use buildings for supply
                buildingConfig = faction.buildings.supply || faction.supplyUnit;
                // Auto-place supply buildings in a grid pattern
                if (useAutoPlacement) {
                    const supplyTypes = ['supply', 'supplydepot', 'pylon', 'creepcolony'];
                    const existingCount = gameState.buildings.filter(b => supplyTypes.includes(b.type.toLowerCase())).length;

                    // Find first valid grid position
                    let offset = 0;
                    while (true) {
                        const idx = existingCount + offset;
                        placement.x = 15 + (idx % 3) * 4;
                        placement.z = -10 + Math.floor(idx / 3) * 4;
                        const validation = this.isBuildingPositionValid(placement.x, placement.z, buildingType);
                        if (validation.valid) break;

                        offset++;
                        if (offset > 50) break; // Prevent infinite loop
                    }
                }
                break;

            case 'barracks':
            case 'spawningpool':
            case 'gateway':
                buildingConfig = faction.buildings.barracks;
                if (useAutoPlacement) {
                    const barracksTypes = ['barracks', 'spawningpool', 'gateway'];
                    const existingCount = gameState.buildings.filter(b => barracksTypes.includes(b.type.toLowerCase())).length;

                    // Find first valid position
                    let offset = 0;
                    while (true) {
                        const count = existingCount + offset;
                        placement.x = -15 - count * 5;
                        placement.z = 5;
                        const validation = this.isBuildingPositionValid(placement.x, placement.z, buildingType);
                        if (validation.valid) break;
                        offset++;
                        if (offset > 20) break;
                    }
                }
                break;

            case 'factory':
            case 'roachwarren':
            case 'roboticsfacility':
                buildingConfig = faction.buildings.factory;
                if (useAutoPlacement) {
                    const factoryTypes = ['factory', 'roachwarren', 'roboticsfacility'];
                    const existingCount = gameState.buildings.filter(b => factoryTypes.includes(b.type.toLowerCase())).length;

                    // Find first valid position
                    let offset = 0;
                    while (true) {
                        const count = existingCount + offset;
                        placement.x = -15 - count * 5;
                        placement.z = -5;
                        const validation = this.isBuildingPositionValid(placement.x, placement.z, buildingType);
                        if (validation.valid) break;
                        offset++;
                        if (offset > 20) break;
                    }
                }
                break;

            case 'hatchery':
                buildingConfig = faction.buildings.hatchery;
                // Hatchery uses manual placement only (expansion)
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

        // Check for building overlap (skip for gas extractors - they go on geysers)
        if (normalizedType !== 'gasextractor' && normalizedType !== 'extractor' &&
            normalizedType !== 'refinery' && normalizedType !== 'assimilator') {
            const validationResult = this.isBuildingPositionValid(placement.x, placement.z, buildingType);
            if (!validationResult.valid) {
                result.message = validationResult.reason;
                return result;
            }
        }

        // Protoss power field check - buildings with requiresPower must be within a Pylon's field
        if (faction.id === 'protoss' && buildingConfig.requiresPower) {
            if (!this.isWithinPylonField(placement.x, placement.z)) {
                result.message = 'Must be placed within a Pylon\'s power field';
                return result;
            }
        }

        // Check resources
        if (!gameState.canAfford(buildingConfig.cost)) {
            result.message = `Not enough resources. Need ${buildingConfig.cost.minerals} minerals, ${buildingConfig.cost.gas} gas`;
            return result;
        }

        // Special Human logic: SCV must go to site and stay there
        if (faction.id === 'human') {
            // Use selected worker if provided, otherwise find one
            let scv = null;
            if (selectedWorkerId) {
                const selectedUnit = gameState.units.find(u => u.id === selectedWorkerId);
                if (selectedUnit && selectedUnit.type === 'worker') {
                    scv = selectedUnit;
                    // Remove from worker lists if present
                    gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== selectedWorkerId);
                    gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== selectedWorkerId);
                }
            }

            // Fall back to auto-selection if no valid selected worker
            if (!scv) {
                scv = gameState.getIdleWorkers()[0];
                if (!scv && gameState.mineralWorkers.length > 0) {
                    // Take one from minerals
                    const workerId = gameState.mineralWorkers.pop();
                    scv = gameState.units.find(u => u.id === workerId);
                }
            }

            if (!scv) {
                result.message = 'No SCVs available for construction';
                return result;
            }

            // Clear previous orders
            scv.targetResource = null;
            scv.targetX = undefined;
            scv.targetZ = undefined;

            // Spend resources
            gameState.spendResources(buildingConfig.cost);

            // Create building (under construction)
            const building = gameState.addBuilding({
                type: buildingType,
                name: buildingConfig.name,
                x: placement.x,
                z: placement.z,
                health: 10,
                maxHealth: 100,
                isComplete: false
            });

            // Add to production queue (initially paused)
            gameState.addToProductionQueue({
                category: 'building',
                buildingId: building.id,
                type: buildingType,
                name: buildingConfig.name,
                buildTime: buildingConfig.buildTime,
                supplyProvided: buildingConfig.supplyProvided || 0,
                isPaused: true
            });

            // Assign SCV
            scv.state = 'constructing';
            scv.targetBuildingId = building.id;
            scv.targetX = placement.x;
            scv.targetZ = placement.z;

            // Callback for renderer
            if (this.onBuildingCreated) {
                this.onBuildingCreated(building);
            }

            result.success = true;
            result.message = `SCV assigned to build ${buildingConfig.name}`;
            return result;
        }

        // Special Zerg logic: drones are consumed
        if (faction.id === 'zerg') {
            // Use selected worker if provided, otherwise find one
            let drone = null;
            if (selectedWorkerId) {
                const selectedUnit = gameState.units.find(u => u.id === selectedWorkerId);
                if (selectedUnit && selectedUnit.type === 'worker') {
                    drone = selectedUnit;
                    // Remove from worker lists if present
                    gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== selectedWorkerId);
                    gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== selectedWorkerId);
                }
            }

            // Fall back to auto-selection if no valid selected worker
            if (!drone) {
                drone = gameState.getIdleWorkers()[0];
                if (!drone && gameState.mineralWorkers.length > 0) {
                    // Take one from minerals
                    const workerId = gameState.mineralWorkers.pop();
                    drone = gameState.units.find(u => u.id === workerId);
                }
            }

            if (!drone) {
                result.message = 'No drones available for construction';
                return result;
            }

            // Clear previous orders
            drone.targetResource = null;
            drone.targetX = undefined;
            drone.targetZ = undefined;

            // Spend resources
            gameState.spendResources(buildingConfig.cost);

            // Assign drone to construction
            drone.state = 'constructing';
            drone.constructionData = {
                type: buildingType,
                name: buildingConfig.name,
                x: placement.x,
                z: placement.z,
                buildTime: buildingConfig.buildTime,
                supplyProvided: buildingConfig.supplyProvided || 0
            };

            result.success = true;
            result.message = `Drone moving to morph into ${buildingConfig.name}`;
            return result;
        }

        // Special Protoss logic: Probe warps in buildings, then is free to leave
        if (faction.id === 'protoss') {
            // Use selected worker if provided, otherwise find one
            let probe = null;
            if (selectedWorkerId) {
                const selectedUnit = gameState.units.find(u => u.id === selectedWorkerId);
                if (selectedUnit && selectedUnit.type === 'worker') {
                    probe = selectedUnit;
                    // Remove from worker lists if present
                    gameState.mineralWorkers = gameState.mineralWorkers.filter(id => id !== selectedWorkerId);
                    gameState.gasWorkers = gameState.gasWorkers.filter(id => id !== selectedWorkerId);
                }
            }

            // Fall back to auto-selection if no valid selected worker
            if (!probe) {
                probe = gameState.getIdleWorkers()[0];
                if (!probe && gameState.mineralWorkers.length > 0) {
                    // Take one from minerals
                    const workerId = gameState.mineralWorkers.pop();
                    probe = gameState.units.find(u => u.id === workerId);
                }
            }

            if (!probe) {
                result.message = 'No Probes available for construction';
                return result;
            }

            // Clear previous orders
            probe.targetResource = null;
            probe.targetX = undefined;
            probe.targetZ = undefined;

            // Spend resources
            gameState.spendResources(buildingConfig.cost);

            // Assign probe to warp-in construction (probe travels to site, starts warp, then is freed)
            probe.state = 'warping';
            probe.warpData = {
                type: buildingType,
                name: buildingConfig.name,
                x: placement.x,
                z: placement.z,
                buildTime: buildingConfig.buildTime,
                supplyProvided: buildingConfig.supplyProvided || 0
            };
            probe.targetX = placement.x;
            probe.targetZ = placement.z;

            result.success = true;
            result.message = `Probe moving to warp in ${buildingConfig.name}`;
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

    startZergConstruction(constructionData) {
        // This is called when the drone reaches the construction site
        const building = gameState.addBuilding({
            type: constructionData.type,
            name: constructionData.name,
            x: constructionData.x,
            z: constructionData.z,
            health: 100,
            maxHealth: 100,
            isComplete: false
        });

        gameState.addToProductionQueue({
            category: 'building',
            buildingId: building.id,
            type: constructionData.type,
            name: constructionData.name,
            buildTime: constructionData.buildTime,
            supplyProvided: constructionData.supplyProvided || 0
        });

        if (this.onBuildingCreated) {
            this.onBuildingCreated(building);
        }
    }

    // Called when Protoss probe reaches the warp-in site
    startProtossWarpIn(warpData) {
        const building = gameState.addBuilding({
            type: warpData.type,
            name: warpData.name,
            x: warpData.x,
            z: warpData.z,
            health: 100,
            maxHealth: 100,
            isComplete: false
        });

        gameState.addToProductionQueue({
            category: 'building',
            buildingId: building.id,
            type: warpData.type,
            name: warpData.name,
            buildTime: warpData.buildTime,
            supplyProvided: warpData.supplyProvided || 0
        });

        if (this.onBuildingCreated) {
            this.onBuildingCreated(building);
        }
    }

    trainUnit(buildingOrType, unitType) {
        const result = { success: false, message: '' };
        const faction = gameState.faction;

        if (!faction) {
            result.message = 'No faction selected';
            return result;
        }

        // Support both building entity and building type (for backwards compatibility)
        let buildingType, producerId, producerX, producerZ;
        if (typeof buildingOrType === 'object') {
            // Building entity passed
            buildingType = buildingOrType.type;
            producerId = buildingOrType.id;
            producerX = buildingOrType.x;
            producerZ = buildingOrType.z;
        } else {
            // Just type passed (legacy/AI calls)
            buildingType = buildingOrType;
            const producerBuilding = gameState.buildings.find(b => b.type === buildingType && b.isComplete);
            producerId = producerBuilding?.id || buildingType;
            producerX = producerBuilding?.x || 0;
            producerZ = producerBuilding?.z || 0;
        }

        // Special case for Overlords (Zerg supply)
        if (unitType === 'overlord' && faction.id === 'zerg') {
            const overlordConfig = faction.supplyUnit;
            if (!gameState.canAfford(overlordConfig.cost)) {
                result.message = `Not enough resources. Need ${overlordConfig.cost.minerals} minerals`;
                return result;
            }

            gameState.spendResources(overlordConfig.cost);
            gameState.addToProductionQueue({
                category: 'unit',
                unitType: 'overlord',
                name: overlordConfig.name,
                buildTime: overlordConfig.buildTime,
                population: 0,
                health: 200,
                isSupplyUnit: true,
                supplyProvided: overlordConfig.supplyProvided,
                producerId,
                producerType: 'base',
                producerX,
                producerZ
            });
            result.success = true;
            result.message = `Spawning ${overlordConfig.name}`;
            return result;
        }

        let unitConfig;
        // Normalize unit type
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

        if (!gameState.canAddPopulation(populationCost)) {
            result.message = 'Population cap reached. Build more supply structures.';
            return result;
        }

        if (!gameState.canAfford(unitConfig.cost)) {
            result.message = `Not enough resources. Need ${unitConfig.cost.minerals} minerals, ${unitConfig.cost.gas} gas`;
            return result;
        }

        gameState.spendResources(unitConfig.cost);
        gameState.addToProductionQueue({
            category: 'unit',
            unitType: normalizedType,
            name: unitConfig.name,
            buildTime: unitConfig.buildTime,
            population: populationCost,
            health: unitConfig.health || 40,
            producerId,
            producerType: buildingType,
            producerX,
            producerZ
        });

        result.success = true;
        result.message = `Training ${unitConfig.name}`;
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

    // Check if a building position is valid (not overlapping with other buildings)
    isBuildingPositionValid(x, z, buildingType) {
        // Building sizes (radius from center)
        const buildingSizes = {
            'supply': 2,
            'supplydepot': 2,
            'pylon': 2,
            'barracks': 3,
            'spawningpool': 3,
            'gateway': 3,
            'factory': 3.5,
            'roachwarren': 3.5,
            'roboticsfacility': 3.5,
            'base': 6
        };

        const normalizedType = buildingType.toLowerCase();
        const newBuildingSize = buildingSizes[normalizedType] || 3;
        const minDistance = 6; // Minimum distance between building centers

        // Check against all existing buildings
        for (const building of gameState.buildings) {
            const existingSize = buildingSizes[building.type?.toLowerCase()] || 3;
            const requiredDistance = Math.max(minDistance, newBuildingSize + existingSize);

            const dx = building.x - x;
            const dz = building.z - z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < requiredDistance) {
                return { valid: false, reason: 'Too close to another building' };
            }
        }

        // Also check against resource nodes (minerals and gas)
        for (const patch of gameState.mineralPatches) {
            const dx = patch.x - x;
            const dz = patch.z - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 5) {
                return { valid: false, reason: 'Too close to mineral patch' };
            }
        }

        for (const geyser of gameState.gasGeysers) {
            const dx = geyser.x - x;
            const dz = geyser.z - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < 4) {
                return { valid: false, reason: 'Cannot build on a gas geyser - only gas extractors allowed' };
            }
        }

        return { valid: true };
    }

    // Check if a position is within any completed Pylon's power field (Protoss only)
    isWithinPylonField(x, z) {
        const faction = gameState.faction;
        if (!faction || faction.id !== 'protoss') return true;

        const pylonRadius = faction.buildings.supply?.powerFieldRadius || 8;
        const pylons = gameState.buildings.filter(b =>
            b.isComplete &&
            (b.type?.toLowerCase() === 'pylon' || b.type?.toLowerCase() === 'supply')
        );

        for (const pylon of pylons) {
            const dx = pylon.x - x;
            const dz = pylon.z - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance <= pylonRadius) {
                return true;
            }
        }

        return false;
    }
}

export default GameActions;
