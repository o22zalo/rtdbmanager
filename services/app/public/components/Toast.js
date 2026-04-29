export class Toast {
  /**
   * Creates a stack-based toast presenter.
   */
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2';
    document.addEventListener('DOMContentLoaded', () => document.body.append(this.container));
  }

  /**
   * Shows a toast.
   * @param {'success'|'error'|'info'|'warning'} type Toast type.
   * @param {string} message Message.
   * @returns {void}
   */
  show(type, message) {
    const colors = {
      success: 'badge-success border-secondary',
      error: 'badge-danger border-secondary',
      info: 'badge-info border-secondary',
      warning: 'badge-info border-secondary'
    };

    const item = document.createElement('button');
    item.type = 'button';
    item.className = `rounded-md border px-4 py-3 text-left text-sm shadow-xl ${colors[type] || colors.info}`;
    item.textContent = message;
    item.addEventListener('click', () => item.remove());
    this.container.append(item);

    window.setTimeout(() => item.remove(), 4000);
  }

  /** @param {string} message Message. @returns {void} */
  success(message) { this.show('success', message); }

  /** @param {string} message Message. @returns {void} */
  error(message) { this.show('error', message); }

  /** @param {string} message Message. @returns {void} */
  info(message) { this.show('info', message); }

  /** @param {string} message Message. @returns {void} */
  warning(message) { this.show('warning', message); }
}
