/**
 * In-Game HUD Component
 */

import gameState from '../game/GameState.js';

export class HUD {
    constructor() {
        this.mineralsDisplay = document.getElementById('minerals-count');
        this.gasDisplay = document.getElementById('gas-count');
        this.populationDisplay = document.getElementById('population-count');
        this.populationMaxDisplay = document.getElementById('population-max');
        this.gameTimer = document.getElementById('game-timer');
        this.saveBtn = document.getElementById('btn-save-game');
        this.menuBtn = document.getElementById('btn-game-menu');
        this.selectionPanel = document.getElementById('selection-panel');
        this.selectedInfo = document.getElementById('selected-info');
        this.actionButtons = document.getElementById('action-buttons');

        // Production queue panel
        this.productionQueuePanel = document.getElementById('production-queue-panel');
        this.queueItems = document.getElementById('queue-items');
        this.selectedBuildingId = null;

        // Callbacks for external handlers
        this.onBuildMenu = null; // Callback to open building menu (like 'B' key)

        this.init();
    }

    init() {
        // Handlers for removal
        this.handlers = {
            onSave: () => {
                if (gameState.save()) {
                    this.showNotification('Game Saved!');
                }
            },
            onMenu: () => this.showInGameMenu(),
            onResources: (data) => this.updateResources(data),
            onTime: () => this.updateTimer(),
            onProduction: (item) => this.showNotification(`${item.name} ready!`)
        };

        // UI buttons
        this.saveBtn.addEventListener('click', this.handlers.onSave);
        this.menuBtn.addEventListener('click', this.handlers.onMenu);

        // Subscribe to game state updates
        gameState.on('resourcesUpdated', this.handlers.onResources);
        gameState.on('timeUpdated', this.handlers.onTime);
        gameState.on('productionComplete', this.handlers.onProduction);
    }

    dispose() {
        // Remove UI listeners
        this.saveBtn.removeEventListener('click', this.handlers.onSave);
        this.menuBtn.removeEventListener('click', this.handlers.onMenu);

        // Unsubscribe from game state
        gameState.off('resourcesUpdated', this.handlers.onResources);
        gameState.off('timeUpdated', this.handlers.onTime);
        gameState.off('productionComplete', this.handlers.onProduction);
    }

    update() {
        const state = gameState.getState();
        this.mineralsDisplay.textContent = state.minerals;
        this.gasDisplay.textContent = state.gas;
        this.populationDisplay.textContent = state.population;
        this.populationMaxDisplay.textContent = state.populationMax;
        this.gameTimer.textContent = state.gameTime;
    }

    updateResources(data) {
        this.mineralsDisplay.textContent = Math.floor(data.minerals);
        this.gasDisplay.textContent = Math.floor(data.gas);

        // Flash animation on resource change
        this.mineralsDisplay.parentElement.classList.add('updated');
        setTimeout(() => {
            this.mineralsDisplay.parentElement.classList.remove('updated');
        }, 300);
    }

    updateTimer() {
        this.gameTimer.textContent = gameState.getFormattedGameTime();
    }

    updatePopulation() {
        const state = gameState.getState();
        this.populationDisplay.textContent = state.population;
        this.populationMaxDisplay.textContent = state.populationMax;

        // Warning color when near cap
        const ratio = state.population / state.populationMax;
        if (ratio >= 0.9) {
            this.populationDisplay.style.color = '#ff3366';
        } else if (ratio >= 0.7) {
            this.populationDisplay.style.color = '#ff8800';
        } else {
            this.populationDisplay.style.color = '';
        }
    }

