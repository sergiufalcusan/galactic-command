# Galactic Command - Gameplay Guide

> Complete guide for playing Galactic Command, covering controls, mechanics, and strategies.

---

## Getting Started

### Launching the Game
1. Run `npm run dev` to start the development server
2. Open `http://localhost:5173` in your browser
3. Click **New Game** from the main menu

### Choosing a Faction

| Faction | Playstyle | Difficulty |
|---------|-----------|------------|
| **Zerg** | Swarm tactics, fast production via larva evolution | Medium |
| **Human** | Balanced, industrial efficiency | Easy |
| **Protoss** | Elite units, quality over quantity | Hard |

---

## Controls

### Mouse
| Action | Input |
|--------|-------|
| Select unit/building | Left-click |
| Add to selection | Shift + Left-click |
| Box select units | Click and drag |
| Move selected units | Right-click on ground |
| Gather minerals | Right-click on mineral patch |
| Harvest gas | Right-click on gas geyser (requires extractor) |

### Keyboard
| Key | Action |
|-----|--------|
| `B` | Open building menu |
| `ESC` | Cancel placement / Close menus |
| `Shift` (hold) | Enable camera orbit (mouse drag to rotate) |

### Camera
- **WASD or Arrow Keys**: Not implemented (use edge panning or orbit)
- **Shift + Mouse Drag**: Orbit camera around target
- **Mouse Wheel**: Zoom in/out

---

## Resources

### Minerals 💎
- **Primary resource** for units and buildings
- Gathered by workers from blue mineral patches
- Starting amount: 50

### Vespene Gas 🔥
- **Secondary resource** for advanced units
- Requires building a Gas Extractor on a geyser
- Workers must be assigned to harvest gas

### Population 👥
- Each unit costs population
- Maximum population: 200
- Increase cap by building:
  - **Zerg**: Overlords (8 supply each)
  - **Human**: Supply Depots (8 supply each)
  - **Protoss**: Pylons (8 supply each)

---

## Workers

Workers are your economy foundation. Each faction has unique workers:

| Faction | Worker | Special Behavior |
|---------|--------|------------------|
| Zerg | **Drone** | Consumed when morphing into buildings |
| Human | **SCV** | Stays on-site during construction |
| Protoss | **Probe** | Warps in buildings, can leave |

### Worker Commands
1. **Select workers** → Right-click mineral patch to mine
2. **Select workers** → Right-click gas geyser (with extractor) to harvest gas
3. Workers automatically return resources to base

### Training Workers
- Select your main base (Hatchery/Command Center/Nexus)
- Click the worker icon in the action panel
- Cost: 50 minerals, takes ~17 seconds

---

## Buildings

Press `B` to open the building menu.

### Common Buildings (All Factions)

| Type | Purpose | Cost |
|------|---------|------|
| **Base** | Main structure, trains workers | 400m |
| **Supply** | Increases population cap | 100m |
| **Barracks** | Trains basic combat units | 150m |
| **Factory** | Trains advanced combat units | 150m + 100g |
| **Gas Extractor** | Allows gas harvesting | 75m |

### Building Process

1. Press `B` or click Build button
2. Select building type
3. Click on map to place (green = valid, red = invalid)
4. **Human**: SCV walks to site and builds
5. **Zerg**: Drone morphs into building (on creep!)
6. **Protoss**: Probe warps in building

### Zerg Creep Requirement
- Most Zerg buildings can **only be placed on creep**
- Creep spreads from Hatcheries
- Hatecheries and Extractors can be placed anywhere

---

## Unit Production

### Standard Production (Human/Protoss)
1. Select a production building (Barracks, Factory, etc.)
2. Click unit icon to queue training
3. Units spawn when complete
4. Multiple units can be queued

### Zerg Evolution (Larva System)
Zerg units are produced differently:

1. **Hatcheries spawn Larva** (up to 3, regenerate over time)
2. Select one or more Larva
3. Click evolution button (e.g., Drone, Zergling)
4. Larva becomes an **Egg** that incubates
5. Unit hatches when complete

**Tip**: Select multiple larva to evolve them all at once!

---

## Combat Units

### Zerg
| Unit | Cost | Role |
|------|------|------|
| Zergling | 50m | Fast melee swarm unit |
| Roach | 75m | Armored ranged unit |
| Hydralisk | 100m + 50g | Ranged anti-air |

