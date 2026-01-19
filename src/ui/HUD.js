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

    showSelection(entity) {
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
        }

        // Larva evolution options (Zerg only)
        if (entity.type === 'larva' && gameState.faction?.id === 'zerg') {
            this.showLarvaEvolutionOptions(entity);
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

    // Show evolution options for a selected larva
    showLarvaEvolutionOptions(larva) {
        const faction = gameState.faction;
        if (!faction) return;

        const larvaConfig = faction.units.larva;
        if (!larvaConfig?.canEvolveInto) return;

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
            const canAfford = gameState.canAfford(cost);

            const btn = document.createElement('button');
            btn.className = 'action-btn evolution-btn' + (canAfford ? '' : ' disabled');
            btn.innerHTML = evo.icon;
            btn.title = `Evolve to ${evo.config.name} (${costText})`;
            btn.addEventListener('click', () => {
                if (canAfford) {
                    const result = gameState.evolveLarva(larva.id, evo.type);
                    if (result.success) {
                        this.showNotification(`Evolving to ${evo.config.name}...`);
                    } else {
                        this.showNotification(result.error || 'Cannot evolve');
                    }
                } else {
                    this.showNotification('Not enough resources!');
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
            // Zerg Hatchery uses larva system - no direct unit production
            if (faction.id === 'zerg') {
                // Show larva info instead of production buttons
                if (building.isComplete) {
                    const larvaInfo = document.createElement('div');
                    larvaInfo.className = 'larva-info';
                    larvaInfo.style.cssText = 'color: #8b00ff; font-size: 0.85rem; padding: 8px; text-align: center;';
                    const larvaCount = gameState.getLarvaForHatchery(building.id)?.length || 0;
                    larvaInfo.textContent = `Larva: ${larvaCount}/3 (click a larva to evolve)`;
                    this.actionButtons.appendChild(larvaInfo);
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