    showSelection(entity, fullSelection = null) {
        // Hide production queue when selecting non-building
        this.selectedBuildingId = null;
        this.hideProductionQueue();

        if (!entity) {
            this.selectedInfo.querySelector('.selected-name').textContent = 'Nothing selected';
            this.actionButtons.innerHTML = '';
            return;
        }

        this.selectedInfo.querySelector('.selected-name').textContent = entity.name || entity.type;

        // Show relevant action buttons
        this.actionButtons.innerHTML = '';

        if (entity.type === 'worker') {
            this.addActionButton('⛏️', 'Mine', () => gameState.assignWorkerToMinerals(entity.id));
            this.addActionButton('🔥', 'Gas', () => gameState.assignWorkerToGas(entity.id));
            this.addActionButton('🏗️', 'Build (B)', () => {
                if (this.onBuildMenu) {
                    this.onBuildMenu();
                }
            });
        }

        // Larva evolution options (Zerg only) - support multi-selection
        if (entity.type === 'larva' && gameState.faction?.id === 'zerg') {
            // Filter to only larva from the full selection
            const selectedLarva = fullSelection
                ? fullSelection.filter(u => u.type === 'larva')
                : [entity];
            this.showLarvaEvolutionOptions(selectedLarva);
        }

        // Evolution egg - show progress
        if (entity.type === 'egg' && entity.evolvingTo) {
            this.showEggProgress(entity);
        }
    }

    // Show evolution progress for a selected egg
    showEggProgress(egg) {
        // Find the production queue item for this egg
        const queueItem = gameState.productionQueue.find(item =>
            item.isEvolution && item.eggId === egg.id
        );

        const evolveInfo = document.createElement('div');
        evolveInfo.className = 'egg-progress-info';
        evolveInfo.style.cssText = 'padding: 10px; text-align: center;';

        if (queueItem) {
            const progress = queueItem.progress / queueItem.buildTime;
            const timeRemaining = Math.ceil(queueItem.buildTime - queueItem.progress);

            evolveInfo.innerHTML = `
                <div style="color: #8b00ff; font-weight: bold; margin-bottom: 8px;">🥚 Evolving to ${queueItem.name}</div>
                <div style="background: #333; border-radius: 4px; height: 8px; margin: 8px 0; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #8b00ff, #ff6600); height: 100%; width: ${progress * 100}%; transition: width 0.3s;"></div>
                </div>
                <div style="color: #aaa; font-size: 0.9rem;">${timeRemaining}s remaining</div>
            `;
        } else {
            evolveInfo.innerHTML = `
                <div style="color: #8b00ff;">🥚 ${egg.name || 'Evolving...'}</div>
            `;
        }

        this.actionButtons.appendChild(evolveInfo);
    }

