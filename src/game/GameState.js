/**
 * Game State Management
 * Central state for resources, units, buildings, and game progression
 */

import { getFaction } from './Faction.js';

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

        // Starting workers
        const workerCount = 6;
        for (let i = 0; i < workerCount; i++) {
            const angle = (i / workerCount) * Math.PI * 2;
            const worker = this.addUnit({
                type: 'worker',
                name: this.faction.worker.name,
                x: Math.cos(angle) * 3,
                z: Math.sin(angle) * 3,
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
            this.population -= 1;
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
    assignWorkerToMinerals(workerId) {
        const worker = this.units.find(u => u.id === workerId);
        if (worker && worker.type === 'worker') {
            // Find nearest mineral patch with capacity
            const availablePatch = this.mineralPatches.find(p => p.amount > 0);
            if (availablePatch) {
                worker.state = 'mining';
                worker.targetResource = availablePatch.id;
                this.mineralWorkers.push(workerId);
                this.emit('workerAssigned', { worker, resource: availablePatch });
                return true;
            }
        }
        return false;
    }

    assignWorkerToGas(workerId) {
        const worker = this.units.find(u => u.id === workerId);
        if (worker && worker.type === 'worker') {
            // Find geyser with extractor
            const availableGeyser = this.gasGeysers.find(g => g.hasExtractor && g.amount > 0);
            if (availableGeyser) {
                worker.state = 'harvesting_gas';
                worker.targetResource = availableGeyser.id;
                this.gasWorkers.push(workerId);
                this.emit('workerAssigned', { worker, resource: availableGeyser });
                return true;
            }
        }
        return false;
    }

    // Resource gathering (called on game tick)
    gatherResources(deltaTime) {
        const miningRate = 5; // minerals per second per worker
        const gasRate = 4; // gas per second per worker

        // Mineral gathering
        this.mineralWorkers.forEach(workerId => {
            const worker = this.units.find(u => u.id === workerId);
            if (worker && worker.state === 'mining') {
                const patch = this.mineralPatches.find(p => p.id === worker.targetResource);
                if (patch && patch.amount > 0) {
                    const gathered = Math.min(miningRate * deltaTime, patch.amount);
                    patch.amount -= gathered;
                    this.minerals += gathered;
                } else {
                    // Find another patch
                    worker.state = 'idle';
                    this.mineralWorkers = this.mineralWorkers.filter(id => id !== workerId);
                }
            }
        });

        // Gas gathering
        this.gasWorkers.forEach(workerId => {
            const worker = this.units.find(u => u.id === workerId);
            if (worker && worker.state === 'harvesting_gas') {
                const geyser = this.gasGeysers.find(g => g.id === worker.targetResource);
                if (geyser && geyser.amount > 0 && geyser.hasExtractor) {
                    const gathered = Math.min(gasRate * deltaTime, geyser.amount);
                    geyser.amount -= gathered;
                    this.gas += gathered;
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

        this.productionQueue.forEach(item => {
            item.progress += deltaTime;

            if (item.progress >= item.buildTime) {
                completed.push(item);
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
            // Find a spawn point near base
            const base = this.buildings.find(b => b.type === 'base');
            const spawnX = base ? base.x + (Math.random() - 0.5) * 8 : 0;
            const spawnZ = base ? base.z + (Math.random() - 0.5) * 8 : 0;

            this.addUnit({
                type: item.unitType,
                name: item.name,
                x: spawnX,
                z: spawnZ,
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

                // Handle gas extractors
                if (item.type === 'gasExtractor') {
                    const geyser = this.gasGeysers.find(g =>
                        Math.abs(g.x - building.x) < 2 && Math.abs(g.z - building.z) < 2
                    );
                    if (geyser) {
                        geyser.hasExtractor = true;
                    }
                }
            }
        }

        this.emit('productionComplete', item);
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
