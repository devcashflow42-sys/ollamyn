/* ============================================================================
   ollamyn · lógica de login / registro
   - Login: email + contraseña (+ recordarme)
   - Registro: usuario + email + contraseña + confirmar contraseña
   - Mostrar/ocultar contraseña, validación y mensajes de error claros.
   ============================================================================ */
(function () {
  'use strict';

  // Si ya hay sesión, ir directo al chat.
  if (window.TokenStore && window.TokenStore.isAuthenticated) {
    location.replace('/chat');
    return;
  }

  var mode = new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login';

  var els = {};
  document.addEventListener('DOMContentLoaded', function () {
    els.form = document.getElementById('auth-form');
    els.title = document.getElementById('auth-title');
    els.subtitle = document.getElementById('auth-subtitle');
    els.username = document.getElementById('f-username');
    els.usernameField = document.getElementById('field-username');
    els.email = document.getElementById('f-email');
    els.password = document.getElementById('f-password');
    els.confirm = document.getElementById('f-confirm');
    els.confirmField = document.getElementById('field-confirm');
    els.remember = document.getElementById('f-remember');
    els.rememberRow = document.getElementById('remember-row');
    els.submit = document.getElementById('auth-submit');
    els.alert = document.getElementById('auth-alert');
    els.switchText = document.getElementById('switch-text');
    els.switchBtn = document.getElementById('switch-btn');

    wireToggles();
    els.switchBtn.addEventListener('click', function () {
      setMode(mode === 'login' ? 'register' : 'login');
    });
    els.form.addEventListener('submit', onSubmit);
    setMode(mode);
  });

  function setMode(next) {
    mode = next;
    var isReg = mode === 'register';
    els.usernameField.style.display = isReg ? '' : 'none';
    els.confirmField.style.display = isReg ? '' : 'none';
    els.rememberRow.style.display = isReg ? 'none' : '';
    els.title.textContent = isReg ? 'Crea tu cuenta' : 'Bienvenido de nuevo';
    els.subtitle.textContent = isReg ? 'Empieza a chatear con ollamyn en segundos.' : 'Inicia sesión para continuar.';
    els.submit.textContent = isReg ? 'Crear cuenta' : 'Iniciar sesión';
    els.switchText.textContent = isReg ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
    els.switchBtn.textContent = isReg ? 'Inicia sesión' : 'Crear una cuenta';
    els.username.required = isReg;
    els.confirm.required = isReg;
    hideAlert();
    var url = new URL(location.href);
    if (isReg) url.searchParams.set('mode', 'register'); else url.searchParams.delete('mode');
    history.replaceState(null, '', url);
  }

  function wireToggles() {
    document.querySelectorAll('.toggle-visibility').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = document.getElementById(btn.getAttribute('data-target'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        btn.innerHTML = show ? EYE_OFF : EYE;
      });
    });
  }

  function showAlert(msg) { els.alert.textContent = msg; els.alert.classList.add('show'); }
  function hideAlert() { els.alert.classList.remove('show'); els.alert.textContent = ''; }

  function validPassword(pw) {
    return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
  }

  function onSubmit(e) {
    e.preventDefault();
    hideAlert();
    var email = els.email.value.trim().toLowerCase();
    var password = els.password.value;

    if (mode === 'register') {
      var username = els.username.value.trim();
      var confirm = els.confirm.value;
      if (username.length < 3) return showAlert('El usuario debe tener al menos 3 caracteres.');
      if (!validPassword(password)) return showAlert('La contraseña debe tener 8+ caracteres, con letras y números.');
      if (password !== confirm) return showAlert('Las contraseñas no coinciden.');
      submit(function () {
        return OllamynAPI.register({ username: username, email: email, password: password });
      }, true);
    } else {
      if (!email || !password) return showAlert('Escribe tu email y contraseña.');
      submit(function () {
        return OllamynAPI.login({ email: email, password: password });
      }, els.remember.checked);
    }
  }

  function submit(action, remember) {
    setLoading(true);
    action().then(function (result) {
      TokenStore.save(result.tokens, !!remember);
      location.replace('/chat');
    }).catch(function (err) {
      setLoading(false);
      showAlert(friendly(err));
    });
  }

  function friendly(err) {
    switch (err && err.code) {
      case 'EMAIL_TAKEN': return 'Ese email ya está registrado.';
      case 'USERNAME_TAKEN': return 'Ese nombre de usuario ya está en uso.';
      case 'INVALID_CREDENTIALS': return 'Email o contraseña incorrectos.';
      case 'ACCOUNT_SUSPENDED': return 'Tu cuenta está suspendida.';
      case 'RATE_LIMIT_EXCEEDED': return 'Demasiados intentos. Espera un momento.';
      default: return (err && err.message) || 'No se pudo completar. Inténtalo de nuevo.';
    }
  }

  function setLoading(loading) {
    els.submit.disabled = loading;
    els.submit.textContent = loading
      ? (mode === 'register' ? 'Creando…' : 'Entrando…')
      : (mode === 'register' ? 'Crear cuenta' : 'Iniciar sesión');
  }

  var EYE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.7 10.7 0 0 1 12 20C5 20 1 12 1 12a19.6 19.6 0 0 1 5.1-5.9m3.3-1.6A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a19.6 19.6 0 0 1-2.2 3.2M9.9 4.2 1 12m22 0-3.1 3.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m1 1 22 22"/></svg>';
  window.__EYE = EYE; // expuesto por si el HTML lo necesita al inicio
})();
