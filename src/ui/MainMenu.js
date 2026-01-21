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
    this.howToPlayBtn = document.getElementById('btn-how-to-play');

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

    this.howToPlayBtn?.addEventListener('click', () => {
      this.showHowToPlay();
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

  showHowToPlay() {
    const modal = document.createElement('div');
    modal.className = 'htp-modal';
    modal.innerHTML = `
      <div class="htp-content">
        <h3>❓ How to Play</h3>
        
        <div class="htp-columns">
          <div class="htp-column htp-left">
            <div class="htp-section">
              <h4>🎮 Controls</h4>
              <table class="htp-table">
                <tr><td><kbd>Left Click</kbd></td><td>Select units/buildings</td></tr>
                <tr><td><kbd>Right Click</kbd></td><td>Move / Gather resources</td></tr>
                <tr><td><kbd>Shift + Drag</kbd></td><td>Rotate camera</td></tr>
                <tr><td><kbd>B</kbd></td><td>Open building menu</td></tr>
                <tr><td><kbd>1-9</kbd></td><td>Building hotkeys</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Cancel / Close menus</td></tr>
              </table>
            </div>
            
            <div class="htp-section">
              <h4>⚡ Quick Tips</h4>
              <ul class="htp-tips">
                <li>Build workers early for faster income</li>
                <li>Expand supply to train more units</li>
                <li>Zerg: Evolve larva into units</li>
                <li>Right-click minerals to mine</li>
              </ul>
            </div>
          </div>
          
          <div class="htp-column htp-right">
            <div class="htp-section">
              <h4>🤖 AI Advisor</h4>
              <p class="htp-hint">Your faction has an AI advisor that watches the game and provides strategic guidance. It will comment on your actions and offer suggestions!</p>
            </div>
            
            <div class="htp-section">
              <h4>💬 Chat Prompts</h4>
              <p class="htp-hint">Type in the chat box to ask your advisor:</p>
              <ul class="htp-prompts">
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
        
        <div class="htp-actions">
          <button id="how-to-play-close" class="menu-btn primary">Got it!</button>
        </div>
      </div>
    `;

    // Add how-to-play styles (remove old first for dev hot-reload)
    const existingStyle = document.querySelector('#htp-styles');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.id = 'htp-styles';
    style.textContent = `
      .htp-modal {
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
      .htp-content {
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 24px;
        width: 750px;
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
      }
      .htp-content h3 {
        font-family: var(--font-display);
        text-align: center;
        margin-bottom: 20px;
        color: var(--accent-primary);
      }
      .htp-content h4 {
        color: var(--accent-primary);
        margin-bottom: 12px;
        font-size: 1.1rem;
        font-family: var(--font-display);
      }
      .htp-columns {
        display: flex;
        gap: 30px;
      }
      .htp-column {
        flex: 1;
        min-width: 0;
      }
      .htp-left {
        border-right: 1px solid var(--border-color);
        padding-right: 25px;
      }
      .htp-right {
        padding-left: 5px;
      }
      .htp-section {
        margin-bottom: 20px;
      }
      .htp-table {
        width: 100%;
        border-collapse: collapse;
      }
      .htp-table td {
        padding: 8px 10px;
        border-bottom: 1px solid var(--border-color);
        font-size: 0.9rem;
      }
      .htp-table td:first-child {
        width: 45%;
        color: var(--accent-secondary);
      }
      .htp-table kbd {
        background: var(--bg-darker);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 3px 8px;
        font-family: monospace;
        font-size: 0.85rem;
        color: var(--text-primary);
      }
      .htp-hint {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin-bottom: 12px;
        line-height: 1.5;
      }
      .htp-prompts {
        list-style: none;
        padding: 0;
      }
      .htp-prompts li {
        padding: 6px 0;
        color: var(--text-primary);
        font-size: 0.9rem;
      }
      .htp-prompts em {
        color: var(--accent-secondary);
        font-style: normal;
        background: var(--bg-darker);
        padding: 2px 8px;
        border-radius: 4px;
      }
      .htp-tips {
        padding-left: 20px;
        color: var(--text-primary);
      }
      .htp-tips li {
        padding: 5px 0;
        font-size: 0.9rem;
      }
      .htp-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
      }
      @media (max-width: 700px) {
        .htp-columns {
          flex-direction: column;
        }
        .htp-left {
          border-right: none;
          border-bottom: 1px solid var(--border-color);
          padding-right: 0;
          padding-bottom: 20px;
        }
        .htp-right {
          padding-left: 0;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(modal);

    modal.querySelector('#how-to-play-close').addEventListener('click', () => {
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
