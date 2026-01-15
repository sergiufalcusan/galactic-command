/**
 * Building Placement UI - Shows available buildings when 'B' key is pressed
 */

import gameState from '../game/GameState.js';

export class BuildingPlacementUI {
    constructor(onBuildingSelected, onCancel) {
        this.onBuildingSelected = onBuildingSelected;
        this.onCancel = onCancel;
        this.container = null;
        this.isVisible = false;
    }

    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.render();
    }

    hide() {
        if (!this.isVisible) return;
        this.isVisible = false;
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
            if (this.onCancel) this.onCancel();
        } else {
            this.show();
        }
    }

    render() {
        const faction = gameState.faction;
        if (!faction) return;

        this.container = document.createElement('div');
        this.container.className = 'building-placement-ui';
        this.container.innerHTML = `
            <div class="building-panel">
                <h3>Build Structure</h3>
                <div class="building-list">
                    ${this.getBuildingButtons(faction)}
                </div>
                <p class="building-hint">Click a building, then click on the map to place it.<br>Press <kbd>ESC</kbd> to cancel.</p>
            </div>
        `;

        this.addStyles();
        document.body.appendChild(this.container);

        // Add click handlers
        this.container.querySelectorAll('.building-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const buildingType = btn.dataset.type;
                this.hide();
                if (this.onBuildingSelected) {
                    this.onBuildingSelected(buildingType);
                }
            });
        });

        // Close on background click
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
                if (this.onCancel) this.onCancel();
            }
        });
    }

    getBuildingButtons(faction) {
        const buildings = [
            { type: 'supply', key: 'S', name: faction.buildings?.supply?.name || faction.supplyUnit?.name || 'Supply', cost: faction.buildings?.supply?.cost || faction.supplyUnit?.cost },
            { type: 'barracks', key: 'R', name: faction.buildings?.barracks?.name || 'Barracks', cost: faction.buildings?.barracks?.cost },
            { type: 'factory', key: 'F', name: faction.buildings?.factory?.name || 'Factory', cost: faction.buildings?.factory?.cost },
            { type: 'gasExtractor', key: 'G', name: faction.buildings?.gasExtractor?.name || 'Gas Extractor', cost: faction.buildings?.gasExtractor?.cost }
        ];

        return buildings.map(b => {
            if (!b.cost) return '';
            const canAfford = gameState.canAfford(b.cost);
            return `
                <button class="building-btn ${canAfford ? '' : 'disabled'}" data-type="${b.type}" ${canAfford ? '' : 'disabled'}>
                    <span class="building-key">${b.key}</span>
                    <span class="building-name">${b.name}</span>
                    <span class="building-cost">${b.cost.minerals}m ${b.cost.gas > 0 ? b.cost.gas + 'g' : ''}</span>
                </button>
            `;
        }).join('');
    }

    addStyles() {
        if (document.querySelector('#building-placement-styles')) return;

        const style = document.createElement('style');
        style.id = 'building-placement-styles';
        style.textContent = `
            .building-placement-ui {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 500;
            }
            .building-panel {
                background: var(--bg-panel);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 20px;
                min-width: 300px;
            }
            .building-panel h3 {
                font-family: var(--font-display);
                color: var(--accent-primary);
                margin-bottom: 16px;
                text-align: center;
            }
            .building-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .building-btn {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--bg-darker);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                color: var(--text-primary);
            }
            .building-btn:hover:not(.disabled) {
                border-color: var(--accent-primary);
                background: rgba(0, 212, 255, 0.1);
            }
            .building-btn.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .building-key {
                background: var(--accent-primary);
                color: var(--bg-darker);
                font-weight: bold;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                font-size: 0.9rem;
            }
            .building-name {
                flex: 1;
                text-align: left;
            }
            .building-cost {
                color: var(--text-muted);
                font-size: 0.85rem;
            }
            .building-hint {
                text-align: center;
                color: var(--text-muted);
                font-size: 0.85rem;
                margin-top: 16px;
                line-height: 1.6;
            }
            .building-hint kbd {
                background: var(--bg-darker);
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid var(--border-color);
            }
        `;
        document.head.appendChild(style);
    }

    dispose() {
        this.hide();
    }
}

export default BuildingPlacementUI;
