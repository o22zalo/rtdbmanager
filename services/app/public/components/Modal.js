export class Modal {
  /**
   * Creates a modal.
   * @param {{title: string, body: HTMLElement|string, footer?: HTMLElement|string, closeOnBackdrop?: boolean, closeOnEscape?: boolean, showCloseButton?: boolean}} options Modal options.
   */
  constructor({
    title,
    body,
    footer = '',
    closeOnBackdrop = true,
    closeOnEscape = true,
    showCloseButton = true
  }) {
    this.closeOnBackdrop = closeOnBackdrop;
    this.closeOnEscape = closeOnEscape;
    this.element = document.createElement('div');
    this.element.className = 'overlay fixed inset-0 z-40 grid place-items-center p-4';
    this.element.innerHTML = `
      <div class="surface-secondary max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-md border border-secondary shadow-2xl">
        <div class="flex items-center justify-between border-b border-tertiary px-5 py-4">
          <h2 class="text-primary text-base font-semibold"></h2>
          <button type="button" class="close hover-surface text-tertiary rounded-md p-2" title="Close">x</button>
        </div>
        <div class="modal-body max-h-[70vh] overflow-auto px-5 py-4"></div>
        <div class="modal-footer border-t border-tertiary px-5 py-4"></div>
      </div>
    `;

    this.element.querySelector('h2').textContent = title;
    const bodyNode = this.element.querySelector('.modal-body');
    const footerNode = this.element.querySelector('.modal-footer');
    typeof body === 'string' ? bodyNode.innerHTML = body : bodyNode.append(body);
    typeof footer === 'string' ? footerNode.innerHTML = footer : footerNode.append(footer);

    const closeButton = this.element.querySelector('.close');
    closeButton.classList.toggle('hidden', !showCloseButton);
    closeButton.addEventListener('click', () => this.close());
    this.element.addEventListener('click', (event) => {
      if (this.closeOnBackdrop && event.target === this.element) this.close();
    });
    if (this.closeOnEscape) {
      document.addEventListener('keydown', this.handleEscape);
    }
  }

  /**
   * Handles Escape key close.
   * @param {KeyboardEvent} event Keyboard event.
   * @returns {void}
   */
  handleEscape = (event) => {
    if (this.closeOnEscape && event.key === 'Escape') this.close();
  };

  /**
   * Opens the modal.
   * @returns {Modal} Current modal.
   */
  open() {
    document.body.append(this.element);
    return this;
  }

  /**
   * Closes the modal.
   * @returns {void}
   */
  close() {
    if (this.closeOnEscape) {
      document.removeEventListener('keydown', this.handleEscape);
    }
    this.element.remove();
  }
}

/**
 * Opens a confirm dialog.
 * @param {string} message Confirm message.
 * @returns {Promise<boolean>} User choice.
 */
export function confirmDialog(message) {
  return new Promise((resolve) => {
    const body = document.createElement('p');
    body.className = 'text-secondary text-sm';
    body.textContent = message;

    const footer = document.createElement('div');
    footer.className = 'flex justify-end gap-2';
    footer.innerHTML = `
      <button type="button" class="cancel btn-secondary rounded-md border px-3 py-2 text-sm">Cancel</button>
      <button type="button" class="confirm btn-danger rounded-md border px-3 py-2 text-sm font-medium">Confirm</button>
    `;

    const modal = new Modal({ title: 'Confirm', body, footer }).open();
    footer.querySelector('.cancel').addEventListener('click', () => {
      modal.close();
      resolve(false);
    });
    footer.querySelector('.confirm').addEventListener('click', () => {
      modal.close();
      resolve(true);
    });
  });
}
