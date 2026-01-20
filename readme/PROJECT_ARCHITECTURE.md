# Galactic Command - Comprehensive Project Documentation

> **For AI Agents**: This document provides complete architectural details to understand and work on this codebase.

## Project Overview

**Galactic Command** is a browser-based Real-Time Strategy (RTS) game inspired by StarCraft, built with:
- **Three.js** for 3D rendering
- **Vite** for development/bundling
- **Vanilla JavaScript** (ES6+ modules)
- **OpenAI API** for AI advisor chat
- **ElevenLabs API** for text-to-speech

### Game Concept
- Players choose from 3 factions: **Zerg**, **Human**, or **Protoss**
- Each faction has unique units, buildings, and an AI advisor with distinct personality
- Core gameplay: resource gathering, base building, unit production
- AI advisor provides strategic feedback and can execute game commands via chat

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| 3D Engine | Three.js (v0.182.0) |
| Build Tool | Vite (v7.3.1) |
| Backend | Express.js (API proxy server) |
| AI Chat | OpenAI GPT API |
| Voice TTS | ElevenLabs API |
| Fonts | Google Fonts (Orbitron, Rajdhani) |
| 3D Models | GLTF format (Kenney Space Kit) |

---

## Project Structure

```
buenastardes/
├── index.html              # Main HTML with UI structure
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite configuration
├── .env                    # Environment variables (API keys)
├── .env.example            # Environment template
│
├── src/
│   ├── main.js             # 🎮 Game entry point & main loop
│   │
│   ├── game/               # Core game logic
│   │   ├── GameState.js    # Central state management
│   │   ├── GameActions.js  # Action execution (build, train)
│   │   ├── InputHandler.js # Mouse/keyboard input
│   │   └── Faction.js      # Faction definitions
│   │
│   ├── ai/                 # AI systems
│   │   ├── Agent.js        # OpenAI-powered advisor
│   │   └── VoiceSynthesis.js # ElevenLabs TTS
│   │
│   ├── rendering/          # Three.js rendering
│   │   ├── Scene.js        # Scene setup, camera, lighting
│   │   ├── Terrain.js      # Ground, resources, creep
│   │   ├── UnitRenderer.js # Unit 3D models & animations
│   │   ├── BuildingRenderer.js # Building models
│   │   └── ModelLoader.js  # GLTF model loader
│   │
│   ├── ui/                 # UI components
│   │   ├── HUD.js          # In-game HUD, production queue
│   │   ├── MainMenu.js     # Main menu & settings
│   │   ├── FactionSelect.js # Faction selection screen
│   │   ├── ChatInterface.js # AI chat panel
│   │   └── BuildingPlacementUI.js # Building placement modal
│   │
│   └── styles/
│       └── index.css       # All game styles
│
├── server/                 # Backend API proxy
│   ├── server.js           # Express server
│   ├── package.json        # Server dependencies
│   ├── Dockerfile          # Docker configuration
│   └── docker-compose.yml  # Docker compose setup
│
├── public/
│   └── models/             # GLTF 3D models
│       ├── units/          # Worker, marine, zergling, etc.
│       └── buildings/      # Base, barracks, factory, etc.
│
└── kenney_space/           # Asset source (Kenney Space Kit)
```

---

## Core Architecture

### 1. Game Class (`src/main.js`)

The central `Game` class orchestrates all systems:

```javascript
class Game {
    // Core systems
    scene: GameScene           // Three.js scene
    terrainRenderer: TerrainRenderer
    unitRenderer: UnitRenderer
    buildingRenderer: BuildingRenderer
    inputHandler: InputHandler
    
    // UI
    mainMenu: MainMenu
    factionSelect: FactionSelect
    chatInterface: ChatInterface
    hud: HUD
    buildingPlacementUI: BuildingPlacementUI
    
    // AI
    aiAgent: AIAgent
    
    // Game loop
    isRunning: boolean
    lastTime: number
}
```

