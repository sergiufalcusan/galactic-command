/**
 * Galactic Command - Main Entry Point
 * Browser-based real-time strategy game with AI advisors
 */

import gameState from './game/GameState.js';
import GameScene from './rendering/Scene.js';
import TerrainRenderer from './rendering/Terrain.js';
import UnitRenderer from './rendering/UnitRenderer.js';
import BuildingRenderer from './rendering/BuildingRenderer.js';
import AIAgent from './ai/Agent.js';
import GameActions from './game/GameActions.js';
import InputHandler from './game/InputHandler.js';
import MainMenu from './ui/MainMenu.js';
import FactionSelect from './ui/FactionSelect.js';
import ChatInterface from './ui/ChatInterface.js';
import HUD from './ui/HUD.js';
import BuildingPlacementUI from './ui/BuildingPlacementUI.js';

class Game {
    constructor() {
        // Core systems
        this.scene = null;
        this.terrainRenderer = null;
        this.unitRenderer = null;
        this.buildingRenderer = null;

        // UI
        this.mainMenu = null;
        this.factionSelect = null;
        this.chatInterface = null;
        this.hud = null;

        // AI
        this.aiAgent = null;
        this.gameActions = null;

        // Input
        this.inputHandler = null;

        // Game loop
        this.isRunning = false;
        this.lastTime = 0;
        this.animationTime = 0;

        // Screens
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            factionSelect: document.getElementById('faction-select'),
            gameScreen: document.getElementById('game-screen')
        };

