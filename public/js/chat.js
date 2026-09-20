/* ============================================================================
   ollamyn · aplicación de chat
   - Protegida: sin token válido redirige a /login.
   - El ID del usuario NUNCA va en la URL. En el hash solo va el UUID del chat,
     que es aleatorio y el servidor valida su propiedad por el token.
   - Streaming en tiempo real. Todo el contenido dinámico se pinta con
     textContent (sin innerHTML) para evitar XSS.
   ============================================================================ */
(function () {
  'use strict';

  if (!window.TokenStore || !window.TokenStore.isAuthenticated) {
    location.replace('/login');
    return;
  }

  var state = { chatId: null, model: null, streaming: false, chats: [] };
  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    el.sidebar = document.getElementById('sidebar');
    el.scrim = document.getElementById('scrim');
    el.menuBtn = document.getElementById('menu-btn');
    el.newChat = document.getElementById('new-chat');
    el.chatList = document.getElementById('chat-list');
    el.userName = document.getElementById('user-name');
    el.avatar = document.getElementById('avatar');
    el.logout = document.getElementById('logout-btn');
    el.modelSelect = document.getElementById('model-select');
    el.messages = document.getElementById('messages');
    el.form = document.getElementById('composer-form');
    el.textarea = document.getElementById('composer-input');
    el.send = document.getElementById('send-btn');

    el.menuBtn.addEventListener('click', toggleSidebar);
    el.scrim.addEventListener('click', function () { toggleSidebar(false); });
    el.newChat.addEventListener('click', function () { startNewChat(); closeSidebarMobile(); });
    el.logout.addEventListener('click', doLogout);
    el.modelSelect.addEventListener('change', function () {
      state.model = el.modelSelect.value;
      try { localStorage.setItem('ollamyn_model', state.model); } catch (e) {}
    });
    el.form.addEventListener('submit', onSend);
    el.textarea.addEventListener('input', autoGrow);
    el.textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.form.requestSubmit(); }
    });
    window.addEventListener('hashchange', function () {
      var id = location.hash.replace(/^#/, '');
      if (id && id !== state.chatId) openChat(id);
      if (!id) startNewChat(true);
    });

    bootstrap();
  }

  function bootstrap() {
    OllamynAPI.me().then(function (data) {
      var u = data.user;
      el.userName.textContent = u.username || u.email;
      el.avatar.textContent = (u.username || u.email || '?').slice(0, 1);
    }).catch(function (err) {
      if (err.status === 401) return doLogout(true);
    });

    OllamynAPI.models().then(function (models) {
      el.modelSelect.innerHTML = '';
      var saved = null;
      try { saved = localStorage.getItem('ollamyn_model'); } catch (e) {}
      models.forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m.slug; opt.textContent = m.name;
        el.modelSelect.appendChild(opt);
      });
      if (models.length) {
        state.model = (saved && models.some(function (m) { return m.slug === saved; })) ? saved : models[0].slug;
        el.modelSelect.value = state.model;
      }
    }).catch(function () {});

    refreshChats().then(function () {
      var id = location.hash.replace(/^#/, '');
      if (id) openChat(id); else startNewChat(true);
    });
  }

  function refreshChats() {
    return OllamynAPI.chats().then(function (chats) {
      state.chats = chats || [];
      renderChatList();
    }).catch(function () {});
  }

  function renderChatList() {
    el.chatList.innerHTML = '';
    state.chats.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'chat-item' + (c.id === state.chatId ? ' active' : '');

      var title = document.createElement('span');
      title.className = 'title';
      title.textContent = c.title || 'Chat';
      item.appendChild(title);

      var del = document.createElement('button');
      del.className = 'del'; del.title = 'Eliminar'; del.setAttribute('aria-label', 'Eliminar chat');
      del.innerHTML = ICON.trash;
      del.addEventListener('click', function (e) { e.stopPropagation(); deleteChat(c); });
      item.appendChild(del);

      item.addEventListener('click', function () { location.hash = '#' + c.id; closeSidebarMobile(); });
      el.chatList.appendChild(item);
    });
  }

  function startNewChat(skipHash) {
    state.chatId = null;
    if (!skipHash && location.hash) history.replaceState(null, '', location.pathname);
    renderChatList();
    renderEmpty();
    el.textarea.focus();
  }

  function openChat(id) {
    state.chatId = id;
    renderChatList();
    el.messages.innerHTML = '';
    OllamynAPI.getChat(id).then(function (chat) {
      if (!chat.messages || !chat.messages.length) { renderEmpty(); return; }
      chat.messages.forEach(function (m) { appendMessage(m.role, m.content); });
      scrollToBottom(true);
    }).catch(function (err) {
      if (err.status === 401) return doLogout(true);
      startNewChat(); // chat inexistente/ajeno → vuelve a estado limpio
    });
  }

  function deleteChat(c) {
    if (!confirm('¿Eliminar "' + (c.title || 'este chat') + '"?')) return;
    OllamynAPI.deleteChat(c.id).then(function () {
      if (state.chatId === c.id) startNewChat();
      return refreshChats();
    }).catch(function () {});
  }

  // --- Envío de mensajes con streaming ---
  function onSend(e) {
    e.preventDefault();
    if (state.streaming) return;
    var text = el.textarea.value.trim();
    if (!text || !state.model) return;

    el.textarea.value = ''; autoGrow();
    clearEmpty();
    appendMessage('user', text);
    scrollToBottom(true);

    var assistant = appendMessage('assistant', '');
    var contentNode = assistant.querySelector('.content');
    var cursor = document.createElement('span');
    cursor.className = 'cursor';
    contentNode.appendChild(cursor);

    setStreaming(true);
    var acc = '';
    var isNew = !state.chatId;

    OllamynAPI.streamCompletion({
      chatId: state.chatId || undefined,
      model: state.model,
      message: text,
      onMeta: function (evt) {
        if (evt.chatId && !state.chatId) {
          state.chatId = evt.chatId;
          history.replaceState(null, '', '#' + evt.chatId);
        }
      },
      onDelta: function (delta) {
        acc += delta;
        contentNode.textContent = acc;
        contentNode.appendChild(cursor);
        scrollToBottom();
      },
      onDone: function () { finishStreaming(contentNode, cursor, acc, isNew); },
    }).catch(function (err) {
      cursor.remove();
      if (err.status === 401) return doLogout(true);
      contentNode.textContent = acc || '';
      var note = document.createElement('div');
      note.className = 'hint error';
      note.textContent = '⚠ ' + friendly(err);
      contentNode.appendChild(note);
      setStreaming(false);
    });
  }

  function finishStreaming(contentNode, cursor, acc, isNew) {
    cursor.remove();
    contentNode.textContent = acc;
    setStreaming(false);
    if (isNew) refreshChats(); // el nuevo chat aparece en la barra lateral con su título
    el.textarea.focus();
  }

  function setStreaming(on) {
    state.streaming = on;
    el.send.disabled = on;
    el.textarea.disabled = on;
    if (!on) el.textarea.focus();
  }

  // --- Render de mensajes (seguro: textContent) ---
  function appendMessage(role, content) {
    var msg = document.createElement('div');
    msg.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');

    var who = document.createElement('div');
    who.className = 'who';
    who.textContent = role === 'user' ? 'Tú' : 'AI';
    msg.appendChild(who);

    var body = document.createElement('div');
    body.className = 'body';
    var name = document.createElement('div');
    name.className = 'name';
    name.textContent = role === 'user' ? 'Tú' : 'ollamyn';
    var c = document.createElement('div');
    c.className = 'content';
    c.textContent = content || '';
    body.appendChild(name); body.appendChild(c);
    msg.appendChild(body);

    el.messages.appendChild(msg);
    return msg;
  }

  function renderEmpty() {
    el.messages.innerHTML =
      '<div class="empty"><div class="brand"><span class="dot"></span> ollamyn</div>' +
      '<p>¿En qué puedo ayudarte hoy?</p></div>';
  }
  function clearEmpty() {
    var e = el.messages.querySelector('.empty');
    if (e) el.messages.innerHTML = '';
  }

  function scrollToBottom(force) {
    var m = el.messages;
    var near = m.scrollHeight - m.scrollTop - m.clientHeight < 160;
    if (force || near) m.scrollTop = m.scrollHeight;
  }

  function autoGrow() {
    el.textarea.style.height = 'auto';
    el.textarea.style.height = Math.min(el.textarea.scrollHeight, 200) + 'px';
    el.send.disabled = state.streaming || !el.textarea.value.trim();
  }

  function toggleSidebar(force) {
    var hide = typeof force === 'boolean' ? !force : !el.sidebar.classList.contains('hidden');
    el.sidebar.classList.toggle('hidden', hide);
    el.scrim.classList.toggle('show', !hide);
  }
  function closeSidebarMobile() {
    if (window.matchMedia('(max-width: 760px)').matches) toggleSidebar(false);
  }

  function doLogout(silent) {
    OllamynAPI.logout().finally(function () { location.replace('/login'); });
    if (silent) return;
  }

  function friendly(err) {
    switch (err && err.code) {
      case 'RATE_LIMIT_EXCEEDED': return 'Has alcanzado tu límite de uso. Espera un momento.';
      case 'MODEL_NOT_FOUND': return 'El modelo seleccionado no está disponible.';
      case 'PROVIDER_NOT_CONFIGURED': return 'Este modelo aún no está configurado en el servidor.';
      case 'PROVIDER_ERROR': return 'El proveedor de IA devolvió un error. Inténtalo de nuevo.';
      default: return (err && err.message) || 'Ocurrió un error. Inténtalo de nuevo.';
    }
  }

  var ICON = {
    trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
  };
})();
