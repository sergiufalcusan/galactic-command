/**
 * Main Menu UI Component
 */

export class MainMenu {
  constructor(onNewGame, onLoadGame) {
    this.onNewGame = onNewGame;
    this.onLoadGame = onLoadGame;

    this.menuScreen = document.getElementById('main-menu');
    this.newGameBtn = document.getElementById('btn-new-game');
    this.loadGameBtn = document.getElementById('btn-load-game');
    this.settingsBtn = document.getElementById('btn-settings');

    this.init();
  }

  init() {
    this.newGameBtn.addEventListener('click', () => {
      if (this.onNewGame) this.onNewGame();
    });

    this.loadGameBtn.addEventListener('click', () => {
      if (this.onLoadGame) this.onLoadGame();
    });

    this.settingsBtn.addEventListener('click', () => {
      this.showSettings();
    });
  }

  show() {
    this.menuScreen.classList.add('active');
  }

  hide() {
    this.menuScreen.classList.remove('active');
  }

  enableLoadGame(enabled) {
    this.loadGameBtn.disabled = !enabled;
    this.loadGameBtn.style.opacity = enabled ? '1' : '0.5';
  }

  showSettings() {
    // Settings modal - simplified, keys are stored in backend
    const modal = document.createElement('div');
    modal.className = 'settings-modal';

    // Get current voice setting from localStorage (default to true)
    const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';

    modal.innerHTML = `
      <div class="settings-content">
        <h3>Settings</h3>
        
        <div class="settings-group">
          <h4>Voice Settings</h4>
          <label class="settings-toggle">
            <input type="checkbox" id="voice-toggle" ${voiceEnabled ? 'checked' : ''}>
            <span>Enable AI Voice (ElevenLabs)</span>
          </label>
          <p class="settings-hint">Enable or disable AI voice synthesis for advisor feedback.</p>
        </div>
        
        <div class="settings-actions">
          <button id="settings-close" class="menu-btn primary">Close</button>
        </div>
      </div>
    `;

    // Add modal styles if not present
    if (!document.querySelector('#settings-modal-styles')) {
      const style = document.createElement('style');
      style.id = 'settings-modal-styles';
      style.textContent = `
        .settings-modal {
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
        .settings-content {
          background: var(--bg-panel);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          max-width: 90%;
        }
        .settings-content h3 {
          font-family: var(--font-display);
          margin-bottom: 20px;
          color: var(--accent-primary);
        }
        .settings-content h4 {
          margin-bottom: 10px;
          color: var(--text-primary);
        }
        .settings-group {
          margin-bottom: 20px;
        }
        .settings-hint {
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-top: 8px;
        }
        .settings-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .settings-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: var(--text-primary);
        }
        .settings-toggle input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .settings-toggle input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#settings-close').addEventListener('click', () => {
      modal.remove();
    });

    // Voice toggle listener
    const voiceToggle = modal.querySelector('#voice-toggle');
    if (voiceToggle) {
      voiceToggle.addEventListener('change', (e) => {
        localStorage.setItem('voiceEnabled', e.target.checked ? 'true' : 'false');
        // Dispatch event for game to react
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
}

export default MainMenu;