**Key Methods:**
- `init()` - Initialize game systems
- `startNewGame(factionId)` - Start fresh game with faction
- `loadGame()` - Load saved game from localStorage
- `gameLoop()` - Main update/render loop
- `update(deltaTime)` - Update game state, units, production
- `render()` - Render 3D scene
- `cleanup()` - Dispose all resources (memory leak prevention)
- `quitToMenu()` - Return to main menu

### 2. GameState (`src/game/GameState.js`)

Singleton managing all game data:

```javascript
class GameState {
    // State
    faction: Object           // Current faction data
    resources: { minerals, gas }
    population: { current, max }
    units: Map<id, unitData>
    buildings: Map<id, buildingData>
    productionQueue: Array
    larva: Array              // Zerg-specific
    eggs: Array               // Zerg evolution eggs
    gameTime: number
    
    // Event system
    events: Map<eventName, callbacks>
    
    // Methods
    on(event, callback)       // Subscribe to events
    emit(event, data)         // Emit events
    
    // Resource management
    canAfford(cost): boolean
    spendResources(cost)
    gatherResources(deltaTime)
    
    // Unit/Building management
    addUnit(data), removeUnit(id)
    addBuilding(data), removeBuilding(id)
    
    // Production
    addToProductionQueue(item)
    updateProductionQueue(deltaTime)
    completeProduction(item)
    
    // Zerg-specific
    spawnLarva(hatchery)
    evolveLarva(larvaId, targetUnitType)
    updateLarvaSpawning()
    
    // Persistence
    save(), load(), hasSavedGame()
}
```

**Events Emitted:**
- `resourcesUpdated` - Resources changed
- `unitCreated` - New unit spawned
- `buildingCreated` - New building placed
- `productionStarted`, `productionComplete`
- `larvaSpawned`, `larvaEvolved`

### 3. Faction System (`src/game/Faction.js`)

Three factions with unique characteristics:

```javascript
const FACTIONS = {
    zerg: {
        id: 'zerg',
        colors: { primary: '#8b00ff', secondary: '#4a0080' },
        advisor: {
            name: 'Overmind',
            personality: 'alien, collective, hungry',
            greetings: [...],  // Faction-specific phrases
            responses: { built: [...], produced: [...] }
        },
        worker: { name: 'Drone', cost: { minerals: 50 }, buildTime: 17 },
        supplyUnit: { name: 'Overlord', cost: { minerals: 100 } },
        buildings: {
            base: { name: 'Hatchery', spawnsLarva: true, larvaMax: 3 },
            barracks: { name: 'Spawning Pool', unlocks: ['zergling'] },
            // ...
        },
        units: {
            larva: { name: 'Larva', canEvolve: true },
            zergling: { name: 'Zergling', attack: 5, health: 35 },
            // ...
        }
    },
    human: { /* Similar structure */ },
    protoss: { /* Similar structure */ }
};
```

**Key Differences:**
| Faction | Worker | Base | Supply | Specialty |
|---------|--------|------|--------|-----------|
| Zerg | Drone (consumed on build) | Hatchery (spawns larva) | Overlord (unit) | Creep system, larva evolution |
| Human | SCV (stays during build) | Command Center | Supply Depot | Standard RTS build |
| Protoss | Probe (warps buildings) | Nexus | Pylon | Shields, warp-in |

### 4. AI Agent (`src/ai/Agent.js`)

OpenAI-powered strategic advisor:

```javascript
class AIAgent {
    faction: Object
    conversationHistory: Array
    apiKey: string
    voiceSynthesis: VoiceSynthesis
    lastState: Object         // For tracking state changes
    
    // Core methods
    sendMessage(userMessage): Promise<{ text, actions }>
    buildSystemPrompt(): string  // Faction-specific personality
    getGameContext(): Object     // Current game state for AI
    
    // Player action feedback
    notifyPlayerAction(actionType, details): Promise<string>
    getQuickFeedback(actionType, details): string
    
    // Response parsing
    parseActions(text): Action[]  // Extract [ACTION:type:target]
    executeActions(actions)       // Execute parsed commands
    
    // Greeting system
    generateDynamicGreeting(): Promise<string>
}
```

