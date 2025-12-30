// signup.js

// Usa los mismos valores que ya usamos en app.js
const SUPABASE_URL =
  window.__SUPABASE_URL || 'https://wcpyvpvyoqmrukmvqfwt.supabase.co';
const SUPABASE_ANON_KEY =
  window.__SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHl2cHZ5b3FtcnVrbXZxZnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxMTc4MDYsImV4cCI6MjA3OTY5MzgwNn0.EeFMe4x3A0R9wFsmv11R6ru2bqHS_00W5C38x2jgFio';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const form = document.getElementById('signup-form');
const messageEl = document.getElementById('signup-message');
const loginLink = document.getElementById('login-link');

function getSafeNext(defaultPath = 'index.html') {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (!next) return defaultPath;
  try {
    const url = new URL(next, window.location.origin);
    if (url.origin !== window.location.origin) return defaultPath;
    return url.pathname + url.search + url.hash;
  } catch (_err) {
    return defaultPath;
  }
}

const safeNext = getSafeNext('index.html');
if (loginLink) {
  loginLink.href = `login.html?next=${encodeURIComponent(safeNext)}`;
}

function showSignupMessage(text, isError = false) {
  if (!messageEl) {
    alert(text);
    return;
  }
  messageEl.textContent = text;
  messageEl.classList.toggle('auth-message--error', !!isError);
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = (formData.get('name') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const password = (formData.get('password') || '').toString();
    const password2 = (formData.get('password2') || '').toString();

    if (!name || !email || !password || !password2) {
      showSignupMessage('Por favor completa todos los campos.', true);
      return;
    }

    if (password !== password2) {
      showSignupMessage('Las contraseñas no coinciden.', true);
      return;
    }

    if (password.length < 6) {
      showSignupMessage('La contraseña debe tener al menos 6 caracteres.', true);
      return;
    }

    showSignupMessage('Creando tu cuenta...');

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          // Datos extra del usuario (user_metadata)
          data: {
            full_name: name,
            role: 'customer'
          },
          // A dónde mandará Supabase al confirmar correo (si tienes confirmación activa)
          emailRedirectTo: `${window.location.origin}/login.html`
        }
      });

      if (error) {
        console.error('[signup] error creando cuenta', error);
        showSignupMessage(
          error.message || 'No se pudo crear la cuenta. Intenta de nuevo.',
          true
        );
        return;
      }

      // Si tu proyecto exige confirmación por correo, normalmente NO habrá sesión aquí
      if (!data.session) {
        showSignupMessage(
          'Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.',
          false
        );
        form.reset();
        window.location.href = `login.html?signup=1&next=${encodeURIComponent(safeNext)}`;
        return;
      }

      // Si no se exige confirmación por correo y ya hay sesión:
      showSignupMessage('Cuenta creada. Redirigiendo al catálogo...');
      window.location.href = safeNext || 'index.html';
    } catch (err) {
      console.error('[signup] excepción inesperada', err);
      showSignupMessage(
        'Ocurrió un error inesperado creando la cuenta.',
        true
      );
    }
  });
}
