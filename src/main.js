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
import { getBuildingDimensions } from './game/BuildingConfig.js';
import { getUnitConfig } from './game/UnitConfig.js';
import InputHandler from './game/InputHandler.js';
import MainMenu from './ui/MainMenu.js';
import FactionSelect from './ui/FactionSelect.js';
import ChatInterface from './ui/ChatInterface.js';
import HUD from './ui/HUD.js';
import BuildingPlacementUI from './ui/BuildingPlacementUI.js';
import Minimap from './ui/Minimap.js';

class Game {
    constructor() {
        // Core systems
        this.scene = null;
        this.terrainRenderer = null;
        this.unitRenderer = null;
        this.buildingRenderer = null;
        this.debugMode = false;

        // UI
        this.mainMenu = null;
        this.factionSelect = null;
        this.chatInterface = null;
        this.hud = null;
        this.minimap = null;

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
        // ESC - show menu or cancel building placement
        if (e.key === 'Escape') {
            // Priority 1: Cancel active building placement (ghost building)
            if (this.inputHandler?.buildingPlacementMode) {
                this.inputHandler.cancelBuildingPlacement();
                // Also ensure UI is hidden if we were just placing
                this.buildingPlacementUI?.hide();
                return;
            }

            // Priority 2: Close building selection UI if open
            if (this.buildingPlacementUI?.isVisible) {
                this.buildingPlacementUI.hide();
                return;
            }

            // Priority 3: Toggle In-Game Menu
            this.hud?.toggleInGameMenu();
            return;
        }

        // F10 - Toggle Debug Mode
        if (e.key === 'F10') {
            this.toggleDebugMode();
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
                'g': 'gasExtractor',
                'h': 'hatchery'  // Zerg only - Hatchery expansion
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
                // Pass the type directly instead of the message to avoid AI confusion
                this.notifyAIWithChat('build', { type, buildingName: type });
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
        if (this.minimap) this.minimap.dispose();
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

        // Listen for building removal (for Zerg creep retraction)
        gameState.on('buildingRemoved', (building) => {
            this.buildingRenderer?.removeBuilding(building.id);
            // Remove creep for Zerg buildings
            if (gameState.faction?.id === 'zerg') {
                this.terrainRenderer?.removeCreep(building.id);
            }
        });

        // Listen for larva spawning (Zerg)
        gameState.on('larvaSpawned', ({ larva, hatchery }) => {
            if (this.unitRenderer && larva) {
                this.unitRenderer.createLarva(larva);
            }
        });

        // Listen for larva evolution start - replace larva with egg
        gameState.on('larvaEvolutionStarted', ({ larvaId, targetUnitType, eggData }) => {
            // Remove larva visual
            this.unitRenderer?.removeUnit(larvaId);
            // Create egg visual in its place
            if (this.unitRenderer && eggData) {
                this.unitRenderer.createEvolutionEgg(eggData);
            }
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
        } else if (apiKey) {
            // Direct OpenAI calls - need API key
            this.aiAgent.setApiKey(apiKey);
        }

        // Initialize chat interface
        const chatContainer = document.getElementById('chat-container');
        this.chatInterface = new ChatInterface(chatContainer, this.aiAgent);

        // Initialize HUD
        this.hud = new HUD();
        this.hud.onBuildMenu = () => this.toggleBuildingMenu();

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
            this.notifyAIWithChat(actionType, details);
        };

        // Create initial game objects
        this.createInitialGameObjects();

        // Initialize minimap
        this.minimap = new Minimap(this.scene);

        // Start game loop
        this.startGame();
    }

    setupProductionHandler() {
        // Handles when units/buildings finish producing
        gameState.on('productionComplete', (item) => {
            if (item.category === 'building') {
                this.buildingRenderer?.completeConstruction(item.buildingId);

                // Create creep for Zerg buildings when construction completes
                if (gameState.faction?.id === 'zerg') {
                    const building = gameState.buildings.find(b => b.id === item.buildingId);

                    if (building && this.terrainRenderer) {
                        // Creep Colony gets radius 20
                        if (item.type === 'supply') {
                            this.terrainRenderer.createCreep(building.id, building.x, building.z, 20, false);
                        }
                        // Additional Hatcheries get radius 40 and spawn larva
                        if (item.type === 'hatchery') {
                            this.terrainRenderer.createCreep(building.id, building.x, building.z, 40, true);
                            // Spawn initial larva for new Hatchery
                            gameState.spawnInitialLarva(building);
                        }
                    }
                }

                // Notify AI when building completes
                this.notifyAIWithChat('build_complete', {
                    buildingName: item.name || item.type
                });
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
                // Notify AI when unit production completes
                this.notifyAIWithChat('train_complete', {
                    unitType: item.name || item.unitType,
                    buildingType: item.producerType
                });
            }
        });

        // Handle gas extractor completion - update geyser visuals
        gameState.on('geyserExtractorBuilt', ({ geyser }) => {
            this.terrainRenderer?.updateResourceNode(geyser.id, geyser);
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

            // Listen for building removal (for Zerg creep retraction)
            gameState.on('buildingRemoved', (building) => {
                this.buildingRenderer?.removeBuilding(building.id);
                if (gameState.faction?.id === 'zerg') {
                    this.terrainRenderer?.removeCreep(building.id);
                }
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
            } else if (apiKey) {
                // Direct OpenAI calls - need API key
                this.aiAgent.setApiKey(apiKey);
            }

            // Initialize chat interface
            const chatContainer = document.getElementById('chat-container');
            this.chatInterface = new ChatInterface(chatContainer, this.aiAgent);

            // Initialize HUD
            this.hud = new HUD();
            this.hud.onBuildMenu = () => this.toggleBuildingMenu();

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
                this.notifyAIWithChat(actionType, details);
            };

            // Recreate game objects from saved state
            this.recreateGameObjects();

            // Initialize minimap
            this.minimap = new Minimap(this.scene);

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
        this.terrainRenderer = new TerrainRenderer(this.scene, gameState.faction);
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

        // Create buildings (use onBuildingCreated to include creep for Zerg)
        gameState.buildings.forEach(building => {
            this.onBuildingCreated(building);
        });

        // Create units
        gameState.units.forEach(unit => {
            if (unit.type === 'worker') {
                this.unitRenderer.createWorker(unit);
            } else if (unit.type === 'larva') {
                // Create larva with proper animation support
                this.unitRenderer.createLarva(unit);
            } else if (unit.type === 'egg') {
                // Create evolution egg
                this.unitRenderer.createEvolutionEgg(unit);
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
                // Pass the building entity so we can track production per-building
                const result = this.gameActions.trainUnit(entity, unitType);
                if (result.success) {
                    this.hud?.showNotification(result.message);
                    // AI notification moved to productionComplete handler
                } else {
                    this.hud?.showNotification(result.message, 'error');
                }
            });
        } else {
            // Show unit info - pass full selection for multi-larva support
            this.hud?.showSelection(entity, selection);
        }
    }

    onBuildingCreated(building) {
        this.buildingRenderer.createBuilding(building);

        // Handle Zerg creep - only Hatchery creates creep immediately
        // Creep Colony creep is created when construction completes (in setupProductionHandler)
        if (gameState.faction?.id === 'zerg' && this.terrainRenderer) {
            if (building.type === 'base') {
                // Hatchery creates large creep circle immediately (radius 40)
                this.terrainRenderer.createCreep(building.id, building.x, building.z, 40, true);
            }
            // Creep Colony creep is handled in productionComplete
        }
    }

    onUnitCreated(unit) {
        if (unit.type === 'worker') {
            this.unitRenderer.createWorker(unit);
        } else {
            this.unitRenderer.createCombatUnit(unit);
        }
    }

    // Helper to notify AI and display response in chat
    async notifyAIWithChat(actionType, details) {
        if (!this.aiAgent) return;

        const response = await this.aiAgent.notifyPlayerAction(actionType, details);
        if (response && response.text && this.chatInterface) {
            this.chatInterface.addMessage(response.text, 'ai');
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

        // Update Zerg larva spawning
        gameState.updateLarvaSpawning();

        // Update HUD
        this.hud?.update();

        // Update minimap
        this.minimap?.update();

        // Update production queue display (for progress bars)
        this.hud?.updateProductionQueueDisplay();

        // Update gas geyser visuals (haze fades as gas depletes)
        gameState.gasGeysers.forEach(geyser => {
            if (geyser.hasExtractor) {
                this.terrainRenderer?.updateResourceNode(geyser.id, geyser);
            }
        });

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
        const separationForce = 4.0; // Stronger separation force

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
                } else if (unit.state === 'warping' && unit.warpData) {
                    // Protoss probe moving to warp-in location
                    targetX = unit.warpData.x;
                    targetZ = unit.warpData.z;
                }
            } else if (unit.type === 'larva') {
                // Larva wandering logic
                if (unit.targetX === undefined || unit.targetZ === undefined || unit.wanderTimer === undefined) {
                    unit.wanderTimer = 0;
                    unit.baseX = unit.x;
                    unit.baseZ = unit.z;
                    unit.targetX = unit.x + (Math.random() - 0.5) * 6;
                    unit.targetZ = unit.z + (Math.random() - 0.5) * 6;
                }

                unit.wanderTimer += deltaTime;

                // Pick a new target periodically or if we've arrived
                const distToTargetSq = (unit.targetX - unit.x) ** 2 + (unit.targetZ - unit.z) ** 2;
                if (unit.wanderTimer > 3.0 || distToTargetSq < 0.1) {
                    unit.wanderTimer = 0;
                    // Wander around base position
                    unit.targetX = unit.baseX + (Math.random() - 0.5) * 8;
                    unit.targetZ = unit.baseZ + (Math.random() - 0.5) * 8;
                }

                targetX = unit.targetX;
                targetZ = unit.targetZ;
            }

            // All units can move when in 'moving' state
            if (unit.state === 'moving' && unit.targetX !== undefined) {
                targetX = unit.targetX;
                targetZ = unit.targetZ;
            }

            // Base speed for units
            let unitSpeed = speed;
            const config = getUnitConfig(unit.type);
            const unitRadius = config.radius;

            let newX = unit.x;
            let newZ = unit.z;

            // Check if this unit is flying
            const isFlying = config.flyHeight !== undefined;

            // Unit-unit separation and collision (skip for flying units)
            if (!isFlying) {
                gameState.units.forEach((other, otherIndex) => {
                    if (index === otherIndex) return;

                    // Skip collision with other flying units too
                    const otherConfig = getUnitConfig(other.type);
                    if (otherConfig.flyHeight !== undefined) return;

                    const dx = unit.x - other.x;
                    const dz = unit.z - other.z;
                    const distSq = dx * dx + dz * dz;
                    const minSeparation = (unitRadius + otherConfig.radius) * 1.2;

                    if (distSq < minSeparation * minSeparation) {
                        const dist = Math.sqrt(distSq);
                        const pushForce = (minSeparation - dist) * separationForce;
                        const angle = distSq > 0 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
                        newX += Math.cos(angle) * pushForce * deltaTime;
                        newZ += Math.sin(angle) * pushForce * deltaTime;
                    }
                });
            }

            // Actual movement towards target
            if (targetX !== null && targetZ !== null) {
                const dx = targetX - unit.x;
                const dz = targetZ - unit.z;
                const distSq = dx * dx + dz * dz;

                if (distSq > 0.01) {
                    const dist = Math.sqrt(distSq);
                    const force = Math.min(dist, unitSpeed * deltaTime);
                    newX += (dx / dist) * force;
                    newZ += (dz / dist) * force;

                    // Building collision check with navigation (skip for flying units)
                    const isFlying = config.flyHeight !== undefined;
                    if (!isFlying) {
                        const navPos = this.checkBuildingCollisionWithNavigation(
                            unit.x, unit.z, newX, newZ, unitRadius, dx / dist, dz / dist
                        );
                        if (navPos) {
                            newX = navPos.x;
                            newZ = navPos.z;
                        }
                    }
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
                    } else if (unit.state === 'warping' && unit.warpData) {
                        // Protoss probe arrived - start warp-in and free the probe
                        this.gameActions?.startProtossWarpIn(unit.warpData);
                        unit.warpData = null;
                        unit.state = 'idle';
                        unit.targetX = undefined;
                        unit.targetZ = undefined;
                    }
                }
            }

            // Always update position even if not moving towards a target (for separation)
            // But only if we actually moved from separation
            if (unit.x !== newX || unit.z !== newZ) {
                // Check building collision (simple push for separation/idle drift)
                // Skip for flying units - they pass over buildings
                const isFlying = config.flyHeight !== undefined;
                if (!isFlying) {
                    const collision = this.checkBuildingCollision(newX, newZ, unitRadius);
                    if (collision) {
                        newX = collision.x;
                        newZ = collision.z;
                    }
                }

                // Calculate movement direction BEFORE updating position
                const moveDx = newX - unit.x;
                const moveDz = newZ - unit.z;
                const moveDist = Math.sqrt(moveDx * moveDx + moveDz * moveDz);

                // Only update facing direction if we moved a meaningful amount
                if (moveDist > 0.01) {
                    const moveAngle = Math.atan2(moveDx, moveDz); // Note: atan2(dx, dz) for correct facing
                    unit.facingAngle = moveAngle;

                    // Update unit visual rotation
                    const group = this.unitRenderer?.units?.get(unit.id);
                    if (group) {
                        // Store base rotation for renderer to use with animations (like wiggling)
                        group.userData.baseRotationY = moveAngle;
                        // Apply rotation directly for non-animated units
                        if (!group.userData.isLarva) {
                            group.rotation.y = moveAngle;
                        }
                    }
                }

                // Now update position
                unit.x = newX;
                unit.z = newZ;

                this.unitRenderer?.updateUnitPosition(unit.id, unit.x, unit.z);
            }
        });
    }

    // Check if position collides with any building and return adjusted position
    // Uses rectangular AABB collision based on actual building sizes
    checkBuildingCollision(x, z, unitRadius) {
        for (const building of gameState.buildings) {
            // Building size based on type (matches BuildingRenderer hitbox sizes)
            // Gas extractors have no collision so workers can enter to harvest
            const gasTypes = ['gasextractor', 'extractor', 'refinery', 'assimilator'];
            const isGasExtractor = gasTypes.includes(building.type?.toLowerCase());
            if (isGasExtractor) continue; // Skip collision for gas extractors

            const dims = getBuildingDimensions(building.type);

            // Incomplete buildings have smaller collision box (40%) so workers can get close to build
            const collisionScale = building.isComplete ? 1.0 : 0.4;
            const halfW = ((dims.collisionWidth || 5) / 2) * collisionScale;
            const halfD = ((dims.collisionDepth || 5) / 2) * collisionScale;

            // Building bounds (AABB)
            const minX = building.x - halfW;
            const maxX = building.x + halfW;
            const minZ = building.z - halfD;
            const maxZ = building.z + halfD;

            // Expand bounds by unit radius
            const expandedMinX = minX - unitRadius;
            const expandedMaxX = maxX + unitRadius;
            const expandedMinZ = minZ - unitRadius;
            const expandedMaxZ = maxZ + unitRadius;

            // Check if unit center is inside expanded bounds
            if (x > expandedMinX && x < expandedMaxX && z > expandedMinZ && z < expandedMaxZ) {
                // Find nearest edge to push unit to
                const distToLeft = x - expandedMinX;
                const distToRight = expandedMaxX - x;
                const distToTop = z - expandedMinZ;
                const distToBottom = expandedMaxZ - z;

                const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                let pushX = x;
                let pushZ = z;

                if (minDist === distToLeft) {
                    pushX = expandedMinX;
                } else if (minDist === distToRight) {
                    pushX = expandedMaxX;
                } else if (minDist === distToTop) {
                    pushZ = expandedMinZ;
                } else {
                    pushZ = expandedMaxZ;
                }

                return { x: pushX, z: pushZ };
            }
        }
        return null; // No collision
    }

    // Check building collision with smart navigation around obstacles
    // Instead of just pushing away, this steers units around buildings
    checkBuildingCollisionWithNavigation(oldX, oldZ, newX, newZ, unitRadius, moveDx, moveDz) {
        for (const building of gameState.buildings) {
            // Skip gas extractors
            const gasTypes = ['gasextractor', 'extractor', 'refinery', 'assimilator'];
            const isGasExtractor = gasTypes.includes(building.type?.toLowerCase());
            if (isGasExtractor) continue;

            const dims = getBuildingDimensions(building.type);

            // Incomplete buildings have smaller collision box (40%) so workers can get close to build
            const collisionScale = building.isComplete ? 1.0 : 0.4;
            const halfW = ((dims.collisionWidth || 5) / 2) * collisionScale;
            const halfD = ((dims.collisionDepth || 5) / 2) * collisionScale;

            const expandedW = halfW + unitRadius;
            const expandedD = halfD + unitRadius;

            // Building center
            const bx = building.x;
            const bz = building.z;

            // Check if new position would be inside building (AABB check)
            if (newX > bx - expandedW && newX < bx + expandedW &&
                newZ > bz - expandedD && newZ < bz + expandedD) {

                // Determine which way to steer around the building
                // Use cross product to decide: if (dx, dz) x (bx-oldX, bz-oldZ) > 0, go right, else go left
                const toBuildingX = bx - oldX;
                const toBuildingZ = bz - oldZ;

                // Cross product: moveDx * toBuildingZ - moveDz * toBuildingX
                const cross = moveDx * toBuildingZ - moveDz * toBuildingX;

                // Perpendicular direction (90 degrees from movement)
                // If cross > 0, building is to our left, so steer right
                // If cross < 0, building is to our right, so steer left
                let perpX, perpZ;
                if (cross > 0) {
                    // Steer right (rotate movement 90 degrees clockwise)
                    perpX = moveDz;
                    perpZ = -moveDx;
                } else {
                    // Steer left (rotate movement 90 degrees counter-clockwise)
                    perpX = -moveDz;
                    perpZ = moveDx;
                }

                // Normalize perpendicular direction
                const perpMag = Math.sqrt(perpX * perpX + perpZ * perpZ);
                if (perpMag > 0.01) {
                    perpX /= perpMag;
                    perpZ /= perpMag;
                }

                // Move along the building edge (slide along)
                const slideSpeed = Math.sqrt((newX - oldX) ** 2 + (newZ - oldZ) ** 2);
                let slideX = oldX + perpX * slideSpeed;
                let slideZ = oldZ + perpZ * slideSpeed;

                // Make sure the slide position is outside the building
                // Clamp to building edge
                if (slideX > bx - expandedW && slideX < bx + expandedW &&
                    slideZ > bz - expandedD && slideZ < bz + expandedD) {
                    // Still inside, push to nearest edge
                    const distToLeft = slideX - (bx - expandedW);
                    const distToRight = (bx + expandedW) - slideX;
                    const distToTop = slideZ - (bz - expandedD);
                    const distToBottom = (bz + expandedD) - slideZ;

                    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                    if (minDist === distToLeft) slideX = bx - expandedW;
                    else if (minDist === distToRight) slideX = bx + expandedW;
                    else if (minDist === distToTop) slideZ = bz - expandedD;
                    else slideZ = bz + expandedD;
                }

                return { x: slideX, z: slideZ };
            }
        }
        return null; // No collision
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

        // Animate creep for Zerg
        this.terrainRenderer?.animateCreep?.(this.animationTime);

        // Animate units
        this.unitRenderer?.animateUnits(this.animationTime);

        // Animate buildings
        this.buildingRenderer?.animateBuildings(this.animationTime);

        // Render scene
        this.scene?.render();
    }

    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        this.buildingRenderer?.setDebugMode(this.debugMode);
        this.unitRenderer?.setDebugMode(this.debugMode);
        this.hud?.showNotification({
            message: `Debug Mode: ${this.debugMode ? 'ON' : 'OFF'}`,
            type: 'info'
        });
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