**Action Format:**
The AI can embed commands in responses using `[ACTION:type:target]` syntax:
- `[ACTION:BUILD:barracks]` - Build a barracks
- `[ACTION:TRAIN:marine]` - Train a marine
- `[ACTION:MINE]` - Assign workers to minerals

### 5. Voice Synthesis (`src/ai/VoiceSynthesis.js`)

ElevenLabs TTS for AI advisor voice:

```javascript
const VOICE_SETTINGS = {
    zerg: { stability: 0.3, playbackRate: 1.2 },    // Alien, fast
    human: { stability: 0.75, playbackRate: 1.0 },  // Professional
    protoss: { stability: 0.5, playbackRate: 0.95 } // Wise, deliberate
};

class VoiceSynthesis {
    speak(text, interrupt = true)
    stop()
    setEnabled(enabled)
    dispose()
}
```

### 6. Rendering System

#### Scene (`src/rendering/Scene.js`)
```javascript
class GameScene {
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    controls: OrbitControls     // Enabled with Shift key
    
    // Object management
    addObject(id, object)
    removeObject(id)
    disposeObject(object)       // Proper cleanup
    
    // Camera
    panCamera(dx, dz)
    setCameraTarget(x, y, z)
}
```

#### Terrain (`src/rendering/Terrain.js`)
```javascript
class TerrainRenderer {
    // Creates terrain mesh, resource nodes
    createTerrain()
    createMineralPatch(data)
    createGasGeyser(data)
    
    // Zerg creep system
    creepSources: Map
    createCreep(buildingId, x, z, radius)
    isOnCreep(x, z): boolean
    animateCreep(time)
}
```

#### Units (`src/rendering/UnitRenderer.js`)
```javascript
class UnitRenderer {
    units: Map<id, THREE.Group>
    
    createWorker(data)          // Worker model + cargo visual
    createLarva(data)           // Worm-like larva
    createEvolutionEgg(data)    // Pulsing egg during evolution
    createCombatUnit(data)      // Marine, zergling, zealot
    
    setSelected(unitId, selected)
    updateUnitPosition(unitId, x, z)
    animateUnits(time)          // Idle animations, cargo glow
}
```

### 7. Input Handling (`src/game/InputHandler.js`)

```javascript
class InputHandler {
    // Selection
    selectedUnits: Set<id>
    selectedBuilding: string | null
    
    // Click handling
    onLeftClick(event)          // Select unit/building
    onRightClick(event)         // Move/command
    
    // Box selection
    onMouseDown, onMouseMove, onMouseUp
    finishBoxSelection(addToSelection)
    
    // Commands
    commandMove(x, z)
    commandMineMinerals(resourceId)
    commandHarvestGas(resourceId)
    commandConstruct(buildingId)
    
    // Building placement mode
    enterBuildingPlacementMode(type, onPlace)
    cancelBuildingPlacement()
}
```

**Keyboard Shortcuts:**
- `B` - Open building menu
- `ESC` - Cancel placement / Close menus
- `Shift+Click` - Add to selection
- `Shift+Drag` - Orbit camera

### 8. GameActions (`src/game/GameActions.js`)

Executes game commands (from player or AI):

```javascript
class GameActions {
    buildStructure(type, position, workerId)
    trainUnit(building, unitType)
    assignMining(count)
    assignGasHarvesting(count)
    
    // Zerg-specific
    startZergConstruction(data)  // Drone transforms into building
}
```

**Building Construction Flow:**
1. **Human**: SCV goes to location, remains during construction
2. **Zerg**: Drone moves to location, is consumed, building grows
3. **Protoss**: Probe warps in building, can leave

### 9. UI Components

#### HUD (`src/ui/HUD.js`)
```javascript
class HUD {
    // Displays
    updateResources(data)
    updatePopulation()
    updateTimer()
    
    // Selection
    showSelection(entity, fullSelection)
    showBuildingSelection(building, onTrainUnit)
    showLarvaEvolutionOptions(larvaArray)
    showEggProgress(egg)
    
    // Production queue
    showProductionQueue()
    updateProductionQueueDisplay()
    cancelQueueItem(item)
    
    // In-game menu
    showInGameMenu()  // Pause menu with Resume/Settings/Quit
}
```

