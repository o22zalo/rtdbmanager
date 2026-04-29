/**
 * Renders the application sidebar.
 * @param {{user: object, currentRoute: string, theme: string, onNavigate: Function, onThemeChange: Function, onLogout: Function}} props Sidebar props.
 * @returns {HTMLElement} Sidebar element.
 */
export function Sidebar({ user, currentRoute, theme, onNavigate, onThemeChange, onLogout }) {
  const root = document.createElement('div');
  root.className = 'flex h-full flex-col gap-4 p-4';
  root.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="brand-mark grid h-9 w-9 place-items-center rounded-md font-semibold">R</div>
      <div class="min-w-0">
        <div class="text-primary truncate text-sm font-semibold">RTDB Manager</div>
        <div class="text-tertiary truncate text-xs">${user.email}</div>
      </div>
    </div>
    <nav class="grid gap-1">
      <button data-route="#/projects" class="nav-projects hover-surface flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm">Projects</button>
      <button data-route="#/settings" class="nav-settings hover-surface flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm">Settings</button>
    </nav>
    <div class="surface-secondary rounded-md border border-tertiary p-2">
      <div class="text-tertiary mb-2 text-xs font-medium uppercase tracking-normal">Theme</div>
      <div class="grid grid-cols-2 gap-1">
        <button data-theme="dark" class="theme-dark hover-surface rounded-md px-2 py-1.5 text-sm">Dark</button>
        <button data-theme="light" class="theme-light-btn hover-surface rounded-md px-2 py-1.5 text-sm">Light</button>
      </div>
    </div>
    <div class="mt-auto border-t border-tertiary pt-4">
      <button class="logout btn-secondary w-full rounded-md border px-3 py-2 text-sm">Sign out</button>
    </div>
  `;

  const activeClass = 'surface-secondary text-info';
  const active = currentRoute === 'settings' ? root.querySelector('.nav-settings') : root.querySelector('.nav-projects');
  active.classList.add(...activeClass.split(' '));

  root.querySelectorAll('[data-route]').forEach((button) => {
    button.addEventListener('click', () => onNavigate(button.dataset.route));
  });
  root.querySelectorAll('[data-theme]').forEach((button) => {
    if (button.dataset.theme === theme) {
      button.classList.add('btn-primary');
    }
    button.addEventListener('click', () => onThemeChange(button.dataset.theme));
  });
  root.querySelector('.logout').addEventListener('click', onLogout);

  return root;
}
