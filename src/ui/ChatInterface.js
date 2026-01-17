/**
 * Chat Interface UI Component
 */

export class ChatInterface {
    constructor(container, agent, onSystemMessage) {
        this.container = container;
        this.agent = agent;
        this.onSystemMessage = onSystemMessage;

        this.messagesContainer = null;
        this.inputField = null;
        this.sendButton = null;
        this.toggleButton = null;
        this.advisorName = null;
        this.isMinimized = false;

        this.init();
    }

    init() {
        this.messagesContainer = this.container.querySelector('#chat-messages');
        this.inputField = this.container.querySelector('#chat-input');
        this.sendButton = this.container.querySelector('#chat-send');
        this.toggleButton = this.container.querySelector('#chat-toggle');
        this.advisorName = this.container.querySelector('#advisor-name');

        // Handlers for removal
        this.handlers = {
            onSend: () => this.handleSend(),
            onKeyPress: (e) => {
                if (e.key === 'Enter') {
                    this.handleSend();
                }
            },
            onToggle: () => this.toggleMinimize()
        };

        // Set advisor name
        if (this.agent && this.agent.faction) {
            this.advisorName.textContent = this.agent.faction.advisor.name;
            this.advisorName.style.color = this.agent.faction.colors.primary;
        }

        // Event listeners
        this.sendButton.addEventListener('click', this.handlers.onSend);
        this.inputField.addEventListener('keypress', this.handlers.onKeyPress);
        this.toggleButton.addEventListener('click', this.handlers.onToggle);

        // Add initial greeting
        if (this.agent) {
            setTimeout(() => {
                const greeting = this.agent.getGreeting();
                this.addMessage(greeting, 'ai');
            }, 500);
        }
    }

    dispose() {
        if (this.handlers) {
            this.sendButton.removeEventListener('click', this.handlers.onSend);
            this.inputField.removeEventListener('keypress', this.handlers.onKeyPress);
            this.toggleButton.removeEventListener('click', this.handlers.onToggle);
        }
        // Clear chat messages when switching games
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }
    }

    async handleSend() {
        const message = this.inputField.value.trim();
        if (!message) return;

        // Clear input
        this.inputField.value = '';

        // Add user message
        this.addMessage(message, 'user');

        // Get AI response
        if (this.agent) {
            // Show typing indicator
            const typingId = this.addTypingIndicator();

            const response = await this.agent.sendMessage(message);

            // Remove typing indicator
            this.removeTypingIndicator(typingId);

            // Add AI response
            this.addMessage(response.text, 'ai');

            // Show action feedback
            if (response.actions && response.actions.length > 0) {
                response.actions.forEach(action => {
                    this.addMessage(`Executing: ${action.type} ${action.target || ''}`, 'system');
                });
            }
        }
    }

    addMessage(text, type) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${type}`;
        messageEl.textContent = text;

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();

        return messageEl;
    }

    addTypingIndicator() {
        const id = `typing_${Date.now()}`;
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message ai typing';
        typingEl.id = id;
        typingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';

        // Add CSS for typing animation
        if (!document.querySelector('#typing-styles')) {
            const style = document.createElement('style');
            style.id = 'typing-styles';
            style.textContent = `
        .chat-message.typing .dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #00d4ff;
          border-radius: 50%;
          margin: 0 2px;
          animation: typing-bounce 1.4s ease-in-out infinite;
        }
        .chat-message.typing .dot:nth-child(2) { animation-delay: 0.2s; }
        .chat-message.typing .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
      `;
            document.head.appendChild(style);
        }

        this.messagesContainer.appendChild(typingEl);
        this.scrollToBottom();

        return id;
    }

    removeTypingIndicator(id) {
        const typingEl = document.getElementById(id);
        if (typingEl) {
            typingEl.remove();
        }
    }

    addSystemMessage(text) {
        this.addMessage(text, 'system');
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.container.classList.toggle('minimized', this.isMinimized);
        this.toggleButton.textContent = this.isMinimized ? '+' : '−';
    }

    focus() {
        this.inputField.focus();
    }

    clear() {
        this.messagesContainer.innerHTML = '';
    }
}

export default ChatInterface;
