/**
 * Game State Management
 * Central state for resources, units, buildings, and game progression
 */

import { getFaction } from './Faction.js';
import { getBuildingDimensions } from './BuildingConfig.js';
import { getUnitConfig } from './UnitConfig.js';

const STORAGE_KEY = 'galactic_command_save';
const MAX_POPULATION = 200;

class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this.faction = null;
        this.gameStartTime = null;
        this.gameTime = 0; // in seconds

        // Resources
        this.minerals = 50;
        this.gas = 0;

        // Population
        this.population = 0;
        this.populationMax = 10;

        // Collections
        this.buildings = [];
        this.units = [];
        this.productionQueue = [];

        // Resource nodes
        this.mineralPatches = [];
        this.gasGeysers = [];

        // Workers assigned to resources
        this.mineralWorkers = [];
        this.gasWorkers = [];

        // Zerg larva system
        this.larvaByHatchery = new Map(); // hatcheryId -> [larvaIds]
        this.lastLarvaSpawn = new Map(); // hatcheryId -> timestamp (seconds)

        // Event listeners
        this.listeners = new Map();
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // Initialize new game
    startNewGame(factionId) {
        this.reset();
        this.faction = getFaction(factionId);
        this.gameStartTime = Date.now();

        // Create starting resources
        this.createStartingResources();

        // Create starting units and buildings
        this.createStartingBase();

        this.emit('gameStarted', { faction: this.faction });
    }

    createStartingResources() {
        // Create mineral patches around the base
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI + Math.PI * 0.3;
            const distance = 15 + Math.random() * 5;
            this.mineralPatches.push({
                id: `mineral_${i}`,
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                amount: 1500,
                maxAmount: 1500
            });
        }

        // Create gas geysers
        for (let i = 0; i < 2; i++) {
            const angle = (i === 0) ? Math.PI * 0.8 : Math.PI * 1.2;
            const distance = 12;
            this.gasGeysers.push({
                id: `geyser_${i}`,
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                amount: 2500,
                maxAmount: 2500,
                hasExtractor: false
            });
        }
    }

    createStartingBase() {
        // Main base building
        const base = this.faction.buildings.base;
        this.addBuilding({
            type: 'base',
            name: base.name,
            x: 0,
            z: 0,
            health: 1500,
            maxHealth: 1500,
            isComplete: true,
            rallyPoint: { x: 5, z: 5 }
        });

        // Add supply from base
        this.populationMax = base.supplyProvided;

        // Starting workers - spawn outside the base with proper spacing
        const workerCount = 4;
        const minDistance = 2.0; // Minimum distance between workers
        const spawnRadius = 8; // Distance from base center (outside the base)

        for (let i = 0; i < workerCount; i++) {
            // Distribute workers evenly around the base
            const baseAngle = (i / workerCount) * Math.PI * 2;

            // Find a non-overlapping position
            let spawnX, spawnZ;
            let attempts = 0;
            const maxAttempts = 10;

            do {
                // Add small random offset to the angle for variety
                const angleOffset = (Math.random() - 0.5) * 0.3;
                const angle = baseAngle + angleOffset;
                const radiusOffset = Math.random() * 2; // 8-10 units from center
                const radius = spawnRadius + radiusOffset;

                spawnX = Math.cos(angle) * radius;
                spawnZ = Math.sin(angle) * radius;
                attempts++;
            } while (attempts < maxAttempts && this.isPositionOccupied(spawnX, spawnZ, minDistance));

            const worker = this.addUnit({
                type: 'worker',
                name: this.faction.worker.name,
                x: spawnX,
                z: spawnZ,
                health: 40,
                maxHealth: 40,
                state: 'idle'
            });

            // Auto-assign some workers to minerals
            if (i < 4) {
                this.assignWorkerToMinerals(worker.id);
            }
        }

        this.population = workerCount;

        // Spawn initial larva for Zerg faction
        if (this.faction.id === 'zerg') {
            const base = this.buildings.find(b => b.type === 'base');
            if (base) {
                this.spawnInitialLarva(base);
            }
        }
    }

    // Check if a position is too close to any existing unit
    isPositionOccupied(x, z, minDistance) {
        return this.units.some(unit => {
            const dx = unit.x - x;
            const dz = unit.z - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            return distance < minDistance;
        });
    }

    // Find a spawn position that doesn't overlap with existing units
    findNonOverlappingSpawnPosition(baseX, baseZ, spawnRadius, minDistance = 2.0) {
        const maxAttempts = 20;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const radiusOffset = Math.random() * 3; // Add some variation
            const radius = spawnRadius + radiusOffset;

            const spawnX = baseX + Math.cos(angle) * radius;
            const spawnZ = baseZ + Math.sin(angle) * radius;

            if (!this.isPositionOccupied(spawnX, spawnZ, minDistance)) {
                return { x: spawnX, z: spawnZ };
            }
        }

        // Fallback: return a position even if it overlaps (rare case)
        const angle = Math.random() * Math.PI * 2;
        return {
            x: baseX + Math.cos(angle) * spawnRadius,
            z: baseZ + Math.sin(angle) * spawnRadius
        };
    }

    // Building management
    addBuilding(buildingData) {
        const building = {
            id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...buildingData,
            createdAt: Date.now()
        };
        this.buildings.push(building);
        this.emit('buildingAdded', building);
        return building;
    }

    removeBuilding(buildingId) {
        const index = this.buildings.findIndex(b => b.id === buildingId);
        if (index > -1) {
            const building = this.buildings.splice(index, 1)[0];
            this.emit('buildingRemoved', building);
            return building;
        }
        return null;
    }

    getBuildingsByType(type) {
        return this.buildings.filter(b => b.type === type);
    }

    // Unit management
    addUnit(unitData) {
        const unit = {
            id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...unitData,
            createdAt: Date.now()
        };
        this.units.push(unit);
        this.emit('unitAdded', unit);
        return unit;
    }

    removeUnit(unitId) {
        const index = this.units.findIndex(u => u.id === unitId);
        if (index > -1) {
            const unit = this.units.splice(index, 1)[0];

            // Clean up from worker assignments
            this.mineralWorkers = this.mineralWorkers.filter(id => id !== unitId);
            this.gasWorkers = this.gasWorkers.filter(id => id !== unitId);

            // Only decrement population for units that cost population
            // Larva and eggs don't consume population
            if (unit.type !== 'larva' && unit.type !== 'egg') {
                this.population -= 1;
            }

            this.emit('unitRemoved', unit);
            return unit;
        }
        return null;
    }

    getUnitsByType(type) {
        return this.units.filter(u => u.type === type);
    }

    getIdleWorkers() {
        return this.units.filter(u => u.type === 'worker' && u.state === 'idle');
    }

    // Worker assignment
    assignWorkerToMinerals(workerId, targetResourceId = null) {
        const worker = this.units.find(u => u.id === workerId);
        if (worker && worker.type === 'worker') {
            // Find the specific patch or pick a random one with fewest workers
            let targetPatch;
            if (targetResourceId) {
                targetPatch = this.mineralPatches.find(p => p.id === targetResourceId && p.amount > 0);
            }
            if (!targetPatch) {
                // Get all available patches
                const availablePatches = this.mineralPatches.filter(p => p.amount > 0);

                if (availablePatches.length > 0) {
                    // Count workers per patch
                    const workerCountByPatch = new Map();
                    availablePatches.forEach(p => workerCountByPatch.set(p.id, 0));

                    this.mineralWorkers.forEach(wId => {
                        const w = this.units.find(u => u.id === wId);
                        if (w && workerCountByPatch.has(w.targetResource)) {
                            workerCountByPatch.set(w.targetResource, workerCountByPatch.get(w.targetResource) + 1);
                        }
                    });

                    // Find the minimum worker count
                    const minWorkers = Math.min(...workerCountByPatch.values());

                    // Get all patches with the minimum worker count
                    const leastCrowdedPatches = availablePatches.filter(
                        p => workerCountByPatch.get(p.id) === minWorkers
                    );

                    // Randomly pick from the least crowded patches
                    targetPatch = leastCrowdedPatches[Math.floor(Math.random() * leastCrowdedPatches.length)];
                }
            }

            if (targetPatch) {
                worker.state = 'mining';
                worker.targetResource = targetPatch.id;
                if (!this.mineralWorkers.includes(workerId)) {
                    this.mineralWorkers.push(workerId);
                }
                this.emit('workerAssigned', { worker, resource: targetPatch });
                return true;
            }
        }
        return false;
    }

    assignWorkerToGas(workerId, targetResourceId = null) {
        const worker = this.units.find(u => u.id === workerId);
        if (worker && worker.type === 'worker') {
            // Find the specific geyser or any available one with extractor
            let targetGeyser;
            if (targetResourceId) {
                targetGeyser = this.gasGeysers.find(g => g.id === targetResourceId && g.hasExtractor && g.amount > 0);
            }
            if (!targetGeyser) {
                targetGeyser = this.gasGeysers.find(g => g.hasExtractor && g.amount > 0);
            }

            if (targetGeyser) {
                worker.state = 'harvesting_gas';
                worker.targetResource = targetGeyser.id;
                if (!this.gasWorkers.includes(workerId)) {
                    this.gasWorkers.push(workerId);
                }
                this.emit('workerAssigned', { worker, resource: targetGeyser });
                return true;
            }
        }
        return false;
    }

    // Resource gathering (called on game tick)
    gatherResources(deltaTime) {
        const miningRate = 25; // minerals per second when mining (takes 2 sec to fill 50)
        const gasRate = 20; // gas per second when gathering
        const gatherRange = 2.5; // Must be within this distance to gather
        const cargoCapacity = 50; // Amount worker can carry

        // Mineral gathering
        this.mineralWorkers.forEach(workerId => {
            const worker = this.units.find(u => u.id === workerId);
            if (!worker) return;

            // Initialize cargo if not set
            if (worker.carriedMinerals === undefined) {
                worker.carriedMinerals = 0;
            }

            if (worker.state === 'mining') {
                const patch = this.mineralPatches.find(p => p.id === worker.targetResource);
                if (patch && patch.amount > 0) {
                    // Check if worker is close enough to gather
                    const dx = patch.x - worker.x;
                    const dz = patch.z - worker.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);

                    if (distance <= gatherRange) {
                        // Gather minerals into cargo
                        const canGather = cargoCapacity - worker.carriedMinerals;
                        const toGather = Math.min(miningRate * deltaTime, patch.amount, canGather);
                        patch.amount -= toGather;
                        worker.carriedMinerals += toGather;

                        // Check if cargo is full
                        if (worker.carriedMinerals >= cargoCapacity) {
                            worker.state = 'returning_minerals';
                            this.emit('workerCargoFull', { worker, resourceType: 'minerals' });
                        }
                    }
                } else {
                    // Patch depleted, find another or go idle
                    if (worker.carriedMinerals > 0) {
                        worker.state = 'returning_minerals';
                    } else {
                        worker.state = 'idle';
                        this.mineralWorkers = this.mineralWorkers.filter(id => id !== workerId);
                    }
                }
            } else if (worker.state === 'returning_minerals') {
                // Check if close to base to deposit
                const base = this.buildings.find(b => b.type === 'base');
                if (base) {
                    const dx = base.x - worker.x;
                    const dz = base.z - worker.z;
                    const dims = getBuildingDimensions(base.type);
                    if (dims) {
                        // Use collision box as deposit range
                        // A worker can deposit if they are at the edge of the collision box (+ margin)
                        const halfW = dims.collisionWidth / 2;
                        const halfD = dims.collisionDepth / 2;
                        const unitConfig = getUnitConfig(worker.type);
                        const margin = (unitConfig?.radius || 0.8) + 0.5; // allowance for unit radius + small buffer

                        if (Math.abs(dx) <= halfW + margin && Math.abs(dz) <= halfD + margin) {
                            // Deposit minerals
                            this.minerals += worker.carriedMinerals;
                            worker.carriedMinerals = 0;
                            worker.state = 'mining'; // Go back to mining
                            this.emit('workerDeposited', { worker, resourceType: 'minerals' });
                        }
                    }
                }
            }
        });

        // Gas gathering
        this.gasWorkers.forEach(workerId => {
            const worker = this.units.find(u => u.id === workerId);
            if (!worker) return;

            // Initialize cargo if not set
            if (worker.carriedGas === undefined) {
                worker.carriedGas = 0;
            }

            // Ensure worker has a valid target geyser
            if (!worker.targetResource) {
                const availableGeyser = this.gasGeysers.find(g => g.hasExtractor && g.amount > 0);
                if (availableGeyser) {
                    worker.targetResource = availableGeyser.id;
                    worker.state = 'harvesting_gas';
                } else {
                    worker.state = 'idle';
                    return;
                }
            }

            // Ensure worker is in a gas-related state (recovery for stuck workers)
            if (worker.state !== 'harvesting_gas' && worker.state !== 'returning_gas') {
                // Worker is in gasWorkers list but not in gas state - fix it
                if (worker.carriedGas > 0) {
                    worker.state = 'returning_gas';
                } else {
                    worker.state = 'harvesting_gas';
                }
            }

            if (worker.state === 'harvesting_gas') {
                const geyser = this.gasGeysers.find(g => g.id === worker.targetResource);
                if (geyser && geyser.amount > 0 && geyser.hasExtractor) {
                    const dx = geyser.x - worker.x;
                    const dz = geyser.z - worker.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);

                    if (distance <= gatherRange) {
                        // Gather gas into cargo
                        const canGather = cargoCapacity - worker.carriedGas;
                        const toGather = Math.min(gasRate * deltaTime, geyser.amount, canGather);
                        geyser.amount -= toGather;
                        worker.carriedGas += toGather;

                        // Check if cargo is full
                        if (worker.carriedGas >= cargoCapacity) {
                            worker.state = 'returning_gas';
                            this.emit('workerCargoFull', { worker, resourceType: 'gas' });
                        }
                    }
                    // If not in range, the movement code in main.js will move the worker
                } else if (!geyser || !geyser.hasExtractor) {
                    // Geyser no longer valid, try to find another
                    const availableGeyser = this.gasGeysers.find(g => g.hasExtractor && g.amount > 0);
                    if (availableGeyser) {
                        worker.targetResource = availableGeyser.id;
                    } else {
                        // No gas available, go idle
                        worker.state = 'idle';
                        this.gasWorkers = this.gasWorkers.filter(id => id !== workerId);
                    }
                } else if (geyser.amount <= 0) {
                    // Geyser depleted
                    worker.state = 'idle';
                    this.gasWorkers = this.gasWorkers.filter(id => id !== workerId);
                }
            } else if (worker.state === 'returning_gas') {
                // Check if close to base to deposit
                const base = this.buildings.find(b => b.type === 'base');
                if (base) {
                    const dx = base.x - worker.x;
                    const dz = base.z - worker.z;
                    const dims = getBuildingDimensions(base.type);
                    if (dims) {
                        const halfW = dims.collisionWidth / 2;
                        const halfD = dims.collisionDepth / 2;
                        const unitConfig = getUnitConfig(worker.type);
                        const margin = (unitConfig?.radius || 0.8) + 0.5; // allowance for unit radius + small buffer

                        if (Math.abs(dx) <= halfW + margin && Math.abs(dz) <= halfD + margin) {
                            // Deposit gas
                            this.gas += worker.carriedGas;
                            worker.carriedGas = 0;
                            worker.state = 'harvesting_gas'; // Go back to harvesting
                            this.emit('workerDeposited', { worker, resourceType: 'gas' });
                        }
                    }
                }
            }
        });

        this.emit('resourcesUpdated', { minerals: this.minerals, gas: this.gas });
    }

    // Production
    canAfford(cost) {
        return this.minerals >= cost.minerals && this.gas >= cost.gas;
    }

    canAddPopulation(amount) {
        return this.population + amount <= this.populationMax &&
            this.population + amount <= MAX_POPULATION;
    }

    spendResources(cost) {
        if (this.canAfford(cost)) {
            this.minerals -= cost.minerals;
            this.gas -= cost.gas;
            this.emit('resourcesUpdated', { minerals: this.minerals, gas: this.gas });
            return true;
        }
        return false;
    }

    addToProductionQueue(item) {
        this.productionQueue.push({
            ...item,
            startTime: Date.now(),
            progress: 0
        });
        this.emit('productionStarted', item);
    }

    updateProductionQueue(deltaTime) {
        const completed = [];

        // Group items by producer to ensure sequential production per building
        const activeByProducer = new Map();

        this.productionQueue.forEach(item => {
            if (item.isPaused) return;

            // Determine the producer key (unique per building instance)
            const producerKey = item.producerId || item.buildingId || item.producerType || 'default';

            // Only the FIRST item for each producer should progress
            if (!activeByProducer.has(producerKey)) {
                activeByProducer.set(producerKey, item);

                const speedMultiplier = item.speedMultiplier || 1.0;
                item.progress += deltaTime * speedMultiplier;

                // Use small tolerance to avoid floating point issues
                if (item.progress >= item.buildTime - 0.01) {
                    completed.push(item);
                }
            }
        });

        completed.forEach(item => {
            this.completeProduction(item);
        });

        this.productionQueue = this.productionQueue.filter(
            item => !completed.includes(item)
        );
    }

    completeProduction(item) {
        if (item.category === 'unit') {
            // Use producer building position if available, otherwise fall back to base
            let spawnBaseX = item.producerX;
            let spawnBaseZ = item.producerZ;

            // Fallback to base if producer position not set
            if (spawnBaseX === undefined || spawnBaseZ === undefined) {
                const base = this.buildings.find(b => b.type === 'base');
                spawnBaseX = base ? base.x : 0;
                spawnBaseZ = base ? base.z : 0;
            }

            const spawnDistance = 6; // Spawn distance from building
            const minUnitDistance = 2.0; // Minimum distance between units

            // For Zerg evolution, remove the egg first and spawn at egg position
            if (item.isEvolution && item.eggId) {
                const egg = this.units.find(u => u.id === item.eggId);
                if (egg) {
                    spawnBaseX = egg.x;
                    spawnBaseZ = egg.z;
                    // Remove egg from units
                    this.removeUnit(egg.id);
                    this.emit('eggHatched', { eggId: item.eggId });
                }
            }

            const spawnPos = item.isEvolution ?
                { x: spawnBaseX, z: spawnBaseZ } : // Evolution: spawn at egg position
                this.findNonOverlappingSpawnPosition(spawnBaseX, spawnBaseZ, spawnDistance, minUnitDistance);

            this.addUnit({
                type: item.unitType,
                name: item.name,
                x: spawnPos.x,
                z: spawnPos.z,
                health: item.health || 100,
                maxHealth: item.health || 100,
                state: 'idle',
                isSupplyUnit: item.isSupplyUnit || false
            });

            // Handle supply units (Overlord) - increase population cap
            if (item.isSupplyUnit && item.supplyProvided) {
                this.populationMax = Math.min(
                    this.populationMax + item.supplyProvided,
                    MAX_POPULATION
                );
            } else {
                this.population += item.population || 1;
            }
        } else if (item.category === 'building') {
            const building = this.buildings.find(b => b.id === item.buildingId);
            if (building) {
                building.isComplete = true;

                // Handle supply buildings
                if (item.supplyProvided) {
                    this.populationMax = Math.min(
                        this.populationMax + item.supplyProvided,
                        MAX_POPULATION
                    );
                }

                // Handle gas extractors (check all aliases)
                const gasTypes = ['gasextractor', 'extractor', 'refinery', 'assimilator'];
                if (gasTypes.includes(item.type?.toLowerCase())) {
                    const geyser = this.gasGeysers.find(g =>
                        Math.abs(g.x - building.x) < 2 && Math.abs(g.z - building.z) < 2
                    );
                    if (geyser) {
                        geyser.hasExtractor = true;
                        this.emit('geyserExtractorBuilt', { geyser });
                    }
                }

                // If Human, find ALL SCVs that were building this and make them idle
                if (this.faction.id === 'human') {
                    this.units.forEach(u => {
                        if (u.type === 'worker' && u.state === 'constructing' && u.targetBuildingId === item.buildingId) {
                            u.state = 'idle';
                            u.targetBuildingId = null;
                        }
                    });
                }
            }
        }

        this.emit('productionComplete', item);
    }

    // ============== ZERG LARVA SYSTEM ==============

    // Spawn initial larva for a Hatchery (called at game start)
    spawnInitialLarva(hatchery) {
        const config = this.faction.buildings.base;
        const larvaMax = config.larvaMax || 3;

        this.larvaByHatchery.set(hatchery.id, []);
        this.lastLarvaSpawn.set(hatchery.id, this.gameTime);

        for (let i = 0; i < larvaMax; i++) {
            this.spawnLarva(hatchery);
        }
    }

    // Spawn a single larva near a Hatchery
    spawnLarva(hatchery) {
        const config = this.faction.buildings.base;
        const larvaMax = config.larvaMax || 3;

        const currentLarva = this.larvaByHatchery.get(hatchery.id) || [];
        // Filter out any removed larva
        const validLarva = currentLarva.filter(id => this.units.find(u => u.id === id));
        this.larvaByHatchery.set(hatchery.id, validLarva);

        if (validLarva.length >= larvaMax) return null;

        // Spawn position close to hatchery (StarCraft style)
        const angle = Math.random() * Math.PI * 2;
        const distance = 6 + Math.random() * 2; // Close to Hatchery (6-8 units)
        const spawnX = hatchery.x + Math.cos(angle) * distance;
        const spawnZ = hatchery.z + Math.sin(angle) * distance;

        const larva = this.addUnit({
            type: 'larva',
            name: 'Larva',
            x: spawnX,
            z: spawnZ,
            health: 25,
            maxHealth: 25,
            state: 'idle',
            parentHatcheryId: hatchery.id
        });

        validLarva.push(larva.id);
        this.larvaByHatchery.set(hatchery.id, validLarva);

        this.emit('larvaSpawned', { larva, hatchery });
        return larva;
    }

    // Get larva count for a Hatchery
    getLarvaForHatchery(hatcheryId) {
        const larvaIds = this.larvaByHatchery.get(hatcheryId) || [];
        return larvaIds.filter(id => this.units.find(u => u.id === id));
    }

    // Update larva spawning (call every game tick)
    updateLarvaSpawning() {
        if (this.faction?.id !== 'zerg') return;

        const config = this.faction.buildings.base;
        const spawnInterval = config.larvaSpawnInterval || 30;

        // Find all Hatcheries (base type and hatchery type)
        const hatcheries = this.buildings.filter(b =>
            (b.type === 'base' || b.type === 'hatchery') && b.isComplete
        );

        hatcheries.forEach(hatchery => {
            // Initialize if not tracked
            if (!this.larvaByHatchery.has(hatchery.id)) {
                this.larvaByHatchery.set(hatchery.id, []);
                this.lastLarvaSpawn.set(hatchery.id, this.gameTime);
            }

            const lastSpawn = this.lastLarvaSpawn.get(hatchery.id) || 0;
            const timeSinceSpawn = this.gameTime - lastSpawn;

            if (timeSinceSpawn >= spawnInterval) {
                const spawned = this.spawnLarva(hatchery);
                if (spawned) {
                    this.lastLarvaSpawn.set(hatchery.id, this.gameTime);
                }
            }
        });
    }

    // Evolve a larva into a unit
    evolveLarva(larvaId, targetUnitType) {
        const larva = this.units.find(u => u.id === larvaId && u.type === 'larva');
        if (!larva) return { success: false, error: 'Larva not found' };

        // Check what units this larva can become
        const larvaConfig = this.faction.units.larva;
        if (!larvaConfig.canEvolveInto.includes(targetUnitType)) {
            return { success: false, error: 'Cannot evolve into that unit' };
        }

        // Get target unit config (check units, worker, supplyUnit)
        let unitConfig;
        if (targetUnitType === 'drone') {
            unitConfig = this.faction.worker;
        } else if (targetUnitType === 'overlord') {
            unitConfig = this.faction.supplyUnit;
        } else {
            unitConfig = this.faction.units[targetUnitType];
        }

        if (!unitConfig) return { success: false, error: 'Unknown unit type' };

        // Check tech requirements
        if (unitConfig.requiresBuilding) {
            const hasBuilding = this.buildings.some(b =>
                b.type === unitConfig.requiresBuilding && b.isComplete
            );
            if (!hasBuilding) {
                return { success: false, error: 'Requires tech building' };
            }
        }

        // Check cost
        if (!this.canAfford(unitConfig.cost)) {
            return { success: false, error: 'Not enough resources' };
        }

        // Check population (except for Overlord which adds supply)
        const isSupplyUnit = targetUnitType === 'overlord';
        const popCost = unitConfig.population || 1;
        if (!isSupplyUnit && !this.canAddPopulation(popCost)) {
            return { success: false, error: 'Not enough supply' };
        }

        // Spend resources
        this.spendResources(unitConfig.cost);

        // Convert larva to egg (keeps same ID for tracking)
        larva.type = 'egg';
        larva.name = `Evolving ${unitConfig.name}`;
        larva.evolvingTo = targetUnitType;
        larva.evolveUnitType = targetUnitType === 'drone' ? 'worker' : targetUnitType;
        larva.evolveBuildTime = unitConfig.buildTime;
        larva.evolveProgress = 0;
        larva.evolveHealth = unitConfig.health || 40;
        larva.evolvePopulation = popCost;
        larva.evolveIsSupplyUnit = isSupplyUnit;
        larva.evolveSupplyProvided = unitConfig.supplyProvided || 0;

        // Remove from larva tracking
        if (larva.parentHatcheryId && this.larvaByHatchery.has(larva.parentHatcheryId)) {
            const larvaIds = this.larvaByHatchery.get(larva.parentHatcheryId);
            const index = larvaIds.indexOf(larva.id);
            if (index > -1) {
                larvaIds.splice(index, 1);
            }
        }

        // Add to production queue (evolving in place)
        this.addToProductionQueue({
            category: 'unit',
            unitType: larva.evolveUnitType,
            name: unitConfig.name,
            buildTime: unitConfig.buildTime,
            population: popCost,
            health: unitConfig.health || 40,
            producerId: larva.parentHatcheryId,
            producerType: 'hatchery',
            producerX: larva.x,
            producerZ: larva.z,
            isSupplyUnit: isSupplyUnit,
            supplyProvided: unitConfig.supplyProvided || 0,
            isEvolution: true,
            eggId: larvaId  // Track which egg this production belongs to
        });

        this.emit('larvaEvolutionStarted', { larvaId, targetUnitType, eggData: larva });
        return { success: true };
    }

    // Remove a larva (when evolving or dying)
    removeLarva(larva) {
        // Remove from units array
        this.removeUnit(larva.id);

        // Remove from Hatchery tracking
        if (larva.parentHatcheryId && this.larvaByHatchery.has(larva.parentHatcheryId)) {
            const larvaIds = this.larvaByHatchery.get(larva.parentHatcheryId);
            const index = larvaIds.indexOf(larva.id);
            if (index > -1) {
                larvaIds.splice(index, 1);
            }
        }
    }

    // Game time
    updateGameTime(deltaTime) {
        this.gameTime += deltaTime;
        this.emit('timeUpdated', this.gameTime);
    }

    getFormattedGameTime() {
        const minutes = Math.floor(this.gameTime / 60);
        const seconds = Math.floor(this.gameTime % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // Save/Load
    save() {
        const saveData = {
            faction: this.faction?.id,
            gameTime: this.gameTime,
            minerals: this.minerals,
            gas: this.gas,
            population: this.population,
            populationMax: this.populationMax,
            buildings: this.buildings,
            units: this.units,
            mineralPatches: this.mineralPatches,
            gasGeysers: this.gasGeysers,
            mineralWorkers: this.mineralWorkers,
            gasWorkers: this.gasWorkers,
            productionQueue: this.productionQueue,
            savedAt: Date.now()
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
            this.emit('gameSaved', saveData);
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return false;

            const saveData = JSON.parse(data);

            this.faction = getFaction(saveData.faction);
            this.gameTime = saveData.gameTime;
            this.minerals = saveData.minerals;
            this.gas = saveData.gas;
            this.population = saveData.population;
            this.populationMax = saveData.populationMax;
            this.buildings = saveData.buildings;
            this.units = saveData.units;
            this.mineralPatches = saveData.mineralPatches;
            this.gasGeysers = saveData.gasGeysers;
            this.mineralWorkers = saveData.mineralWorkers;
            this.gasWorkers = saveData.gasWorkers;
            this.productionQueue = saveData.productionQueue || [];

            this.emit('gameLoaded', saveData);
            return true;
        } catch (e) {
            console.error('Failed to load game:', e);
            return false;
        }
    }

    hasSavedGame() {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    deleteSave() {
        localStorage.removeItem(STORAGE_KEY);
    }

    // Getters for UI
    getState() {
        return {
            faction: this.faction,
            minerals: Math.floor(this.minerals),
            gas: Math.floor(this.gas),
            population: this.population,
            populationMax: this.populationMax,
            buildings: this.buildings,
            units: this.units,
            gameTime: this.getFormattedGameTime()
        };
    }
}

// Singleton instance
export const gameState = new GameState();
export default gameState;