### Human
| Unit | Cost | Role |
|------|------|------|
| Marine | 50m | Basic ranged infantry |
| Marauder | 100m + 25g | Armored anti-armor |
| Hellion | 100m | Fast harassment vehicle |

### Protoss
| Unit | Cost | Role |
|------|------|------|
| Zealot | 100m | Melee warrior with shields |
| Stalker | 125m + 50g | Ranged with blink |
| Immortal | 275m + 100g | Heavy anti-armor |

---

## AI Advisor

Your faction has an AI advisor with unique personality:

| Faction | Advisor | Personality |
|---------|---------|-------------|
| Zerg | **Overmind** | Alien, collective, hunger-driven |
| Human | **Adjutant** | Dry, sarcastic, professional |
| Protoss | **Executor** | Wise, proud, honorable |

### Chat Commands
Type in the chat panel to talk to your advisor:

```
"Build me a barracks"
"Train 5 marines"
"How many workers do I have?"
"What should I do next?"
```

The AI can **execute commands** for you based on your requests.

### Voice Feedback
- Enable in Settings
- Requires ElevenLabs API key
- Advisor speaks responses aloud

---

## Game Progression

### Early Game (0-5 min)
1. ✓ Build workers (aim for 16-20)
2. ✓ Assign workers to minerals
3. ✓ Build supply structures before supply blocked
4. ✓ Build a gas extractor when ready for advanced units

### Mid Game (5-15 min)
1. ✓ Build production buildings (Barracks, Factory)
2. ✓ Start training combat units
3. ✓ Expand to additional bases (optional)
4. ✓ Maintain worker production

### Tips
- **Don't get supply blocked** - Always build supply before hitting cap
- **Keep workers building** - Economy wins games
- **Use hotkeys** - `B` for buildings speeds things up
- **Check production queue** - See what's being built (right panel)

---

## Saving & Loading

### Save Game
- Click 💾 button in top-right during game
- Game auto-saves to browser localStorage

### Load Game
- From main menu, click **Load Game**
- Only one save slot available

### In-Game Menu
- Click ☰ button or press `ESC` with nothing selected
- Options: Resume, Settings, Quit to Menu

---

## Settings

Access from Main Menu → Settings:

| Setting | Description |
|---------|-------------|
| OpenAI API | Status of AI chat configuration |
| ElevenLabs API | Status of voice synthesis |
| Voice Toggle | Enable/disable advisor voice |

API keys are configured via `.env` file (not in UI).

---

## Troubleshooting

### "Not enough resources"
- Check mineral/gas count in top bar
- Train more workers and assign to gathering

### "Supply blocked"
- Population is at capacity
- Build Supply Depot (Human), Pylon (Protoss), or Overlord (Zerg)

### "Can only place on creep" (Zerg)
- Most Zerg buildings require creep
- Build near your Hatchery where purple creep is visible
- Hatcheries and Extractors don't need creep

### Workers not gathering
- Right-click on their target resource
- Make sure gas extractor is built for gas

### AI not responding
- Check if OpenAI API key is configured
- Look at browser console for errors
- Try simpler commands

---

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│            GALACTIC COMMAND                 │
├─────────────────────────────────────────────┤
│  CONTROLS                                   │
│  Left-click     Select                      │
│  Right-click    Command/Move                │
│  Shift+Click    Add to selection            │
│  B              Building menu               │
│  ESC            Cancel/Close                │
│  Shift+Drag     Orbit camera                │
├─────────────────────────────────────────────┤
│  ECONOMY                                    │
│  • Keep building workers (16-20 minimum)    │
│  • Always have workers on minerals          │
│  • Build extractor for gas-heavy builds     │
├─────────────────────────────────────────────┤
│  PRODUCTION                                 │
│  • Never get supply blocked                 │
│  • Queue multiple units                     │
│  • Zerg: Use larva evolution                │
├─────────────────────────────────────────────┤
│  COSTS                                      │
│  Worker     50m        Supply      100m     │
│  Barracks   150m       Factory     150m+100g│
│  Marine     50m        Zergling    50m      │
│  Zealot     100m       Stalker     125m+50g │
└─────────────────────────────────────────────┘
```