        this.init();
    }

    init() {
        // Initialize main menu
        this.mainMenu = new MainMenu(
            () => this.showFactionSelect(),
            () => this.loadGame()
        );

        // Check for saved game
        this.mainMenu.enableLoadGame(gameState.hasSavedGame());

        // Initialize faction select
        this.factionSelect = new FactionSelect(
            (factionId) => this.startNewGame(factionId),
            () => this.showMainMenu()
        );

        // Global Event Listeners (One-time setup)
        window.addEventListener('quitToMenu', () => this.quitToMenu());
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('gameFeedback', (e) => {
            this.hud?.showNotification(e.detail);
        });
    }

    handleKeyDown(e) {
        if (!this.isRunning) return;

        // ESC - show menu or cancel building placement
        if (e.key === 'Escape') {
            if (this.inputHandler?.buildingPlacementMode) {
                this.inputHandler.cancelBuildingPlacement();
                this.buildingPlacementUI?.hide();
            } else {
                this.hud?.showInGameMenu();
            }
            return;
        }

        // B - Toggle building menu (skip if typing in input)
        if (e.key === 'b' || e.key === 'B') {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return; // Don't trigger while typing
            }
            this.toggleBuildingMenu();
            return;
        }

        // Building hotkeys when in building mode
        if (this.buildingPlacementUI?.isVisible) {
            const buildingMap = {
                's': 'supply',
                'r': 'barracks',
                'f': 'factory',
                'g': 'gasExtractor'
            };
            const building = buildingMap[e.key.toLowerCase()];
            if (building) {
                this.selectBuildingToPlace(building);
            }
        }
    }

    toggleBuildingMenu() {
        if (!this.buildingPlacementUI) {
            this.buildingPlacementUI = new BuildingPlacementUI(
                (type) => this.selectBuildingToPlace(type),
                () => this.inputHandler?.cancelBuildingPlacement()
            );
        }
        this.buildingPlacementUI.toggle();
    }

    selectBuildingToPlace(buildingType) {
        this.buildingPlacementUI?.hide();

        // Capture the currently selected worker (if any) when entering build mode
        let selectedWorkerId = null;
        if (this.inputHandler?.selectedUnits.length > 0) {
            const firstSelectedId = this.inputHandler.selectedUnits[0];
            const selectedUnit = gameState.units.find(u => u.id === firstSelectedId);
            if (selectedUnit && selectedUnit.type === 'worker') {
                selectedWorkerId = firstSelectedId;
            }
        }

        this.inputHandler?.enterBuildingPlacementMode(buildingType, (type, position) => {
            const result = this.gameActions.buildStructure(type, position, selectedWorkerId);
            if (result.success) {
                this.hud?.showNotification(result.message);
                // Notify AI of player's action for feedback
                this.aiAgent?.notifyPlayerAction('build', { type, buildingName: result.message });
            } else {
                this.hud?.showNotification(result.message, 'error');
            }
        });
    }

    showMainMenu() {
        this.hideAllScreens();
        this.screens.mainMenu.classList.add('active');
        this.mainMenu.enableLoadGame(gameState.hasSavedGame());
        this.stopGame();
    }

    showFactionSelect() {
        this.hideAllScreens();
        this.screens.factionSelect.classList.add('active');
    }

    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
    }

    cleanup() {
        this.stopGame();

        if (this.inputHandler) this.inputHandler.dispose();
        if (this.hud) this.hud.dispose();
        if (this.chatInterface) {
            try {
                this.chatInterface.dispose();
            } catch (e) {
                console.error('[Game] Error disposing chatInterface:', e);
            }
        }
        if (this.aiAgent) this.aiAgent.dispose();

        if (this.unitRenderer) this.unitRenderer.dispose();
        if (this.buildingRenderer) this.buildingRenderer.dispose();
        if (this.terrainRenderer) this.terrainRenderer.dispose();

        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }

        // We don't remove productionComplete here because we moved it to one-time init
    }

    startNewGame(factionId) {
        // Pre-cleanup
        this.cleanup();

        // Initialize game state
        gameState.startNewGame(factionId);

        // Register production handler AFTER gameState reset (reset clears listeners)
        this.setupProductionHandler();

        // Show game screen
        this.hideAllScreens();
        this.screens.gameScreen.classList.add('active');

        // Initialize 3D scene
        this.initializeScene();

        // Initialize game actions
        this.gameActions = new GameActions(
            (building) => this.onBuildingCreated(building),
            (unit) => this.onUnitCreated(unit)
        );

        // Listen for unit removal
        gameState.on('unitRemoved', (unit) => {
            this.unitRenderer?.removeUnit(unit.id);
        });

        // Initialize AI agent
        this.aiAgent = new AIAgent(gameState.faction, (action) => {
            const result = this.gameActions.executeAction(action);
        });

        // Check if using backend proxy (API key is on server)
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

        if (apiBaseUrl) {
            // Using backend proxy - no API key needed on frontend
            this.aiAgent.setApiKey('proxy'); // Just a flag to enable API calls
            // Voice synthesis also works via proxy
            this.aiAgent.setVoiceApiKey('proxy');
            this.aiAgent.setVoiceEnabled(true);
        } else if (apiKey) {
            // Direct OpenAI calls - need API key
            this.aiAgent.setApiKey(apiKey);
            // Load voice settings from environment variables
            const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
            if (elevenLabsKey) {
                this.aiAgent.setVoiceApiKey(elevenLabsKey);
                this.aiAgent.setVoiceEnabled(true);
            }
        }

        // Initialize chat interface
        const chatContainer = document.getElementById('chat-container');
        this.chatInterface = new ChatInterface(chatContainer, this.aiAgent);

        // Initialize HUD
        this.hud = new HUD();

        // Initialize input handler for mouse controls
        this.inputHandler = new InputHandler(
            this.scene,
            this.scene.camera,
            this.unitRenderer,
            this.terrainRenderer,
            (selection, type) => this.onSelectionChange(selection, type),
            this.buildingRenderer
        );

        // Connect player actions to AI feedback
        this.inputHandler.onPlayerAction = (actionType, details) => {
            this.aiAgent?.notifyPlayerAction(actionType, details);
        };

        // Create initial game objects
        this.createInitialGameObjects();

        // Start game loop
        this.startGame();
    }

    setupProductionHandler() {
        // Handles when units/buildings finish producing
        gameState.on('productionComplete', (item) => {
            if (item.category === 'building') {
                this.buildingRenderer?.completeConstruction(item.buildingId);
            } else if (item.category === 'unit') {
                // Unit is already added in gameState.completeProduction
                // We need to create the visual
                const newUnit = gameState.units[gameState.units.length - 1];
                if (newUnit) {
                    if (newUnit.type === 'worker') {
                        this.unitRenderer.createWorker(newUnit);
                    } else {
                        this.unitRenderer.createCombatUnit(newUnit);
                    }
                }
            }
        });
    }

    loadGame() {
        if (gameState.load()) {

            // Pre-cleanup before loading
            this.cleanup();

            // Register production handler (saved game already loaded the state, but listeners are cleared)
            this.setupProductionHandler();

            // Show game screen
            this.hideAllScreens();
            this.screens.gameScreen.classList.add('active');

            // Initialize scene
            this.initializeScene();

            // Initialize game actions
            this.gameActions = new GameActions(
                (building) => this.onBuildingCreated(building),
                (unit) => this.onUnitCreated(unit)
            );

            // Listen for unit removal
            gameState.on('unitRemoved', (unit) => {
                this.unitRenderer?.removeUnit(unit.id);
            });

            // Initialize AI agent
            this.aiAgent = new AIAgent(gameState.faction, (action) => {
                const result = this.gameActions.executeAction(action);
            });

            // Check if using backend proxy (API key is on server)
            const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

            if (apiBaseUrl) {
                // Using backend proxy - no API key needed on frontend
                this.aiAgent.setApiKey('proxy');
                // Voice synthesis also works via proxy
                this.aiAgent.setVoiceApiKey('proxy');
                this.aiAgent.setVoiceEnabled(true);
            } else if (apiKey) {
                // Direct OpenAI calls - need API key
                this.aiAgent.setApiKey(apiKey);
                // Load voice settings from environment variables
                const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
                if (elevenLabsKey) {
                    this.aiAgent.setVoiceApiKey(elevenLabsKey);
                    this.aiAgent.setVoiceEnabled(true);
                }
            }

            // Initialize chat interface
            const chatContainer = document.getElementById('chat-container');
            this.chatInterface = new ChatInterface(chatContainer, this.aiAgent);

            // Initialize HUD
            this.hud = new HUD();

            // Initialize input handler for mouse controls
            this.inputHandler = new InputHandler(
                this.scene,
                this.scene.camera,
                this.unitRenderer,
                this.terrainRenderer,
                (selection, type) => this.onSelectionChange(selection, type),
                this.buildingRenderer
            );

            // Connect player actions to AI feedback
            this.inputHandler.onPlayerAction = (actionType, details) => {
                this.aiAgent?.notifyPlayerAction(actionType, details);
            };

            // Recreate game objects from saved state
            this.recreateGameObjects();

            // Start game loop
            this.startGame();
        } else {
            console.error('Failed to load game');
        }
    }

    initializeScene() {
        const container = document.getElementById('game-canvas-container');

        // Clean up existing scene
        if (this.scene) {
            this.scene.dispose();
        }

        // Create new scene
        this.scene = new GameScene(container);

        // Initialize renderers
        this.terrainRenderer = new TerrainRenderer(this.scene);
        this.terrainRenderer.createTerrain();

        this.unitRenderer = new UnitRenderer(this.scene, gameState.faction);
        this.buildingRenderer = new BuildingRenderer(this.scene, gameState.faction);
    }

    createInitialGameObjects() {
        // Create resource nodes
        gameState.mineralPatches.forEach(patch => {
            this.terrainRenderer.createMineralPatch(patch);
        });

        gameState.gasGeysers.forEach(geyser => {
            this.terrainRenderer.createGasGeyser(geyser);
        });

        // Create buildings
        gameState.buildings.forEach(building => {
            this.buildingRenderer.createBuilding(building);
        });

        // Create units
        gameState.units.forEach(unit => {
            if (unit.type === 'worker') {
                this.unitRenderer.createWorker(unit);
            } else {
                this.unitRenderer.createCombatUnit(unit);
            }
        });
    }

    recreateGameObjects() {
        // Same as createInitialGameObjects for loaded games
        this.createInitialGameObjects();
    }

    onSelectionChange(selection, type) {
        if (!selection || selection.length === 0) {
            this.hud?.showSelection(null);
            return;
        }

        const entity = selection[0];

        if (type === 'building') {
            // Show building info and production options
            this.hud?.showBuildingSelection(entity, (unitType) => {
                const result = this.gameActions.trainUnit(entity.type, unitType);
                if (result.success) {
                    this.hud?.showNotification(result.message);
                    this.aiAgent?.notifyPlayerAction('train', { unitType, buildingType: entity.type });
                } else {
                    this.hud?.showNotification(result.message, 'error');
                }
            });
        } else {
            // Show unit info
            this.hud?.showSelection(entity);
        }
    }

    onBuildingCreated(building) {
        this.buildingRenderer.createBuilding(building);
    }

    onUnitCreated(unit) {
        if (unit.type === 'worker') {
            this.unitRenderer.createWorker(unit);
        } else {
            this.unitRenderer.createCombatUnit(unit);
        }
    }

    startGame() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    stopGame() {
        this.isRunning = false;
    }

    quitToMenu() {
        this.stopGame();

        // Cleanup
        if (this.scene) {
            this.scene.dispose();
            this.scene = null;
        }

        // Show main menu
        this.showMainMenu();
    }

    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        this.animationTime += deltaTime;

        // Update game state
        this.update(deltaTime);

        // Render
        this.render();

        // Next frame
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        // Update game state
        gameState.updateGameTime(deltaTime);
        gameState.gatherResources(deltaTime);
        gameState.updateProductionQueue(deltaTime);

        // Update HUD
        this.hud?.update();

        // Check Human SCV proximity for construction
        this.checkHumanConstruction();

        // Update construction progress visuals
        this.updateBuildingConstruction();

        // Update unit positions for workers
        this.updateUnitPositions(deltaTime);

        // Update Three.js controls
        this.scene?.update();
    }

    updateBuildingConstruction() {
        // Update progress bars and timers for buildings under construction
        gameState.productionQueue.forEach(item => {
            if (item.category === 'building' && item.buildingId) {
                const progress = item.progress / item.buildTime;

                // Calculate actual time remaining based on speed multiplier
                const multiplier = item.speedMultiplier || 1.0;
                const workRemaining = Math.max(0, item.buildTime - item.progress);
                const timeRemaining = workRemaining / multiplier;

                this.buildingRenderer?.updateConstructionProgress(
                    item.buildingId,
                    progress,
                    timeRemaining,
                    item.isPaused || false
                );
            }
        });
    }

    checkHumanConstruction() {
        if (gameState.faction?.id !== 'human') return;

        // Group all constructing workers by their target building once per frame
        const buildersByBuilding = new Map();
        gameState.units.forEach(u => {
            if (u.type === 'worker' && u.state === 'constructing' && u.targetBuildingId) {
                if (!buildersByBuilding.has(u.targetBuildingId)) {
                    buildersByBuilding.set(u.targetBuildingId, []);
                }
                buildersByBuilding.get(u.targetBuildingId).push(u);
            }
        });

        gameState.productionQueue.forEach(item => {
            if (item.category === 'building' && item.buildingId) {
                const building = gameState.buildings.find(b => b.id === item.buildingId);
                if (!building) return;

                const builders = buildersByBuilding.get(item.buildingId) || [];

                // Filter to those actually in range
                const activeBuilders = builders.filter(builder => {
                    const dx = builder.x - building.x;
                    const dz = builder.z - building.z;
                    // Using squared distance to avoid Math.sqrt per check
                    return (dx * dx + dz * dz) <= 9.0; // range = 3.0
                });

                if (activeBuilders.length > 0) {
                    item.isPaused = false;
                    // Speed bonus: 100% for first, +50% for each additional
                    item.speedMultiplier = 1.0 + (activeBuilders.length - 1) * 0.5;
                } else {
                    item.isPaused = true;
                    item.speedMultiplier = 0;
                }
            }
        });
    }

    updateUnitPositions(deltaTime) {
        const speed = 5;
        const unitRadius = 1.5; // Collision radius (increased from 1.0)
        const separationForce = 4.0; // Stronger separation force
        const minSeparation = unitRadius * 1.5; // Minimum distance between units

        gameState.units.forEach((unit, index) => {
            let targetX = null;
            let targetZ = null;

            // Workers have special behavior for resource gathering
            if (unit.type === 'worker') {
                if (unit.state === 'mining') {
                    const patch = gameState.mineralPatches.find(p => p.id === unit.targetResource);
                    if (patch) {
                        const workerIndex = this.getWorkerIndexAtResource(unit.id, unit.targetResource, 'mineral');
                        const angle = (workerIndex * Math.PI * 2 / 4) + (Math.PI / 4);
                        const offsetRadius = 2.0;
                        targetX = patch.x + Math.cos(angle) * offsetRadius;
                        targetZ = patch.z + Math.sin(angle) * offsetRadius;
                    }
                } else if (unit.state === 'returning_minerals') {
                    // Return to base to deposit minerals
                    const base = gameState.buildings.find(b => b.type === 'base');
                    if (base) {
                        // Aim for a point near the base
                        const dx = unit.x - base.x;
                        const dz = unit.z - base.z;
                        const angle = Math.atan2(dz, dx);
                        targetX = base.x + Math.cos(angle) * 4;
                        targetZ = base.z + Math.sin(angle) * 4;
                    }
                } else if (unit.state === 'harvesting_gas') {
                    const geyser = gameState.gasGeysers.find(g => g.id === unit.targetResource);
                    if (geyser) {
                        const workerIndex = this.getWorkerIndexAtResource(unit.id, unit.targetResource, 'gas');
                        const angle = (workerIndex * Math.PI * 2 / 3);
                        const offsetRadius = 2.0; // Keep within gatherRange of 2.5
                        targetX = geyser.x + Math.cos(angle) * offsetRadius;
                        targetZ = geyser.z + Math.sin(angle) * offsetRadius;
                    }
                } else if (unit.state === 'returning_gas') {
                    // Return to base to deposit gas
                    const base = gameState.buildings.find(b => b.type === 'base');
                    if (base) {
                        const dx = unit.x - base.x;
                        const dz = unit.z - base.z;
                        const angle = Math.atan2(dz, dx);
                        targetX = base.x + Math.cos(angle) * 4;
                        targetZ = base.z + Math.sin(angle) * 4;
                    }
                } else if (unit.state === 'constructing') {
                    if (unit.constructionData) {
                        targetX = unit.constructionData.x;
                        targetZ = unit.constructionData.z;
                    } else if (unit.targetBuildingId) {
                        targetX = unit.targetX;
                        targetZ = unit.targetZ;
                    }
                }
            }

            // All units can move when in 'moving' state
            if (unit.state === 'moving' && unit.targetX !== undefined) {
                targetX = unit.targetX;
                targetZ = unit.targetZ;
            }

            // Calculate separation from nearby units (applies to ALL units, even idle ones)
            let separationX = 0;
            let separationZ = 0;
            let needsSeparation = false;

            gameState.units.forEach(other => {
                if (other.id === unit.id) return;
                const sepX = unit.x - other.x;
                const sepZ = unit.z - other.z;
                const sepDist = Math.sqrt(sepX * sepX + sepZ * sepZ);

                // Apply separation if units are too close
                if (sepDist < minSeparation && sepDist > 0.01) {
                    const strength = (minSeparation - sepDist) / minSeparation; // Stronger when closer
                    separationX += (sepX / sepDist) * separationForce * strength;
                    separationZ += (sepZ / sepDist) * separationForce * strength;
                    needsSeparation = true;
                }
            });

            // Move towards target if one exists
            if (targetX !== null && targetZ !== null) {
                let dx = targetX - unit.x;
                let dz = targetZ - unit.z;

                // Add separation to movement direction
                dx += separationX * deltaTime;
                dz += separationZ * deltaTime;

                const distance = Math.sqrt(dx * dx + dz * dz);

                if (distance > 0.3) {
                    const moveSpeed = Math.min(speed * deltaTime, distance);
                    unit.x += (dx / distance) * moveSpeed;
                    unit.z += (dz / distance) * moveSpeed;
                    this.unitRenderer?.updateUnitPosition(unit.id, unit.x, unit.z);
                } else {
                    // Arrived at destination
                    if (unit.state === 'moving') {
                        unit.state = 'idle';
                        unit.targetX = undefined;
                        unit.targetZ = undefined;
                    } else if (unit.state === 'constructing') {
                        if (gameState.faction?.id === 'zerg') {
                            // Zerg drone arrived at site - CONSUME and BUILD
                            const constructionData = unit.constructionData;
                            gameState.removeUnit(unit.id);
                            this.gameActions?.startZergConstruction(constructionData);
                        }
                        // For Human, we stay in constructing state and standing still
                        // No further action needed here as checkHumanConstruction handles unpausing
                    }
                }
            } else if (needsSeparation) {
                // Apply separation even when idle to push overlapping units apart
                const sepMag = Math.sqrt(separationX * separationX + separationZ * separationZ);
                if (sepMag > 0.01) {
                    const moveSpeed = Math.min(speed * 0.5 * deltaTime, sepMag * deltaTime);
                    unit.x += (separationX / sepMag) * moveSpeed;
                    unit.z += (separationZ / sepMag) * moveSpeed;
                    this.unitRenderer?.updateUnitPosition(unit.id, unit.x, unit.z);
                }
            }
        });
    }

    getWorkerIndexAtResource(workerId, resourceId, resourceType) {
        const workerList = resourceType === 'gas' ? gameState.gasWorkers : gameState.mineralWorkers;
        const workersAtResource = workerList.filter(id => {
            const w = gameState.units.find(u => u.id === id);
            return w && w.targetResource === resourceId;
        });
        return workersAtResource.indexOf(workerId);
    }

    render() {
        // Animate terrain resources
        this.terrainRenderer?.animateResources(this.animationTime);

        // Animate units
        this.unitRenderer?.animateUnits(this.animationTime);

        // Animate buildings
        this.buildingRenderer?.animateBuildings(this.animationTime);

        // Render scene
        this.scene?.render();
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
