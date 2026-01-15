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
    // Settings modal (API keys moved to .env file)
    const modal = document.createElement('div');
    modal.className = 'settings-modal';

    const hasOpenAI = !!import.meta.env.VITE_OPENAI_API_KEY;
    const hasElevenLabs = !!import.meta.env.VITE_ELEVENLABS_API_KEY;

    modal.innerHTML = `
      <div class="settings-content">
        <h3>Settings</h3>
        
        <div class="settings-group">
          <h4>API Configuration</h4>
          <p class="settings-hint">API keys are now configured via the <code>.env</code> file in the project root.</p>
          <p class="settings-hint">Copy <code>.env.example</code> to <code>.env</code> and add your keys.</p>
        </div>
        
        <div class="settings-group">
          <p class="settings-status">
            OpenAI API: <span class="${hasOpenAI ? 'status-ok' : 'status-missing'}">${hasOpenAI ? '✓ Configured' : '✗ Not configured'}</span>
          </p>
          <p class="settings-status">
            ElevenLabs Voice: <span class="${hasElevenLabs ? 'status-ok' : 'status-missing'}">${hasElevenLabs ? '✓ Configured' : '✗ Not configured'}</span>
          </p>
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
        .settings-hint code {
          background: var(--bg-darker);
          padding: 2px 6px;
          border-radius: 3px;
          color: var(--accent-primary);
        }
        .settings-status {
          margin: 8px 0;
          color: var(--text-secondary);
        }
        .status-ok {
          color: #00ff00;
        }
        .status-missing {
          color: #ff6600;
        }
        .settings-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#settings-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

export default MainMenu;
