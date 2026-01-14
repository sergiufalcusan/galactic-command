/**
 * Faction Selection UI Component
 */

export class FactionSelect {
    constructor(onFactionSelected, onBack) {
        this.onFactionSelected = onFactionSelected;
        this.onBack = onBack;

        this.screen = document.getElementById('faction-select');
        this.cards = document.querySelectorAll('.faction-card');
        this.startBtn = document.getElementById('btn-start-game');
        this.backBtn = document.getElementById('btn-back-menu');

        this.selectedFaction = null;

        this.init();
    }

    init() {
        // Faction card selection
        this.cards.forEach(card => {
            card.addEventListener('click', () => {
                this.selectFaction(card.dataset.faction);
            });

            // Hover sound effect could be added here
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = 'translateY(-8px)';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = '';
                }
            });
        });

        // Start button
        this.startBtn.addEventListener('click', () => {
            if (this.selectedFaction && this.onFactionSelected) {
                this.onFactionSelected(this.selectedFaction);
            }
        });

        // Back button
        this.backBtn.addEventListener('click', () => {
            if (this.onBack) this.onBack();
        });
    }

    selectFaction(factionId) {
        // Deselect all
        this.cards.forEach(card => {
            card.classList.remove('selected');
        });

        // Select clicked faction
        const selectedCard = document.querySelector(`.faction-card[data-faction="${factionId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            this.selectedFaction = factionId;
            this.startBtn.disabled = false;

            // Add selection animation
            selectedCard.style.transform = 'translateY(-8px) scale(1.02)';
        }
    }

    show() {
        this.screen.classList.add('active');
        this.reset();
    }

    hide() {
        this.screen.classList.remove('active');
    }

    reset() {
        this.selectedFaction = null;
        this.startBtn.disabled = true;
        this.cards.forEach(card => {
            card.classList.remove('selected');
            card.style.transform = '';
        });
    }
}

export default FactionSelect;
