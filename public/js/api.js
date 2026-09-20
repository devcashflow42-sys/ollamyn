/* ============================================================================
   ollamyn · cliente de API (navegador)
   Habla con la API en el mismo origen bajo /api. Guarda los tokens de forma
   segura, renueva automáticamente el access token al expirar (401) y expone
   streaming SSE para el chat. Nunca coloca el ID del usuario en la URL.
   ============================================================================ */
(function () {
  'use strict';

  var API_BASE = (window.OLLAMYN_API_BASE || '/api').replace(/\/$/, '');
  var K_ACCESS = 'ollamyn_access';
  var K_REFRESH = 'ollamyn_refresh';

  // --- Almacén de tokens (localStorage si "recordarme", si no sessionStorage) ---
  function safeGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function safeSet(store, key, val) { try { store.setItem(key, val); } catch (e) {} }
  function safeDel(store, key) { try { store.removeItem(key); } catch (e) {} }

  var TokenStore = {
    get access() { return safeGet(localStorage, K_ACCESS) || safeGet(sessionStorage, K_ACCESS); },
    get refresh() { return safeGet(localStorage, K_REFRESH) || safeGet(sessionStorage, K_REFRESH); },
    get remembered() { return !!safeGet(localStorage, K_REFRESH); },
    save: function (tokens, remember) {
      var store = remember ? localStorage : sessionStorage;
      var other = remember ? sessionStorage : localStorage;
      safeSet(store, K_ACCESS, tokens.accessToken);
      safeSet(store, K_REFRESH, tokens.refreshToken);
      safeDel(other, K_ACCESS); safeDel(other, K_REFRESH);
    },
    clear: function () {
      [localStorage, sessionStorage].forEach(function (s) { safeDel(s, K_ACCESS); safeDel(s, K_REFRESH); });
    },
    get isAuthenticated() { return !!this.access; },
  };

  function authHeaders() {
    var t = TokenStore.access;
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  var refreshing = null;
  function tryRefresh() {
    if (refreshing) return refreshing;
    var rt = TokenStore.refresh;
    if (!rt) return Promise.resolve(false);
    var remember = TokenStore.remembered;
    refreshing = fetch(API_BASE + '/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    }).then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (data) {
        if (data && data.data && data.data.tokens) {
          TokenStore.save(data.data.tokens, remember);
          return true;
        }
        return false;
      });
    }).catch(function () { return false; }).finally(function () { refreshing = null; });
    return refreshing;
  }

  function ApiError(message, code, status) {
    var e = new Error(message || 'Error'); e.code = code; e.status = status; return e;
  }

  function request(path, opts) {
    opts = opts || {};
    var method = opts.method || 'GET';
    var auth = opts.auth !== false;
    var retry = opts.retry !== false;

    var headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) Object.assign(headers, authHeaders());

    return fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      if (res.status === 401 && auth && retry) {
        return tryRefresh().then(function (ok) {
          if (ok) return request(path, Object.assign({}, opts, { retry: false }));
          return res.json().catch(function () { return null; }).then(function (d) {
            throw ApiError((d && d.error && d.error.message) || 'Sesión expirada', (d && d.error && d.error.code) || 'UNAUTHORIZED', 401);
          });
        });
      }
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          throw ApiError(data && data.error && data.error.message, data && data.error && data.error.code, res.status);
        }
        return data ? data.data : null;
      });
    });
  }

  // --- Streaming de completions (SSE) ---
  function streamCompletion(opts) {
    function doFetch() {
      return fetch(API_BASE + '/chat/completions', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
        body: JSON.stringify({ chatId: opts.chatId, model: opts.model, message: opts.message, stream: true }),
        signal: opts.signal,
      });
    }
    return doFetch().then(function (res) {
      if (res.status === 401) {
        return tryRefresh().then(function (ok) { return ok ? doFetch() : res; });
      }
      return res;
    }).then(function (res) {
      if (!res.ok || !res.body) {
        return res.json().catch(function () { return null; }).then(function (d) {
          throw ApiError((d && d.error && d.error.message) || 'Error al generar la respuesta', d && d.error && d.error.code, res.status);
        });
      }
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { if (opts.onDone) opts.onDone({}); return; }
          buffer += decoder.decode(r.value, { stream: true });
          var parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (var i = 0; i < parts.length; i++) {
            var line = parts[i].trim();
            if (line.indexOf('data:') !== 0) continue;
            var payload = line.slice(5).trim();
            if (payload === '[DONE]') { if (opts.onDone) opts.onDone({}); return; }
            var evt = null;
            try { evt = JSON.parse(payload); } catch (e) { continue; }
            if (evt.type === 'meta' && opts.onMeta) opts.onMeta(evt);
            else if (evt.type === 'delta' && opts.onDelta) opts.onDelta(evt.delta || '');
            else if (evt.type === 'done') { if (opts.onDone) opts.onDone(evt); return; }
            else if (evt.type === 'error') { throw ApiError(evt.error && evt.error.message, evt.error && evt.error.code, 502); }
          }
          return pump();
        });
      }
      return pump();
    });
  }

  window.TokenStore = TokenStore;
  window.OllamynAPI = {
    register: function (b) { return request('/register', { method: 'POST', body: b, auth: false }); },
    login: function (b) { return request('/login', { method: 'POST', body: b, auth: false }); },
    logout: function () {
      var rt = TokenStore.refresh;
      TokenStore.clear();
      return fetch(API_BASE + '/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
      }).catch(function () {});
    },
    me: function () { return request('/me'); },
    models: function () { return request('/models').then(function (d) { return d.models; }); },
    chats: function () { return request('/chats?pageSize=100').then(function (d) { return d.items; }); },
    createChat: function (b) { return request('/chats', { method: 'POST', body: b || {} }).then(function (d) { return d.chat; }); },
    getChat: function (id) { return request('/chats/' + encodeURIComponent(id)).then(function (d) { return d.chat; }); },
    deleteChat: function (id) { return request('/chats/' + encodeURIComponent(id), { method: 'DELETE' }); },
    streamCompletion: streamCompletion,
  };
})();
