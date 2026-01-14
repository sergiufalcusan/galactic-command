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

        // Handle quit to menu event
        window.addEventListener('quitToMenu', () => this.quitToMenu());

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isRunning) {
                this.hud?.showInGameMenu();
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

    startNewGame(factionId) {
        console.log('Starting new game with faction:', factionId);

        // Initialize game state
        gameState.startNewGame(factionId);

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

        // Load API key if available
        const apiKey = localStorage.getItem('openai_api_key');
        if (apiKey) {
            this.aiAgent.setApiKey(apiKey);
        }

        // Load voice settings
        const elevenLabsKey = localStorage.getItem('elevenlabs_api_key');
        if (elevenLabsKey) {
            this.aiAgent.setVoiceApiKey(elevenLabsKey);
        }
        const voiceEnabled = localStorage.getItem('voice_enabled') === 'true';
        this.aiAgent.setVoiceEnabled(voiceEnabled && !!elevenLabsKey);

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

        // Listen for feedback events
        window.addEventListener('gameFeedback', (e) => {
            this.hud.showNotification(e.detail);
        });

        // Register production completion handler ONCE (not in update loop)
        this.setupProductionHandler();

        // Create initial game objects
        this.createInitialGameObjects();

        // Start game loop
        this.startGame();
    }

    setupProductionHandler() {
        // Only register once - this handles when units/buildings finish producing
        gameState.on('productionComplete', (item) => {
            if (item.category === 'building') {
                this.buildingRenderer.completeConstruction(item.buildingId);
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

            const apiKey = localStorage.getItem('openai_api_key');
            if (apiKey) {
                this.aiAgent.setApiKey(apiKey);
            }

            // Load voice settings
            const elevenLabsKey = localStorage.getItem('elevenlabs_api_key');
            if (elevenLabsKey) {
                this.aiAgent.setVoiceApiKey(elevenLabsKey);
            }
            const voiceEnabled = localStorage.getItem('voice_enabled') === 'true';
            this.aiAgent.setVoiceEnabled(voiceEnabled && !!elevenLabsKey);

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

            // Register production handler
            this.setupProductionHandler();

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
        // Simple worker movement simulation
        gameState.units.forEach(unit => {
            if (unit.type === 'worker' && unit.state === 'mining') {
                // Find target mineral patch
                const patch = gameState.mineralPatches.find(p => p.id === unit.targetResource);
                if (patch) {
                    // Move towards patch or base (simulated round-trip)
                    const dx = patch.x - unit.x;
                    const dz = patch.z - unit.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);

                    if (distance > 1) {
                        const speed = 3;
                        unit.x += (dx / distance) * speed * deltaTime;
                        unit.z += (dz / distance) * speed * deltaTime;

                        // Update renderer
                        this.unitRenderer.updateUnitPosition(unit.id, unit.x, unit.z);
                    }
                }
            }
        });
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
