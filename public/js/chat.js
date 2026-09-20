/* ============================================================================
   ollamyn · aplicación de chat
   - Protegida: sin token válido redirige a /login.
   - El ID del usuario NUNCA va en la URL. En el hash solo va el UUID del chat,
     que es aleatorio y el servidor valida su propiedad por el token.
   - Streaming en tiempo real. Contenido dinámico con textContent (sin innerHTML).
   - Selector de modelo tipo Claude (muestra el motor y si está disponible).
   - Auto-scroll estilo ChatGPT: solo baja si el usuario está al final; si sube
     a leer, deja de bajar y muestra la flecha para volver abajo.
   ============================================================================ */
(function () {
  'use strict';

  if (!window.TokenStore || !window.TokenStore.isAuthenticated) {
    location.replace('/login');
    return;
  }

  var state = { chatId: null, model: null, models: [], streaming: false, chats: [], pinned: true };
  var el = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    el.sidebar = document.getElementById('sidebar');
    el.scrim = document.getElementById('scrim');
    el.menuBtn = document.getElementById('menu-btn');
    el.newChat = document.getElementById('new-chat');
    el.chatList = document.getElementById('chat-list');
    el.recientes = document.getElementById('recientes-label');
    el.userName = document.getElementById('user-name');
    el.avatar = document.getElementById('avatar');
    el.logout = document.getElementById('logout-btn');
    el.modelPicker = document.getElementById('model-picker');
    el.modelBtn = document.getElementById('model-btn');
    el.modelBtnLabel = document.getElementById('model-btn-label');
    el.modelBtnDot = document.getElementById('model-btn-dot');
    el.modelMenu = document.getElementById('model-menu');
    el.messages = document.getElementById('messages');
    el.scrollDown = document.getElementById('scroll-down');
    el.form = document.getElementById('composer-form');
    el.textarea = document.getElementById('composer-input');
    el.send = document.getElementById('send-btn');

    el.menuBtn.addEventListener('click', toggleSidebar);
    el.scrim.addEventListener('click', function () { toggleSidebar(false); });
    el.newChat.addEventListener('click', function () { startNewChat(); closeSidebarMobile(); });
    el.logout.addEventListener('click', doLogout);
    el.form.addEventListener('submit', onSend);
    el.textarea.addEventListener('input', autoGrow);
    el.textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.form.requestSubmit(); }
    });
    el.messages.addEventListener('scroll', onScroll);
    el.scrollDown.addEventListener('click', function () { scrollToBottom(true); el.textarea.focus(); });

    // Selector de modelo
    el.modelBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleModelMenu(); });
    document.addEventListener('click', function () { closeModelMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModelMenu(); });

    window.addEventListener('hashchange', function () {
      var id = location.hash.replace(/^#/, '');
      if (id && id !== state.chatId) openChat(id);
      if (!id) startNewChat(true);
    });

    // En móvil la barra lateral empieza cerrada (no debe tapar el chat).
    if (window.matchMedia('(max-width: 760px)').matches) el.sidebar.classList.add('hidden');

    bootstrap();
  }

  function bootstrap() {
    OllamynAPI.me().then(function (data) {
      var u = data.user;
      el.userName.textContent = u.username || u.email;
      el.avatar.textContent = (u.username || u.email || '?').slice(0, 1);
    }).catch(function (err) { if (err.status === 401) return doLogout(true); });

    OllamynAPI.models().then(function (models) {
      state.models = models || [];
      var saved = null;
      try { saved = localStorage.getItem('ollamyn_model'); } catch (e) {}
      var pick = state.models.filter(function (m) { return m.available; });
      var chosen = null;
      if (saved && state.models.some(function (m) { return m.slug === saved && m.available; })) chosen = saved;
      else if (pick.length) chosen = pick[0].slug;
      else if (state.models.length) chosen = state.models[0].slug;
      setModel(chosen);
      renderModelMenu();
    }).catch(function () {});

    refreshChats().then(function () {
      var id = location.hash.replace(/^#/, '');
      if (id) openChat(id); else startNewChat(true);
    });
  }

  // ---------------------- Selector de modelo -----------------------
  function setModel(slug) {
    var m = state.models.find(function (x) { return x.slug === slug; });
    state.model = slug;
    if (m) {
      el.modelBtnLabel.textContent = m.name;
      el.modelBtnDot.classList.toggle('off', !m.available);
    }
    try { if (slug) localStorage.setItem('ollamyn_model', slug); } catch (e) {}
  }

  function renderModelMenu() {
    el.modelMenu.innerHTML = '';
    state.models.forEach(function (m) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'model-option' + (m.slug === state.model ? ' selected' : '') + (m.available ? '' : ' disabled');
      opt.setAttribute('role', 'option');

      var dot = document.createElement('span');
      dot.className = 'dot-status' + (m.available ? '' : ' off');
      opt.appendChild(dot);

      var info = document.createElement('span');
      info.className = 'info';
      var n = document.createElement('span'); n.className = 'n';
      var nm = document.createElement('span'); nm.textContent = m.name; n.appendChild(nm);
      if (m.engine) { var eg = document.createElement('span'); eg.className = 'engine'; eg.textContent = m.engine; n.appendChild(eg); }
      var d = document.createElement('span'); d.className = 'd'; d.textContent = m.description || '';
      info.appendChild(n); info.appendChild(d);
      opt.appendChild(info);

      if (!m.available) {
        var off = document.createElement('span'); off.className = 'badge-off'; off.textContent = 'No configurado';
        opt.appendChild(off);
      } else {
        var chk = document.createElement('span'); chk.className = 'check';
        chk.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        opt.appendChild(chk);
      }

      if (m.available) {
        opt.addEventListener('click', function (e) {
          e.stopPropagation();
          setModel(m.slug); renderModelMenu(); closeModelMenu();
        });
      } else {
        opt.addEventListener('click', function (e) { e.stopPropagation(); });
      }
      el.modelMenu.appendChild(opt);
    });
  }

  function toggleModelMenu() {
    var open = !el.modelMenu.hasAttribute('hidden');
    if (open) closeModelMenu(); else openModelMenu();
  }
  function openModelMenu() { el.modelMenu.removeAttribute('hidden'); el.modelBtn.setAttribute('aria-expanded', 'true'); }
  function closeModelMenu() { el.modelMenu.setAttribute('hidden', ''); el.modelBtn.setAttribute('aria-expanded', 'false'); }

  // ---------------------- Conversaciones ---------------------------
  function refreshChats() {
    return OllamynAPI.chats().then(function (chats) {
      state.chats = chats || [];
      renderChatList();
    }).catch(function (err) {
      if (err && err.status === 401) return doLogout(true);
      renderChatList();
    });
  }

  function renderChatList() {
    el.chatList.innerHTML = '';
    el.recientes.hidden = state.chats.length === 0;
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
      startNewChat();
    });
  }

  function deleteChat(c) {
    if (!confirm('¿Eliminar "' + (c.title || 'este chat') + '"?')) return;
    OllamynAPI.deleteChat(c.id).then(function () {
      if (state.chatId === c.id) startNewChat();
      return refreshChats();
    }).catch(function () {});
  }

  // ---------------------- Envío + streaming ------------------------
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
    setContent(contentNode, 'assistant', '', true);

    setStreaming(true);
    var acc = '';
    var isNew = !state.chatId;
    var rafPending = false;

    function renderStream() {
      setContent(contentNode, 'assistant', acc, true);
      scrollToBottom(); // solo baja si el usuario está al final
    }
    function scheduleStream() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; renderStream(); });
    }

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
        scheduleStream();
      },
      onDone: function () {
        setContent(contentNode, 'assistant', acc, false); // render final sin cursor
        setStreaming(false);
        scrollToBottom();
        if (isNew) refreshChats();
        el.textarea.focus();
      },
    }).catch(function (err) {
      if (err.status === 401) return doLogout(true);
      setContent(contentNode, 'assistant', acc, false);
      var note = document.createElement('div');
      note.className = 'hint error';
      note.textContent = '⚠ ' + friendly(err);
      contentNode.appendChild(note);
      setStreaming(false);
    });
  }

  function setStreaming(on) {
    state.streaming = on;
    el.send.disabled = on || !el.textarea.value.trim();
    el.textarea.disabled = on;
    if (!on) el.textarea.focus();
  }

  // ---------------------- Render de mensajes -----------------------
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
    setContent(c, role, content || '', false);
    body.appendChild(name); body.appendChild(c);
    msg.appendChild(body);

    el.messages.appendChild(msg);
    updateScrollButton();
    return msg;
  }

  /**
   * Pinta el contenido de un mensaje. Los mensajes del asistente se renderizan
   * como Markdown (seguro, vía renderMarkdown); los del usuario como texto plano.
   */
  function setContent(node, role, text, streaming) {
    if (role === 'user' || !window.renderMarkdown) {
      node.textContent = text || '';
      return;
    }
    node.innerHTML = '';
    node.appendChild(window.renderMarkdown(text || ''));
    if (streaming) {
      var cur = document.createElement('span');
      cur.className = 'cursor';
      node.appendChild(cur);
    }
  }

  function renderEmpty() {
    el.messages.innerHTML =
      '<div class="empty"><div class="brand"><span class="dot"></span> ollamyn</div>' +
      '<p>¿En qué puedo ayudarte hoy?</p></div>';
    updateScrollButton();
  }
  function clearEmpty() {
    if (el.messages.querySelector('.empty')) el.messages.innerHTML = '';
  }

  // ---------------------- Scroll (estilo ChatGPT) ------------------
  function distanceFromBottom() {
    var m = el.messages;
    return m.scrollHeight - m.scrollTop - m.clientHeight;
  }
  function onScroll() {
    state.pinned = distanceFromBottom() < 80;
    updateScrollButton();
  }
  function scrollToBottom(force) {
    if (force) state.pinned = true;
    if (state.pinned) el.messages.scrollTop = el.messages.scrollHeight;
    updateScrollButton();
  }
  function updateScrollButton() {
    var m = el.messages;
    var canScroll = m.scrollHeight - m.clientHeight > 40;
    el.scrollDown.hidden = state.pinned || !canScroll;
  }

  // ---------------------- Varios -----------------------------------
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

  function doLogout() {
    OllamynAPI.logout().finally(function () { location.replace('/login'); });
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
