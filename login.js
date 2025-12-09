// login.js

const SUPABASE_URL = window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';

const supabaseLoginClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async function initLogin() {
  const params = new URLSearchParams(window.location.search);
  const mustLogout = params.get('logout') === '1';

  if (mustLogout) {
    console.log('[login] modo logout → cerrando sesión en Supabase');

    try {
      const { error } = await supabaseLoginClient.auth.signOut();
      if (error) console.error('[login] error en signOut:', error);
    } catch (err) {
      console.error('[login] error inesperado en signOut:', err);
    }

    // Limpiar storage local de Supabase
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('sb-')) sessionStorage.removeItem(k);
      });
      console.log('[login] storage sb-* limpiado');
    } catch (e) {
      console.warn('[login] error limpiando storage', e);
    }
  }

  // Después de (posible) logout, revisamos usuario
  try {
    const { data, error } = await supabaseLoginClient.auth.getUser();
    if (error) console.warn('[login] getUser error:', error);

    const user = data?.user || null;
    console.log('[login] user después de initLogin →', user?.email || null);

    // Si hay usuario, mandamos al catálogo
    if (user) {
      console.log('[login] sesión activa → redirigir a index.html');
      window.location.replace('index.html');
      return;
    }

    // Si no hay usuario, aquí ya puedes mostrar tu formulario existente
    console.log('[login] sin sesión → mostrar formulario de login');
    // (AQUÍ continúa tu código actual de login: listeners, enviar magic link, etc.)
  } catch (err) {
    console.error('[login] error en initLogin()', err);
  }
})();

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const signupBtn = document.getElementById('signup-btn');
const forgotBtn = document.getElementById('forgot-btn');
const msg = document.getElementById('msg');

function setMessage(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('error', isError);
}

// LOGIN
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage('');
  submitBtn.disabled = true;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage('Completa correo y contraseña.', true);
    submitBtn.disabled = false;
    return;
  }

  const { error } = await supabaseLoginClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setMessage(error.message || 'No se pudo iniciar sesión.', true);
    submitBtn.disabled = false;
    return;
  }

  setMessage('Sesión iniciada, redirigiendo...');
  window.location.href = 'index.html';
});

// SIGNUP
if (signupBtn) {
  signupBtn.addEventListener('click', async () => {
    setMessage('');
    submitBtn.disabled = true;
    signupBtn.disabled = true;

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      setMessage('Escribe correo y contraseña para crear tu cuenta.', true);
      submitBtn.disabled = false;
      signupBtn.disabled = false;
      return;
    }

    const { error } = await supabaseLoginClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message || 'No se pudo crear la cuenta.', true);
      submitBtn.disabled = false;
      signupBtn.disabled = false;
      return;
    }

    setMessage('Cuenta creada. Revisa tu correo para confirmar.', false);
    submitBtn.disabled = false;
    signupBtn.disabled = false;
  });
}

// RESET PASSWORD
if (forgotBtn) {
  forgotBtn.addEventListener('click', async () => {
    setMessage('');
    const email = emailInput.value.trim();

    if (!email) {
      setMessage('Escribe tu correo para enviarte el enlace de recuperación.', true);
      return;
    }

    setMessage('Enviando enlace de recuperación...');
    const redirectTo = window.location.origin + '/reset.html';

    const { error } = await supabaseLoginClient.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMessage(error.message || 'No se pudo enviar el correo de recuperación.', true);
      return;
    }

    setMessage('Te enviamos un correo con el enlace para restablecer tu contraseña.');
  });
}