---

## Game Flow

### Startup Flow
```
1. Document ready → new Game()
2. Game.init() → Show main menu
3. User clicks "New Game" → Show faction select
4. User selects faction → startNewGame(factionId)
5. Initialize scene, terrain, renderers
6. Create starting base + workers
7. Initialize AI agent + chat
8. Start game loop
```

### Game Loop (60fps)
```
gameLoop()
├── Calculate deltaTime
├── update(deltaTime)
│   ├── gameState.gatherResources(dt)
│   ├── gameState.updateProductionQueue(dt)
│   ├── gameState.updateLarvaSpawning()  // Zerg
│   ├── updateUnitPositions(dt)          // Movement + collision
│   ├── updateBuildingConstruction()     // Progress overlays
│   └── checkHumanConstruction()         // Worker at site check
├── render()
│   ├── terrainRenderer.animateResources(time)
│   ├── terrainRenderer.animateCreep(time)
│   ├── unitRenderer.animateUnits(time)
│   ├── buildingRenderer.animateBuildings(time)
│   ├── scene.update()                   // OrbitControls
│   └── scene.render()
└── requestAnimationFrame(gameLoop)
```

### Resource Gathering
```
Worker assigned to mineral/gas
├── Set worker.task = 'mining' or 'harvesting'
├── Set worker.targetPosition = resource location
├── Worker moves toward resource
├── When at resource:
│   ├── Set worker.waitingAtResource = true
│   ├── Wait based on queue position
│   ├── Collect → set worker.carryingResources = true
│   ├── Move to base
│   └── Deposit → add resources, return to resource
```

### Unit Production
```
Player clicks train button
├── Check canAfford(cost) + canAddPopulation(1)
├── spendResources(cost)
├── addToProductionQueue(item)
├── updateProductionQueue(deltaTime) advances progress
├── completeProduction(item)
│   ├── Create unit at spawn position
│   ├── Emit 'unitCreated' event
│   └── Notify AI for feedback
```

### Zerg Larva Evolution
```
Hatchery complete
├── spawnInitialLarva(hatchery) × 3
├── updateLarvaSpawning() regenerates larva over time

Player selects larva → clicks evolution
├── evolveLarva(larvaId, targetUnitType)
│   ├── Check resources + requirements
│   ├── Create egg at larva position
│   ├── Remove larva from game
│   ├── Egg incubates (progress bar)
│   ├── Complete → spawn unit, remove egg
```

---

## State Persistence

### Save Format (localStorage)
```javascript
{
    faction: 'zerg',
    resources: { minerals: 500, gas: 100 },
    population: { current: 15, max: 26 },
    gameTime: 425.5,
    units: [
        { id: 'unit_1', type: 'worker', x: 10, z: 5, task: 'mining', ... }
    ],
    buildings: [
        { id: 'bld_1', type: 'base', x: 0, z: 0, isComplete: true, ... }
    ],
    productionQueue: [...],
    resources: [...]  // Mineral/gas node states
}
```

---

## Backend Server (`server/server.js`)

Express proxy for API calls (avoids CORS, secures keys):

```javascript
// Endpoints
GET  /health                          // Status check
POST /api/openai/chat/completions     // Proxy to OpenAI
POST /api/elevenlabs/tts/:voiceId     // Proxy to ElevenLabs

// CORS allowed origins
- http://localhost:5173  (Vite dev)
- http://localhost:3000
- https://galactic.falcusan.ro  (Production)
```

---

## Environment Variables

### Frontend (`.env`)
```env
VITE_API_BASE_URL=http://localhost:3001   # Backend proxy URL
VITE_OPENAI_API_KEY=sk-...                # Optional: direct API key
VITE_ELEVENLABS_API_KEY=...               # Optional: direct API key
```

