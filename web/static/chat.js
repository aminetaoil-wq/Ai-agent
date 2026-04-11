// StoneLinked Klantenservice — Chatwidget logica

(function () {
  const messagesEl  = document.getElementById('messages');
  const inputEl     = document.getElementById('chat-input');
  const sendBtn     = document.getElementById('send-btn');
  const suggestionsEl = document.getElementById('suggestions');

  let sessionId = '';
  let isLoading = false;

  // ── Markdown renderer (eenvoudig, zonder externe bibliotheek) ──────
  function renderMarkdown(text) {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Ordered lists
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Unordered lists
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> blocks in <ul>
      .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
      // Headings
      .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.+)$/gm,  '<h2>$1</h2>')
      .replace(/^#\s+(.+)$/gm,   '<h1>$1</h1>')
      // Line breaks → paragraphs (double newlines)
      .replace(/\n\n+/g, '</p><p>')
      // Single newlines inside paragraph
      .replace(/\n/g, '<br>')
      // Wrap in paragraph
      .replace(/^/, '<p>')
      .replace(/$/, '</p>')
      // Clean up empty paragraphs
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<[uh][l1-3]>)/g, '$1')
      .replace(/(<\/[uh][l1-3]>)<\/p>/g, '$1');
  }

  // ── Voeg een bericht toe aan de chat ──────────────────────────────
  function addMessage(role, text) {
    // Verwijder welkomstbericht als het er nog is
    const welcome = messagesEl.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'U' : 'StoneLinked';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (role === 'agent') {
      bubble.innerHTML = renderMarkdown(text);
    } else {
      bubble.textContent = text;
    }

    wrapper.appendChild(label);
    wrapper.appendChild(bubble);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  // ── Toon/verberg typing indicator ─────────────────────────────────
  function showTyping() {
    const welcome = messagesEl.querySelector('.welcome-msg');
    if (welcome) welcome.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'message agent';
    wrapper.id = 'typing-indicator';

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = 'StoneLinked';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    wrapper.appendChild(label);
    wrapper.appendChild(indicator);
    messagesEl.appendChild(wrapper);
    scrollToBottom();
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Verstuur bericht naar de API ──────────────────────────────────
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;

    // Verberg suggesties na eerste bericht
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    addMessage('user', text);
    inputEl.value = '';
    autoResizeTextarea();

    showTyping();

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      sessionId = data.session_id;

      hideTyping();
      addMessage('agent', data.response);

    } catch (err) {
      hideTyping();
      addMessage(
        'agent',
        'Er is een fout opgetreden. Probeer het opnieuw of neem contact op via info@stonelinked.com.'
      );
      console.error('Chat error:', err);
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
    }
  }

  // ── Textarea auto-resize ───────────────────────────────────────────
  function autoResizeTextarea() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  // ── Event listeners ────────────────────────────────────────────────
  sendBtn.addEventListener('click', () => sendMessage(inputEl.value));

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  inputEl.addEventListener('input', autoResizeTextarea);

  // Suggestie knoppen
  document.querySelectorAll('.suggestion-btn').forEach((btn) => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
  });

  // Focus op input bij laden
  inputEl.focus();
})();
