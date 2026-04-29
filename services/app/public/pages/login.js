import { navigate, preloadFirebaseAuth, signInWithGoogle, toast } from '../app.js';

/**
 * Renders the login page.
 * @returns {HTMLElement} Login page.
 */
export function renderLogin() {
  const root = document.createElement('main');
  root.className = 'surface-primary grid min-h-screen place-items-center p-6';
  root.innerHTML = `
    <section class="w-full max-w-sm">
      <div class="mb-8">
        <div class="brand-mark mb-4 grid h-12 w-12 place-items-center rounded-md text-lg font-semibold">R</div>
        <h1 class="text-primary text-2xl font-semibold tracking-normal">RTDB Manager</h1>
        <p class="text-tertiary mt-2 text-sm">Central Firebase Realtime Database control panel.</p>
      </div>
      <button class="login btn-primary w-full rounded-md px-4 py-3 text-sm font-medium disabled:cursor-wait disabled:opacity-60">
        Sign in with Google
      </button>
      <p class="text-danger mt-4 min-h-5 text-sm" role="alert"></p>
    </section>
  `;

  const button = root.querySelector('.login');
  const errorBox = root.querySelector('[role="alert"]');

  preloadFirebaseAuth().catch(() => {});

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Signing in...';
    errorBox.textContent = '';

    try {
      await signInWithGoogle();
      toast.success('Signed in');
      navigate('#/projects');
    } catch (error) {
      errorBox.textContent = error.message;
      toast.error(error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in with Google';
    }
  });

  return root;
}
