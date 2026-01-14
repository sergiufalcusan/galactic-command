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
    // Settings modal for API keys
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-content">
        <h3>Settings</h3>
        
        <div class="settings-group">
          <label for="api-key-input">OpenAI API Key</label>
          <input type="password" id="api-key-input" placeholder="sk-..." value="${localStorage.getItem('openai_api_key') || ''}">
          <p class="settings-hint">For smarter AI responses. Leave empty for basic AI.</p>
        </div>
        
        <div class="settings-group">
          <label for="elevenlabs-key-input">ElevenLabs API Key</label>
          <input type="password" id="elevenlabs-key-input" placeholder="xi-..." value="${localStorage.getItem('elevenlabs_api_key') || ''}">
          <p class="settings-hint">Enable voice synthesis for AI responses.</p>
        </div>
        
        <div class="settings-group">
          <label class="toggle-label">
            <input type="checkbox" id="voice-enabled-toggle" ${localStorage.getItem('voice_enabled') === 'true' ? 'checked' : ''}>
            <span>Enable Voice</span>
          </label>
          <p class="settings-hint">AI advisor will speak responses aloud.</p>
        </div>
        
        <div class="settings-actions">
          <button id="settings-save" class="menu-btn primary">Save</button>
          <button id="settings-cancel" class="menu-btn tertiary">Cancel</button>
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
        .settings-group {
          margin-bottom: 20px;
        }
        .settings-group label {
          display: block;
          margin-bottom: 8px;
          color: var(--text-secondary);
        }
        .settings-group input {
          width: 100%;
          padding: 10px;
          background: var(--bg-darker);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          font-family: var(--font-body);
        }
        .settings-group input:focus {
          outline: none;
          border-color: var(--accent-primary);
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
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('#settings-save').addEventListener('click', () => {
      // Save OpenAI API key
      const apiKey = modal.querySelector('#api-key-input').value.trim();
      if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
      } else {
        localStorage.removeItem('openai_api_key');
      }

      // Save ElevenLabs API key
      const elevenLabsKey = modal.querySelector('#elevenlabs-key-input').value.trim();
      if (elevenLabsKey) {
        localStorage.setItem('elevenlabs_api_key', elevenLabsKey);
      } else {
        localStorage.removeItem('elevenlabs_api_key');
      }

      // Save voice enabled state
      const voiceEnabled = modal.querySelector('#voice-enabled-toggle').checked;
      localStorage.setItem('voice_enabled', voiceEnabled.toString());

      modal.remove();
    });

    modal.querySelector('#settings-cancel').addEventListener('click', () => {
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
