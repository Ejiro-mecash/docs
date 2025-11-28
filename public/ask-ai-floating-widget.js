(function () {
  // Prevent duplicate initialization
  if (document.getElementById('me-cash-ask-ai-host')) return;

  // Configuration
  const CONFIG = {
    endpoint: 'https://ask-my-docs-black.vercel.app/ask', // Production endpoint
    primaryColor: '#240552',
    accentColor: '#7d3be2',
    textColor: '#ffffff',
    botName: 'meCash AI',
    welcomeMessage: 'Hi! Ask me anything about the meCash API.'
  };

  // Create Host Element
  const host = document.createElement('div');
  host.id = 'me-cash-ask-ai-host';
  document.body.appendChild(host);

  // Create Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Launcher Button */
    .launcher {
      width: 60px;
      height: 60px;
      border-radius: 30px;
      background: linear-gradient(135deg, ${CONFIG.accentColor}, ${CONFIG.primaryColor});
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
      outline: none;
    }
    .launcher:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.2);
    }
    .launcher svg {
      width: 32px;
      height: 32px;
      fill: ${CONFIG.textColor};
    }
    
    /* Chat Window */
    .window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 100px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px);
      pointer-events: none;
      transition: opacity 0.3s, transform 0.3s;
      border: 1px solid rgba(0,0,0,0.1);
    }
    .window.open {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }
    
    /* Header */
    .header {
      padding: 16px;
      background: ${CONFIG.primaryColor};
      color: ${CONFIG.textColor};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .close-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.8);
      cursor: pointer;
      font-size: 20px;
      padding: 0;
      line-height: 1;
    }
    .close-btn:hover {
      color: white;
    }
    
    /* Messages Area */
    .messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8f9fa;
    }
    .message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
    }
    .message.ai {
      background: white;
      border: 1px solid rgba(0,0,0,0.05);
      align-self: flex-start;
      color: #333;
    }
    .message.user {
      background: ${CONFIG.accentColor};
      color: white;
      align-self: flex-end;
    }
    .message.error {
      background: #fee2e2;
      color: #dc2626;
      font-size: 12px;
      align-self: center;
    }
    
    /* Input Area */
    .input-area {
      padding: 16px;
      border-top: 1px solid rgba(0,0,0,0.05);
      background: white;
      display: flex;
      gap: 8px;
    }
    input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      outline: none;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: ${CONFIG.accentColor};
    }
    button.send-btn {
      background: ${CONFIG.primaryColor};
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button.send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
      .window {
        width: calc(100vw - 40px);
        right: 0;
        bottom: 80px;
      }
    }
  `;

  // HTML Structure
  const container = document.createElement('div');
  container.innerHTML = `
    <button class="launcher" aria-label="Open AI Chat">
      <svg viewBox="0 0 24 24">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    </button>
    
    <div class="window">
      <div class="header">
        <h2>${CONFIG.botName}</h2>
        <button class="close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="messages">
        <div class="message ai">${CONFIG.welcomeMessage}</div>
      </div>
      <form class="input-area">
        <input type="text" placeholder="Ask a question..." required>
        <button type="submit" class="send-btn">Send</button>
      </form>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);

  // Logic
  const launcher = shadow.querySelector('.launcher');
  const windowEl = shadow.querySelector('.window');
  const closeBtn = shadow.querySelector('.close-btn');
  const form = shadow.querySelector('form');
  const input = shadow.querySelector('input');
  const messagesEl = shadow.querySelector('.messages');
  const sendBtn = shadow.querySelector('.send-btn');

  let isOpen = false;
  let history = [];

  function toggleWindow() {
    isOpen = !isOpen;
    if (isOpen) {
      windowEl.classList.add('open');
      input.focus();
    } else {
      windowEl.classList.remove('open');
    }
  }

  function addMessage(role, text) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    // UI Updates
    addMessage('user', question);
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      const res = await fetch(CONFIG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history: history.slice(-6) // Keep last 6 messages for context
        })
      });

      if (!res.ok) throw new Error('Failed to get response');

      const data = await res.json();
      const answer = data.answer || "I'm sorry, I couldn't understand that.";

      addMessage('ai', answer);
      history.push({ role: 'user', content: question });
      history.push({ role: 'assistant', content: answer });

    } catch (err) {
      console.error(err);
      addMessage('error', 'Sorry, something went wrong. Please try again later.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // Event Listeners
  launcher.addEventListener('click', toggleWindow);
  closeBtn.addEventListener('click', toggleWindow);
  form.addEventListener('submit', handleSubmit);

})();
