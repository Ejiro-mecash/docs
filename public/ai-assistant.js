// meCash Docs Assistant: floating chat widget. Mintlify loads every .js file in the docs repo on every page.
// Backend lives in ai-assistant/ (deployed to Vercel). Set ENDPOINT to that deployment's /api/ask URL.
(function () {
  var ENDPOINT = 'https://YOUR-ASSISTANT.vercel.app/api/ask';
  var SUGGESTIONS = [
    'How do I make my first payout?',
    'What payment channels does USD support?',
    'How do I verify webhook signatures?',
    'How do I create a virtual account?',
  ];

  if (typeof window === 'undefined' || window.__mecashAssistant) return;
  if (ENDPOINT.indexOf('YOUR-ASSISTANT') !== -1) return; // not deployed yet
  window.__mecashAssistant = true;

  var history = [];
  var busy = false;

  function init() {
    if (document.getElementById('mecash-assistant')) return;
    var host = document.createElement('div');
    host.id = 'mecash-assistant';
    document.body.appendChild(host);
    // Client-side page changes can replace <body> children; put the widget back if that happens.
    new MutationObserver(function () {
      if (!document.body.contains(host)) document.body.appendChild(host);
    }).observe(document.body, { childList: true });
    var root = host.attachShadow({ mode: 'open' });

    root.innerHTML =
      '<style>' + STYLES + '</style>' +
      '<button class="launcher" aria-label="Ask AI about the meCash docs" title="Ask AI (Ctrl+I)">' + ICON_SPARK + '<span>Ask AI</span></button>' +
      '<section class="panel" role="dialog" aria-label="meCash Docs Assistant" hidden>' +
        '<header><div class="brand">' + ICON_SPARK + '<div><strong>meCash Docs Assistant</strong><small>Answers from the meCash docs</small></div></div>' +
        '<div class="actions"><button class="reset" title="New chat" aria-label="New chat">' + ICON_RESET + '</button>' +
        '<button class="close" title="Close" aria-label="Close">' + ICON_CLOSE + '</button></div></header>' +
        '<div class="messages" aria-live="polite"></div>' +
        '<form><textarea rows="1" placeholder="Ask about payouts, quotes, webhooks..." aria-label="Your question" maxlength="2000"></textarea>' +
        '<button type="submit" aria-label="Send">' + ICON_SEND + '</button></form>' +
        '<footer>AI answers can be wrong. Check the linked pages before going live.</footer>' +
      '</section>';

    var launcher = root.querySelector('.launcher');
    var panel = root.querySelector('.panel');
    var list = root.querySelector('.messages');
    var form = root.querySelector('form');
    var input = root.querySelector('textarea');
    var sendBtn = form.querySelector('button');

    function syncTheme() {
      host.setAttribute('data-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
    syncTheme();
    new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    function open() {
      panel.hidden = false;
      launcher.hidden = true;
      if (!list.children.length) renderWelcome();
      input.focus();
    }
    function close() {
      panel.hidden = true;
      launcher.hidden = false;
    }

    function renderWelcome() {
      list.innerHTML = '';
      var welcome = el('div', 'welcome');
      welcome.innerHTML = '<p>Hi! Ask me anything about integrating with the meCash API.</p>';
      var chips = el('div', 'suggestions');
      SUGGESTIONS.forEach(function (text) {
        var chip = el('button', 'chip');
        chip.type = 'button';
        chip.textContent = text;
        chip.addEventListener('click', function () { ask(text); });
        chips.appendChild(chip);
      });
      welcome.appendChild(chips);
      list.appendChild(welcome);
    }

    function addMessage(role, text) {
      var msg = el('div', 'msg ' + role);
      var bubble = el('div', 'bubble');
      if (role === 'user') bubble.textContent = text;
      else bubble.innerHTML = text ? renderMarkdown(text) : '<span class="typing"><i></i><i></i><i></i></span>';
      msg.appendChild(bubble);
      list.appendChild(msg);
      list.scrollTop = list.scrollHeight;
      return msg;
    }

    function renderSources(msg, sources) {
      if (!sources || !sources.length) return;
      var box = el('div', 'sources');
      box.innerHTML = '<span>Sources</span>';
      sources.slice(0, 4).forEach(function (s) {
        var a = el('a', 'source');
        a.href = s.url;
        a.textContent = s.title;
        box.appendChild(a);
      });
      msg.appendChild(box);
    }

    async function ask(question) {
      question = (question || '').trim();
      if (!question || busy) return;
      busy = true;
      sendBtn.disabled = true;
      var welcome = list.querySelector('.welcome');
      if (welcome) welcome.remove();
      addMessage('user', question);
      var msg = addMessage('assistant', '');
      var bubble = msg.querySelector('.bubble');
      var answer = '';
      var sources = [];
      var failed = false;
      var frame = 0;

      function paint() {
        frame = 0;
        bubble.innerHTML = renderMarkdown(answer);
        list.scrollTop = list.scrollHeight;
      }

      try {
        var res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: question, history: history }),
        });
        if (!res.ok || !res.body) {
          var err = await res.json().catch(function () { return {}; });
          throw new Error(err.error || 'The assistant is unavailable right now.');
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        while (true) {
          var step = await reader.read();
          if (step.done) break;
          buffer += decoder.decode(step.value, { stream: true });
          var events = buffer.split('\n\n');
          buffer = events.pop();
          events.forEach(function (raw) {
            if (raw.indexOf('data: ') !== 0) return;
            var event = JSON.parse(raw.slice(6));
            if (event.type === 'sources') sources = event.sources;
            else if (event.type === 'text') {
              answer += event.text;
              if (!frame) frame = requestAnimationFrame(paint);
            } else if (event.type === 'error') {
              failed = true;
              answer += (answer ? '\n\n' : '') + event.error;
            }
          });
        }
        paint();
        if (failed) msg.classList.add('error');
        else {
          renderSources(msg, sources);
          history.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
          history = history.slice(-6);
        }
      } catch (e) {
        msg.classList.add('error');
        bubble.textContent = e.message || 'Something went wrong. Please try again.';
      } finally {
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    launcher.addEventListener('click', open);
    root.querySelector('.close').addEventListener('click', close);
    root.querySelector('.reset').addEventListener('click', function () {
      if (busy) return;
      history = [];
      renderWelcome();
      input.focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value;
      input.value = '';
      input.style.height = '';
      ask(q);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    input.addEventListener('input', function () {
      input.style.height = '';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    list.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.copy');
      if (!btn) return;
      navigator.clipboard.writeText(btn.parentElement.querySelector('code').textContent).then(function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1500);
      });
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        panel.hidden ? open() : close();
      } else if (e.key === 'Escape' && !panel.hidden) close();
    });
  }

  function el(tag, cls) {
    var node = document.createElement(tag);
    node.className = cls;
    return node;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function inline(s) {
    return escapeHtml(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
  }

  // Small markdown renderer: fenced code, inline code, bold, links, headings, lists, paragraphs.
  // Everything is HTML-escaped first, so model output can never inject markup.
  function renderMarkdown(md) {
    var out = [];
    var parts = md.split(/```/);
    parts.forEach(function (part, i) {
      if (i % 2 === 1) {
        var nl = part.indexOf('\n');
        var lang = nl === -1 ? '' : part.slice(0, nl).trim();
        var code = nl === -1 ? part : part.slice(nl + 1);
        out.push('<div class="code"><div class="code-head"><span>' + escapeHtml(lang || 'code') +
          '</span><button class="copy" type="button">Copy</button></div><pre><code>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre></div>');
        return;
      }
      var listType = null;
      part.split('\n').forEach(function (line) {
        var bullet = line.match(/^\s*[-*]\s+(.*)/);
        var numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
        var type = bullet ? 'ul' : numbered ? 'ol' : null;
        if (listType && type !== listType) { out.push('</' + listType + '>'); listType = null; }
        if (type) {
          if (!listType) { out.push('<' + type + '>'); listType = type; }
          out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
        } else if (/^#{1,6}\s/.test(line)) {
          out.push('<p class="h">' + inline(line.replace(/^#+\s*/, '')) + '</p>');
        } else if (line.trim()) {
          out.push('<p>' + inline(line) + '</p>');
        }
      });
      if (listType) out.push('</' + listType + '>');
    });
    return out.join('');
  }

  var ICON_SPARK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_RESET = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  var STYLES = [
    ':host{--bg:#ffffff;--surface:#f6f4fa;--border:#e6e1ef;--text:#1b1530;--muted:#6b6480;--brand:#240552;--accent:#7d3be2;--user:#240552;--user-text:#ffffff;--code-bg:#1b1530;--code-text:#f1edf9;',
    'position:fixed;right:20px;bottom:20px;z-index:2147483000;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:14px;line-height:1.55;color:var(--text)}',
    ':host([data-theme=dark]){--bg:#130b24;--surface:#1d1433;--border:#2e2449;--text:#ece8f5;--muted:#a49cbb;--brand:#B692F6;--accent:#B692F6;--user:#3a1d70;--user-text:#ffffff;--code-bg:#0b0616;--code-text:#ece8f5}',
    '*{box-sizing:border-box}[hidden]{display:none!important}',
    'button{font:inherit;cursor:pointer}',
    '.launcher{display:flex;align-items:center;gap:8px;height:44px;padding:0 18px;border:0;border-radius:22px;background:#240552;color:#fff;font-weight:600;box-shadow:0 6px 20px rgba(36,5,82,.3);transition:transform .15s}',
    ':host([data-theme=dark]) .launcher{background:#7d3be2}',
    '.launcher:hover{transform:translateY(-1px)}.launcher svg{color:#B692F6}:host([data-theme=dark]) .launcher svg{color:#fff}',
    '.panel{display:flex;flex-direction:column;width:400px;height:min(620px,calc(100vh - 40px));background:var(--bg);border:1px solid var(--border);border-radius:14px;box-shadow:0 16px 48px rgba(20,10,40,.22);overflow:hidden}',
    'header{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 16px;border-bottom:1px solid var(--border)}',
    '.brand{display:flex;align-items:center;gap:10px}.brand svg{color:var(--accent)}.brand strong{display:block;font-size:14px}.brand small{display:block;color:var(--muted);font-size:12px}',
    '.actions{display:flex;gap:2px}.actions button{display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:8px;background:none;color:var(--muted)}.actions button:hover{background:var(--surface);color:var(--text)}',
    '.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}',
    '.welcome p{margin:0 0 12px;color:var(--text)}.suggestions{display:flex;flex-direction:column;gap:8px}',
    '.chip{text-align:left;padding:9px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text)}.chip:hover{border-color:var(--accent)}',
    '.msg{display:flex;flex-direction:column;max-width:100%}.msg.user{align-items:flex-end}',
    '.bubble{max-width:100%;overflow-wrap:anywhere}.user .bubble{max-width:85%;padding:8px 12px;border-radius:12px 12px 4px 12px;background:var(--user);color:var(--user-text);white-space:pre-wrap}',
    '.assistant .bubble p{margin:0 0 8px}.assistant .bubble p:last-child{margin-bottom:0}.bubble .h{font-weight:600}',
    '.bubble ul,.bubble ol{margin:0 0 8px;padding-left:20px}.bubble li{margin:2px 0}',
    '.bubble a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}',
    '.bubble code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;padding:1px 5px;border-radius:5px;background:var(--surface);border:1px solid var(--border)}',
    '.code{margin:4px 0 10px;border-radius:10px;overflow:hidden;background:var(--code-bg)}',
    '.code-head{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;font-size:11.5px;color:#a49cbb;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.copy{border:0;background:none;color:#a49cbb;font-size:11.5px}.copy:hover{color:#fff}',
    '.code pre{margin:0;padding:10px 12px;overflow-x:auto}.code code{padding:0;border:0;background:none;color:var(--code-text);font-size:12.5px;white-space:pre}',
    '.error .bubble{color:#c2410c}:host([data-theme=dark]) .error .bubble{color:#fdba74}',
    '.sources{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}.sources span{font-size:12px;color:var(--muted);margin-right:2px}',
    '.source{font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid var(--border);color:var(--text);text-decoration:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.source:hover{border-color:var(--accent)}',
    'form{display:flex;align-items:flex-end;gap:8px;margin:0 12px;padding:8px 8px 8px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}',
    'form:focus-within{border-color:var(--accent)}',
    'textarea{flex:1;resize:none;border:0;outline:0;background:none;color:var(--text);font:inherit;max-height:120px;padding:5px 0}textarea::placeholder{color:var(--muted)}',
    'form button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:9px;background:#240552;color:#fff}:host([data-theme=dark]) form button{background:#7d3be2}form button:disabled{opacity:.5;cursor:default}',
    'footer{padding:8px 16px 10px;font-size:11px;color:var(--muted);text-align:center}',
    '.typing{display:inline-flex;gap:4px;padding:6px 0}.typing i{width:6px;height:6px;border-radius:50%;background:var(--muted);animation:blink 1.2s infinite}.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}',
    '@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.typing i{animation:none;opacity:.6}.launcher{transition:none}}',
    '@media (max-width:480px){:host{right:12px;bottom:12px;left:auto}.panel{position:fixed;inset:0;width:100vw;height:100dvh;border-radius:0;border:0}}',
  ].join('');

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