    // Show evolution options for selected larva (supports multi-selection)
    showLarvaEvolutionOptions(larvaOrArray) {
        const faction = gameState.faction;
        if (!faction) return;

        // Support both single larva and array of larva
        const larvaList = Array.isArray(larvaOrArray) ? larvaOrArray : [larvaOrArray];

        // Filter to only valid larva that still exist
        this.selectedLarvaList = larvaList.filter(l =>
            gameState.units.find(u => u.id === l.id && u.type === 'larva')
        );

        if (this.selectedLarvaList.length === 0) {
            this.actionButtons.innerHTML = '<div style="color: #888; padding: 8px;">No larva selected</div>';
            return;
        }

        // Initialize or validate current index
        if (this.selectedLarvaIndex === undefined || this.selectedLarvaIndex >= this.selectedLarvaList.length) {
            this.selectedLarvaIndex = 0;
        }

        const currentLarva = this.selectedLarvaList[this.selectedLarvaIndex];

        const larvaConfig = faction.units.larva;
        if (!larvaConfig?.canEvolveInto) return;

        // Show larva counter if multiple selected
        if (this.selectedLarvaList.length > 1) {
            const counter = document.createElement('div');
            counter.className = 'larva-counter';
            counter.style.cssText = 'color: #8b00ff; font-size: 0.85rem; padding: 4px; text-align: center; margin-bottom: 8px;';
            counter.textContent = `Larva ${this.selectedLarvaIndex + 1}/${this.selectedLarvaList.length}`;
            this.actionButtons.appendChild(counter);
        }

        // Build list of available evolutions
        const evolutions = [];

        larvaConfig.canEvolveInto.forEach(unitType => {
            let unitConfig, icon;

            if (unitType === 'drone') {
                unitConfig = faction.worker;
                icon = '🐜';
            } else if (unitType === 'overlord') {
                unitConfig = faction.supplyUnit;
                icon = '🎈';
            } else {
                unitConfig = faction.units[unitType];
                icon = this.getUnitIcon(unitType);
            }

            if (!unitConfig) return;

            // Check tech requirements
            if (unitConfig.requiresBuilding) {
                const hasBuilding = gameState.buildings.some(b =>
                    b.type === unitConfig.requiresBuilding && b.isComplete
                );
                if (!hasBuilding) return; // Skip - tech not researched
            }

            evolutions.push({
                type: unitType,
                config: unitConfig,
                icon: icon
            });
        });

        // Add evolution buttons
        evolutions.forEach(evo => {
            const cost = evo.config.cost;
            const costText = `${cost.minerals}m${cost.gas > 0 ? ` ${cost.gas}g` : ''}`;

            const btn = document.createElement('button');
            btn.className = 'action-btn evolution-btn';
            btn.innerHTML = evo.icon;
            btn.title = `Evolve to ${evo.config.name} (${costText})`;
            btn.addEventListener('click', () => {
                // Check affordability at CLICK time, not selection time
                if (!gameState.canAfford(cost)) {
                    this.showNotification('Not enough resources!');
                    return;
                }

                const result = gameState.evolveLarva(currentLarva.id, evo.type);
                if (result.success) {
                    this.showNotification(`Evolving to ${evo.config.name}...`);

                    // Move to next larva in selection
                    this.selectedLarvaList = this.selectedLarvaList.filter(l => l.id !== currentLarva.id);
                    if (this.selectedLarvaList.length > 0) {
                        // Keep same index (which now points to next larva) or wrap
                        if (this.selectedLarvaIndex >= this.selectedLarvaList.length) {
                            this.selectedLarvaIndex = 0;
                        }
                        // Refresh UI with remaining larva
                        this.actionButtons.innerHTML = '';
                        this.showLarvaEvolutionOptions(this.selectedLarvaList);
                    } else {
                        // No more larva, clear selection
                        this.actionButtons.innerHTML = '';
                        this.selectedInfo.querySelector('.selected-name').textContent = 'Nothing selected';
                    }
                } else {
                    this.showNotification(result.error || 'Cannot evolve');
                }
            });
            this.actionButtons.appendChild(btn);
        });
    }

    addActionButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = icon;
        btn.title = tooltip;
        btn.addEventListener('click', onClick);
        this.actionButtons.appendChild(btn);
    }

    showBuildingSelection(building, onTrainUnit) {
        if (!building) {
            this.showSelection(null);
            this.selectedBuildingId = null;
            this.hideProductionQueue();
            return;
        }

        this.selectedBuildingId = building.id;
        this.selectedInfo.querySelector('.selected-name').textContent = building.name || building.type;
        this.actionButtons.innerHTML = '';

        // Get faction data for production options
        const faction = gameState.faction;
        if (!faction) return;

        // Determine what units this building can produce
        let trainableUnits = [];

        const buildingType = building.type?.toLowerCase();

        // Base buildings can train workers (except Zerg which uses larva)
        if (buildingType === 'base' || buildingType === 'hatchery') {
            // Zerg Hatchery - show production options that consume larva
            if (faction.id === 'zerg') {
                if (building.isComplete) {
                    const larvaIds = gameState.getLarvaForHatchery(building.id) || [];
                    const larvaCount = larvaIds.length;

                    // Show larva count
                    const larvaInfo = document.createElement('div');
                    larvaInfo.className = 'larva-info';
                    larvaInfo.style.cssText = 'color: #8b00ff; font-size: 0.85rem; padding: 4px; text-align: center; margin-bottom: 8px;';
                    larvaInfo.textContent = `Available Larva: ${larvaCount}/3`;
                    this.actionButtons.appendChild(larvaInfo);

                    // Get units that can be evolved from larva
                    const larvaConfig = faction.units.larva;
                    if (larvaConfig?.canEvolveInto) {
                        larvaConfig.canEvolveInto.forEach(unitType => {
                            let unitConfig, unitName;
                            if (unitType === 'drone') {
                                unitConfig = faction.worker;
                                unitName = 'Drone';
                            } else if (unitType === 'overlord') {
                                unitConfig = faction.supplyUnit;
                                unitName = 'Overlord';
                            } else {
                                unitConfig = faction.units[unitType];
                                unitName = unitConfig?.name || unitType;
                            }

                            if (!unitConfig) return;

                            const canAfford = gameState.canAfford(unitConfig.cost);
                            const hasLarva = larvaCount > 0;
                            const hasSupply = unitType === 'overlord' || gameState.canAddPopulation(unitConfig.population || 1);

                            // Check tech requirements
                            let hasTech = true;
                            if (unitConfig.requiresBuilding) {
                                hasTech = gameState.buildings.some(b =>
                                    b.type === unitConfig.requiresBuilding && b.isComplete
                                );
                            }

                            const enabled = canAfford && hasLarva && hasSupply && hasTech;

                            const btn = document.createElement('button');
                            btn.className = 'action-btn';
                            btn.disabled = !enabled;
                            btn.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 60px; padding: 6px;';
                            btn.style.opacity = enabled ? '1' : '0.5';

                            const cost = unitConfig.cost;
                            let costText = `${cost.minerals}m`;
                            if (cost.gas > 0) costText += ` ${cost.gas}g`;

                            // Create structured content
                            const iconSpan = document.createElement('span');
                            iconSpan.style.fontSize = '1.5rem';
                            iconSpan.textContent = this.getUnitIcon(unitType);

                            const nameSpan = document.createElement('span');
                            nameSpan.style.cssText = 'font-size: 0.65rem; white-space: nowrap;';
                            nameSpan.textContent = unitName;

                            const costSpan = document.createElement('span');
                            costSpan.style.cssText = 'font-size: 0.6rem; color: #aaa;';
                            costSpan.textContent = costText;

                            btn.appendChild(iconSpan);
                            btn.appendChild(nameSpan);
                            btn.appendChild(costSpan);

                            btn.onclick = () => {
                                // Re-check larva at click time
                                const currentLarvaIds = gameState.getLarvaForHatchery(building.id) || [];
                                if (currentLarvaIds.length === 0) {
                                    this.showNotification('No larva available!', 'error');
                                    return;
                                }
                                // Re-check affordability at click time
                                if (!gameState.canAfford(unitConfig.cost)) {
                                    this.showNotification('Not enough resources!', 'error');
                                    return;
                                }
                                // Pick a larva and evolve it
                                const larvaId = currentLarvaIds[0];
                                const result = gameState.evolveLarva(larvaId, unitType);
                                if (result.success) {
                                    this.showNotification(`Evolving ${unitName}...`);
                                    // Refresh the building selection to update larva count
                                    this.showBuildingSelection(building, onTrainUnit);
                                } else {
                                    this.showNotification(result.error, 'error');
                                }
                            };

                            this.actionButtons.appendChild(btn);
                        });
                    }
                }
            } else {
                trainableUnits.push({
                    key: 'worker',
                    data: faction.worker,
                    icon: this.getUnitIcon('worker')
                });
            }
        }

        // Barracks/Gateway/Spawning Pool can train basic combat units
        if (buildingType === 'barracks') {
            const barracksData = faction.buildings.barracks;
            if (barracksData?.unlocks) {
                barracksData.unlocks.forEach(unitKey => {
                    const unitData = faction.units[unitKey];
                    if (unitData) {
                        trainableUnits.push({
                            key: unitKey,
                            data: unitData,
                            icon: this.getUnitIcon(unitKey)
                        });
                    }
                });
            }
        }

        // Factory can train advanced units
        if (buildingType === 'factory') {
            const factoryData = faction.buildings.factory;
            if (factoryData?.unlocks) {
                factoryData.unlocks.forEach(unitKey => {
                    const unitData = faction.units[unitKey];
                    if (unitData) {
                        trainableUnits.push({
                            key: unitKey,
                            data: unitData,
                            icon: this.getUnitIcon(unitKey)
                        });
                    }
                });
            }
        }

        // Only show production buttons if building is complete
        if (building.isComplete && trainableUnits.length > 0) {
            trainableUnits.forEach(unit => {
                const cost = unit.data.cost;
                const costText = `${cost.minerals}m${cost.gas > 0 ? ` ${cost.gas}g` : ''}`;
                this.addProductionButton(
                    unit.icon,
                    `Train ${unit.data.name} (${costText})`,
                    () => onTrainUnit(unit.key)
                );
            });
        } else if (!building.isComplete) {
            const note = document.createElement('div');
            note.className = 'building-note';
            note.textContent = 'Under Construction...';
            note.style.cssText = 'color: #ffcc00; font-size: 0.8rem; padding: 8px;';
            this.actionButtons.appendChild(note);
        }

        // Show production queue for this building
        this.updateProductionQueueDisplay();
    }

    addProductionButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        btn.className = 'action-btn production-btn';
        btn.innerHTML = icon;
        btn.title = tooltip;
        btn.addEventListener('click', onClick);
        this.actionButtons.appendChild(btn);
    }

    getUnitIcon(unitKey) {
        const icons = {
            // Human
            marine: '🔫',
            marauder: '💪',
            hellion: '🔥',
            // Zerg
            zergling: '🐛',
            roach: '🪲',
            hydralisk: '🐍',
            // Protoss
            zealot: '⚔️',
            stalker: '🎯',
            immortal: '🛡️',
            // Generic
            worker: '👷',
            drone: '🐜',
            scv: '🔧',
            probe: '💠'
        };
        return icons[unitKey] || '⚙️';
    }

    // Production Queue Methods
    showProductionQueue() {
        if (this.productionQueuePanel) {
            this.productionQueuePanel.classList.remove('hidden');
        }
    }

    hideProductionQueue() {
        if (this.productionQueuePanel) {
            this.productionQueuePanel.classList.add('hidden');
        }
        this.selectedBuildingId = null;
    }

    updateProductionQueueDisplay() {
        if (!this.selectedBuildingId || !this.queueItems) {
            return;
        }

        // Get production items for the selected building
        const queuedItems = gameState.productionQueue.filter(item => {
            // Match by buildingId for buildings under construction
            if (item.buildingId === this.selectedBuildingId) return true;
            // Match unit production by producerId (specific building instance)
            if (item.category === 'unit' && item.producerId === this.selectedBuildingId) return true;
            return false;
        });

        // Create a key to identify when queue changes
        const queueKey = queuedItems.map(item => `${item.unitType || item.type}_${item.startTime}`).join('|');

        // Only rebuild DOM if queue composition changed
        if (this.lastQueueKey !== queueKey) {
            this.lastQueueKey = queueKey;
            this.queueItems.innerHTML = '';

            if (queuedItems.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'queue-empty';
                emptyMsg.textContent = 'No units in queue';
                this.queueItems.appendChild(emptyMsg);
                this.showProductionQueue();
                return;
            }

            queuedItems.forEach((item, index) => {
                const queueItem = document.createElement('div');
                queueItem.className = 'queue-item';
                queueItem.dataset.index = index;

                const icon = item.category === 'unit' ? this.getUnitIcon(item.unitType) : '🏗️';
                const displayName = item.name || item.unitType || 'Unknown';

                // First item is in production (no cancel), others can be cancelled
                const isInProgress = index === 0;
                const cancelButton = isInProgress
                    ? '<div class="queue-item-status">🔄</div>'
                    : `<button class="queue-item-cancel" data-queue-index="${index}" title="Cancel">✕</button>`;

                queueItem.innerHTML = `
                    <div class="queue-item-icon">${icon}</div>
                    <div class="queue-item-details">
                        <div class="queue-item-name">${displayName}</div>
                        <div class="queue-item-progress">
                            <div class="queue-item-progress-bar"></div>
                        </div>
                        <div class="queue-item-time"></div>
                    </div>
                    ${cancelButton}
                `;

                // Add cancel click handler for non-in-progress items
                if (!isInProgress) {
                    const cancelBtn = queueItem.querySelector('.queue-item-cancel');
                    cancelBtn?.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.cancelQueueItem(item);
                    });
                }

                this.queueItems.appendChild(queueItem);
            });
        }

        // Update progress bars and time (this can happen every frame without flicker)
        const queueItemElements = this.queueItems.querySelectorAll('.queue-item');
        queuedItems.forEach((item, index) => {
            const queueItemEl = queueItemElements[index];
            if (queueItemEl) {
                const progress = Math.min(1, (item.progress || 0) / (item.buildTime || 1));
                const timeRemaining = Math.max(0, (item.buildTime || 0) - (item.progress || 0));

                const progressBar = queueItemEl.querySelector('.queue-item-progress-bar');
                const timeEl = queueItemEl.querySelector('.queue-item-time');

                if (progressBar) {
                    progressBar.style.width = `${progress * 100}%`;
                }
                if (timeEl) {
                    timeEl.textContent = `${Math.ceil(timeRemaining)}s remaining`;
                }
            }
        });

        this.showProductionQueue();
    }

    getSelectedBuildingType() {
        if (!this.selectedBuildingId) return null;
        const building = gameState.buildings.find(b => b.id === this.selectedBuildingId);
        return building ? building.type : null;
    }

    cancelQueueItem(item) {
        // Remove item from production queue
        const index = gameState.productionQueue.indexOf(item);
        if (index > -1) {
            gameState.productionQueue.splice(index, 1);

            // Refund resources based on unit type
            const faction = gameState.faction;
            if (item.category === 'unit' && faction) {
                let unitConfig = null;
                if (item.unitType === 'worker') {
                    unitConfig = faction.worker;
                } else if (faction.units[item.unitType]) {
                    unitConfig = faction.units[item.unitType];
                }

                if (unitConfig?.cost) {
                    gameState.minerals += unitConfig.cost.minerals || 0;
                    gameState.gas += unitConfig.cost.gas || 0;
                }
            }

            // Force queue display refresh
            this.lastQueueKey = null;
            this.updateProductionQueueDisplay();

            this.showNotification(`Cancelled ${item.name || item.unitType}`);
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'hud-notification';
        notification.textContent = message;

        // Add notification styles if not present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
        .hud-notification {
          position: fixed;
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-panel);
          border: 1px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: 10px 24px;
          border-radius: 4px;
          font-family: var(--font-display);
          font-size: 0.9rem;
          animation: notification-in 0.3s ease, notification-out 0.3s ease 2s forwards;
          z-index: 100;
        }
        @keyframes notification-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes notification-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .resource.updated {
          animation: resource-flash 0.3s ease;
        }
        @keyframes resource-flash {
          0%, 100% { background: var(--bg-panel); }
          50% { background: rgba(0, 212, 255, 0.3); }
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2500);
    }

    showInGameMenu() {
        if (this.menuModal) return; // Menu already open

        this.menuModal = document.createElement('div');
        this.menuModal.className = 'ingame-menu-modal';
        this.menuModal.innerHTML = `
      <div class="ingame-menu-content">
        <h3>Game Menu</h3>
        <button id="ingame-resume" class="menu-btn primary">Resume</button>
        <button id="ingame-save" class="menu-btn secondary">Save Game</button>
        <button id="ingame-settings" class="menu-btn secondary">Settings</button>
        <button id="ingame-how-to-play" class="menu-btn secondary">How to Play</button>
        <button id="ingame-quit" class="menu-btn tertiary">Quit to Menu</button>
      </div>
    `;

        // Add styles
        if (!document.querySelector('#ingame-menu-styles')) {
            const style = document.createElement('style');
            style.id = 'ingame-menu-styles';
            style.textContent = `
        .ingame-menu-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .ingame-menu-content {
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
        }
        .ingame-menu-content h3 {
          font-family: var(--font-display);
          margin-bottom: 24px;
          color: var(--text-primary);
        }
        .ingame-menu-content button {
          display: block;
          width: 200px;
          margin: 8px auto;
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(this.menuModal);

        this.menuModal.querySelector('#ingame-resume').addEventListener('click', () => {
            this.closeInGameMenu();
        });

        this.menuModal.querySelector('#ingame-save').addEventListener('click', () => {
            if (gameState.save()) {
                this.showNotification('Game Saved!');
            }
            this.closeInGameMenu();
        });

        this.menuModal.querySelector('#ingame-settings').addEventListener('click', () => {
            this.closeInGameMenu();
            this.showInGameSettings();
        });

        this.menuModal.querySelector('#ingame-how-to-play').addEventListener('click', () => {
            this.closeInGameMenu();
            this.showInGameHowToPlay();
        });

        this.menuModal.querySelector('#ingame-quit').addEventListener('click', () => {
            this.closeInGameMenu();
            // Dispatch custom event for main.js to handle
            window.dispatchEvent(new CustomEvent('quitToMenu'));
        });

        this.menuModal.addEventListener('click', (e) => {
            if (e.target === this.menuModal) {
                this.closeInGameMenu();
            }
        });
    }

    showInGameSettings() {
        const modal = document.createElement('div');
        modal.className = 'ingame-settings-modal';

        const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';

        modal.innerHTML = `
      <div class="ingame-settings-content">
        <h3>Settings</h3>
        
        <div class="ingame-settings-group">
          <h4>Voice Settings</h4>
          <label class="ingame-settings-toggle">
            <input type="checkbox" id="ingame-voice-toggle" ${voiceEnabled ? 'checked' : ''}>
            <span>Enable AI Voice (ElevenLabs)</span>
          </label>
          <p class="ingame-settings-hint">Enable or disable AI voice synthesis for advisor feedback.</p>
        </div>
        
        <div class="ingame-settings-actions">
          <button id="ingame-settings-close" class="menu-btn primary">Close</button>
        </div>
      </div>
    `;

        // Add styles
        if (!document.querySelector('#ingame-settings-styles')) {
            const style = document.createElement('style');
            style.id = 'ingame-settings-styles';
            style.textContent = `
        .ingame-settings-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
        }
        .ingame-settings-content {
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          max-width: 90%;
        }
        .ingame-settings-content h3 {
          font-family: var(--font-display);
          margin-bottom: 20px;
          color: var(--accent-primary);
        }
        .ingame-settings-content h4 {
          margin-bottom: 10px;
          color: var(--text-primary);
        }
        .ingame-settings-group {
          margin-bottom: 20px;
        }
        .ingame-settings-hint {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 8px;
        }
        .ingame-settings-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .ingame-settings-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: var(--text-primary);
        }
        .ingame-settings-toggle input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(modal);

        modal.querySelector('#ingame-settings-close').addEventListener('click', () => {
            modal.remove();
        });

        const voiceToggle = modal.querySelector('#ingame-voice-toggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('change', (e) => {
                localStorage.setItem('voiceEnabled', e.target.checked ? 'true' : 'false');
                window.dispatchEvent(new CustomEvent('voiceSettingChanged', {
                    detail: { enabled: e.target.checked }
                }));
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    showInGameHowToPlay() {
        const modal = document.createElement('div');
        modal.className = 'ingame-htp-modal';
        modal.innerHTML = `
      <div class="ingame-htp-content">
        <h3>❓ How to Play</h3>
        
        <div class="ingame-htp-columns">
          <div class="ingame-htp-column ingame-htp-left">
            <div class="ingame-htp-section">
              <h4>🎮 Controls</h4>
              <table class="ingame-htp-table">
                <tr><td><kbd>Left Click</kbd></td><td>Select units/buildings</td></tr>
                <tr><td><kbd>Right Click</kbd></td><td>Move / Gather resources</td></tr>
                <tr><td><kbd>Shift + Drag</kbd></td><td>Rotate camera</td></tr>
                <tr><td><kbd>B</kbd></td><td>Open building menu</td></tr>
                <tr><td><kbd>1-9</kbd></td><td>Building hotkeys</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Cancel / Close menus</td></tr>
              </table>
            </div>
            
            <div class="ingame-htp-section">
              <h4>⚡ Quick Tips</h4>
              <ul class="ingame-htp-tips">
                <li>Build workers early for faster income</li>
                <li>Expand supply to train more units</li>
                <li>Zerg: Evolve larva into units</li>
                <li>Right-click minerals to mine</li>
              </ul>
            </div>
          </div>
          
          <div class="ingame-htp-column ingame-htp-right">
            <div class="ingame-htp-section">
              <h4>🤖 AI Advisor</h4>
              <p class="ingame-htp-hint">Your faction has an AI advisor that watches the game and provides strategic guidance. It will comment on your actions and offer suggestions!</p>
            </div>
            
            <div class="ingame-htp-section">
              <h4>💬 Chat Prompts</h4>
              <p class="ingame-htp-hint">Type in the chat box to ask your advisor:</p>
              <ul class="ingame-htp-prompts">
                <li><em>"What should I build next?"</em></li>
                <li><em>"How do I get more supply?"</em></li>
                <li><em>"Explain Zerg strategy"</em></li>
                <li><em>"What units counter marines?"</em></li>
                <li><em>"Help me improve my economy"</em></li>
                <li><em>"When should I attack?"</em></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="ingame-htp-actions">
          <button id="ingame-htp-close" class="menu-btn primary">Got it!</button>
        </div>
      </div>
    `;

        // Add styles
        const existingStyle = document.querySelector('#ingame-htp-styles');
        if (existingStyle) existingStyle.remove();

        const style = document.createElement('style');
        style.id = 'ingame-htp-styles';
        style.textContent = `
      .ingame-htp-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1001;
      }
      .ingame-htp-content {
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
        width: 750px;
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
      }
      .ingame-htp-content h3 {
        font-family: var(--font-display);
        text-align: center;
        margin-bottom: 20px;
        color: var(--accent-primary);
      }
      .ingame-htp-content h4 {
        color: var(--accent-primary);
        margin-bottom: 12px;
        font-size: 1.1rem;
        font-family: var(--font-display);
      }
      .ingame-htp-columns {
        display: flex;
        gap: 30px;
      }
      .ingame-htp-column {
        flex: 1;
        min-width: 0;
      }
      .ingame-htp-left {
        border-right: 1px solid var(--border-color);
        padding-right: 25px;
      }
      .ingame-htp-right {
        padding-left: 5px;
      }
      .ingame-htp-section {
        margin-bottom: 20px;
      }
      .ingame-htp-table {
        width: 100%;
        border-collapse: collapse;
      }
      .ingame-htp-table td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--border-color);
        font-size: 0.9rem;
      }
      .ingame-htp-table td:first-child {
        width: 45%;
        color: var(--accent-secondary);
      }
      .ingame-htp-table kbd {
        background: var(--bg-darker);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 3px 8px;
        font-family: monospace;
        font-size: 0.85rem;
        color: var(--text-primary);
      }
      .ingame-htp-hint {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .ingame-htp-prompts {
        list-style: none;
        padding: 0;
      }
      .ingame-htp-prompts li {
        padding: 6px 0;
        color: var(--text-primary);
        font-size: 0.9rem;
      }
      .ingame-htp-prompts em {
        color: var(--accent-secondary);
        font-style: normal;
        background: var(--bg-darker);
        padding: 2px 8px;
        border-radius: 4px;
      }
      .ingame-htp-tips {
        padding-left: 20px;
        color: var(--text-primary);
      }
      .ingame-htp-tips li {
        padding: 5px 0;
        font-size: 0.9rem;
      }
      .ingame-htp-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
      }
      @media (max-width: 700px) {
        .ingame-htp-columns {
          flex-direction: column;
        }
        .ingame-htp-left {
          border-right: none;
          border-bottom: 1px solid var(--border-color);
          padding-right: 0;
          padding-bottom: 20px;
        }
        .ingame-htp-right {
          padding-left: 0;
        }
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(modal);

        modal.querySelector('#ingame-htp-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    closeInGameMenu() {
        if (this.menuModal) {
            this.menuModal.remove();
            this.menuModal = null;
        }
    }

    toggleInGameMenu() {
        if (this.menuModal) {
            this.closeInGameMenu();
        } else {
            this.showInGameMenu();
        }
    }

    isMenuOpen() {
        return !!this.menuModal;
    }
}

export default HUD;
