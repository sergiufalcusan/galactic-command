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

        // B - Toggle building menu
        if (e.key === 'b' || e.key === 'B') {
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

        this.inputHandler?.enterBuildingPlacementMode(buildingType, (type, position) => {
            const result = this.gameActions.buildStructure(type, position);
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
        console.log('[Game] Cleaning up existing systems...');
        this.stopGame();

        if (this.inputHandler) this.inputHandler.dispose();
        if (this.hud) this.hud.dispose();
        if (this.chatInterface) this.chatInterface.dispose();
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
        console.log('Starting new game with faction:', factionId);

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

        // Initialize AI agent
        this.aiAgent = new AIAgent(gameState.faction, (action) => {
            const result = this.gameActions.executeAction(action);
            console.log('Action result:', result);
        });

        // Load API keys from environment variables
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (apiKey) {
            this.aiAgent.setApiKey(apiKey);
        }

        // Load voice settings from environment variables
        const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        if (elevenLabsKey) {
            this.aiAgent.setVoiceApiKey(elevenLabsKey);
            this.aiAgent.setVoiceEnabled(true);
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
            (selectedUnits) => this.hud.showSelection(selectedUnits[0])
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
            console.log('Game loaded successfully');

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

            // Initialize AI agent
            this.aiAgent = new AIAgent(gameState.faction, (action) => {
                const result = this.gameActions.executeAction(action);
                console.log('Action result:', result);
            });

            // Load API keys from environment variables
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            if (apiKey) {
                this.aiAgent.setApiKey(apiKey);
            }

            // Load voice settings from environment variables
            const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
            if (elevenLabsKey) {
                this.aiAgent.setVoiceApiKey(elevenLabsKey);
                this.aiAgent.setVoiceEnabled(true);
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
                (selectedUnits) => this.hud.showSelection(selectedUnits[0])
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

    onBuildingCreated(building) {
        console.log('[Game] onBuildingCreated called:', building);
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

        // Update construction progress visuals
        this.updateBuildingConstruction();

        // Update unit positions for workers
        this.updateWorkerPositions(deltaTime);

        // Update Three.js controls
        this.scene?.update();
    }

    updateBuildingConstruction() {
        // Update progress bars and timers for buildings under construction
        gameState.productionQueue.forEach(item => {
            if (item.category === 'building' && item.buildingId) {
                const progress = item.progress / item.buildTime;
                const remaining = item.buildTime - item.progress;
                this.buildingRenderer?.updateConstructionProgress(
                    item.buildingId,
                    progress,
                    remaining
                );
            }
        });
    }

    updateWorkerPositions(deltaTime) {
        const speed = 5;
        const workerRadius = 1.0; // Collision radius
        const separationForce = 2.0;

        gameState.units.forEach((unit, index) => {
            if (unit.type !== 'worker') return;

            let targetX = null;
            let targetZ = null;

            // Determine target based on state
            if (unit.state === 'mining') {
                const patch = gameState.mineralPatches.find(p => p.id === unit.targetResource);
                if (patch) {
                    // Calculate offset position around the resource
                    const workerIndex = this.getWorkerIndexAtResource(unit.id, unit.targetResource, 'mineral');
                    const angle = (workerIndex * Math.PI * 2 / 4) + (Math.PI / 4); // Spread in 4 positions
                    const offsetRadius = 1.5;
                    targetX = patch.x + Math.cos(angle) * offsetRadius;
                    targetZ = patch.z + Math.sin(angle) * offsetRadius;
                }
            } else if (unit.state === 'harvesting_gas') {
                const geyser = gameState.gasGeysers.find(g => g.id === unit.targetResource);
                if (geyser) {
                    // Calculate offset position around the geyser
                    const workerIndex = this.getWorkerIndexAtResource(unit.id, unit.targetResource, 'gas');
                    const angle = (workerIndex * Math.PI * 2 / 3); // Spread in 3 positions
                    const offsetRadius = 2.0;
                    targetX = geyser.x + Math.cos(angle) * offsetRadius;
                    targetZ = geyser.z + Math.sin(angle) * offsetRadius;
                }
            } else if (unit.state === 'moving' && unit.targetX !== undefined) {
                targetX = unit.targetX;
                targetZ = unit.targetZ;
            }

            // Move towards target if one exists
            if (targetX !== null && targetZ !== null) {
                let dx = targetX - unit.x;
                let dz = targetZ - unit.z;

                // Add separation from other workers
                gameState.units.forEach(other => {
                    if (other.id === unit.id || other.type !== 'worker') return;
                    const sepX = unit.x - other.x;
                    const sepZ = unit.z - other.z;
                    const sepDist = Math.sqrt(sepX * sepX + sepZ * sepZ);
                    if (sepDist < workerRadius * 2 && sepDist > 0.01) {
                        dx += (sepX / sepDist) * separationForce * deltaTime;
                        dz += (sepZ / sepDist) * separationForce * deltaTime;
                    }
                });

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
                    }
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
