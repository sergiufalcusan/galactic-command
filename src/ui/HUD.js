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
    }

    addActionButton(icon, tooltip, onClick) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = icon;
        btn.title = tooltip;
        btn.addEventListener('click', onClick);
        this.actionButtons.appendChild(btn);
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
        const modal = document.createElement('div');
        modal.className = 'ingame-menu-modal';
        modal.innerHTML = `
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

        document.body.appendChild(modal);

        modal.querySelector('#ingame-resume').addEventListener('click', () => {
            modal.remove();
        });

        modal.querySelector('#ingame-save').addEventListener('click', () => {
            if (gameState.save()) {
                this.showNotification('Game Saved!');
            }
            modal.remove();
        });

        modal.querySelector('#ingame-quit').addEventListener('click', () => {
            modal.remove();
            // Dispatch custom event for main.js to handle
            window.dispatchEvent(new CustomEvent('quitToMenu'));
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

export default HUD;