### Backend (`server/.env`)
```env
PORT=3001
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=...
```

---

## Code Style & Conventions

### Naming
- **Classes**: PascalCase (`GameState`, `UnitRenderer`)
- **Methods**: camelCase (`createWorker`, `updatePosition`)
- **Constants**: UPPER_SNAKE (`MAX_POPULATION`, `FACTION_COLORS`)
- **Private**: Prefixed with underscore (rare)
- **IDs**: Snake case with prefix (`unit_1`, `bld_2`, `res_mineral_0`)

### Patterns
1. **Singleton**: `GameState` exported as instance
2. **Event Emitter**: GameState uses custom event system
3. **Factory Methods**: Renderer classes have `create*` methods
4. **Dispose Pattern**: All classes have `dispose()` for cleanup

### Memory Management
- Always call `dispose()` when destroying objects
- Remove event listeners in dispose
- Clear Three.js geometries, materials, textures
- Nullify references to break cycles

### CSS
- CSS Variables for theming
- BEM-like naming (`.faction-card`, `.faction-card h3`)
- Faction-specific colors via `[data-faction="zerg"]`

---

## Key Implementation Details

### Worker Assignment to Resources
Workers queue at resources. The system maintains worker order:
```javascript
gatherResources(deltaTime) {
    // Group workers by target resource
    // Apply GATHER_DELAY (0.5s) between workers
    // Workers wait if another is collecting
}
```

### Collision Detection
Units avoid buildings using AABB collision with navigation:
```javascript
checkBuildingCollisionWithNavigation(oldX, oldZ, newX, newZ, radius, moveDir)
// Slides units along building edges instead of stopping
```

### Zerg Creep
Creep spreads from Hatcheries/Creep Colonies:
```javascript
createCreep(buildingId, x, z, radius)
isOnCreep(x, z)  // Required for most Zerg buildings
animateCreep(time)  // Pulsing visual effect
```

### Production Queue
Multiple items can queue per building:
```javascript
productionQueue: [
    { type: 'worker', buildingId: 'bld_1', progress: 0.75, buildTime: 17 },
    { type: 'marine', buildingId: 'bld_2', progress: 0, buildTime: 25 }
]
```

---

## Common Modifications

### Adding a New Unit Type
1. Add to `Faction.js` under `units`
2. Add model path to `UnitRenderer.js` `MODEL_PATHS`
3. Add icon to `HUD.js` `getUnitIcon()`
4. If Zerg: add to larva evolution options

### Adding a New Building Type
1. Add to `Faction.js` under `buildings`
2. Add model to `BuildingRenderer.js`
3. Add to `BuildingPlacementUI.js` button list
4. Update `GameActions.buildStructure()` if special logic needed

### Modifying AI Behavior
1. Edit system prompt in `Agent.js` `buildSystemPrompt()`
2. Add faction-specific responses in `Faction.js` `advisor.responses`
3. For new action types: add parsing in `parseActions()`

---

## Testing & Running

```bash
# Development
npm run dev              # Start Vite dev server (port 5173)

# Backend (separate terminal)
cd server
npm install
npm start                # Start API proxy (port 3001)

# Production build
npm run build           # Output to dist/
npm run preview         # Preview production build
```

---

## Known Architecture Decisions

1. **No Framework**: Pure JS for simplicity and direct Three.js control
2. **Singleton GameState**: Global access, simpler than prop drilling
3. **Event System**: Loose coupling between game state and UI
4. **Backend Proxy**: Keeps API keys secure, handles CORS
5. **LocalStorage**: Simple persistence, no database needed
6. **GLTF Models**: Standard format, Kenney assets are free/commercial-use

---

## Future Extension Points

- **Multiplayer**: Replace localStorage with WebSocket sync
- **More Units**: Follow unit addition pattern above
- **Combat System**: Units have `attack`/`health` defined, needs battle logic
- **Tech Tree**: Buildings have `unlocks` arrays, needs research system
- **Map Editor**: Terrain/resources are procedurally placed, could save layouts
