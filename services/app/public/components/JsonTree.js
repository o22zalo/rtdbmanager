const TYPE_CLASS = {
  string: 'text-success',
  number: 'text-info',
  boolean: 'text-danger',
  null: 'text-tertiary',
  object: 'text-secondary',
  array: 'text-secondary'
};

/**
 * Returns the JSON type for a value.
 * @param {*} value Value.
 * @returns {string} JSON type.
 */
function getType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Joins an RTDB path with a child key.
 * @param {string} base Base path.
 * @param {string} key Child key.
 * @returns {string} Joined path.
 */
function joinPath(base, key) {
  const normalized = base === '/' ? '' : base.replace(/^\/|\/$/g, '');
  return `/${[normalized, key].filter(Boolean).join('/')}`;
}

/**
 * Parses inline editor input as JSON when possible.
 * @param {string} raw Raw input.
 * @returns {*} Parsed value.
 */
function parseInlineValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Renders and manages a recursive JSON tree.
 */
export class JsonTree {
  /**
   * Creates a JSON tree renderer.
   * @param {object} options Tree options.
   */
  constructor(options) {
    this.projectId = options.projectId;
    this.path = options.path || '/';
    this.data = options.data;
    this.apiFetch = options.apiFetch;
    this.onEdit = options.onEdit;
    this.onDelete = options.onDelete;
    this.onAdd = options.onAdd;
    this.onCopy = options.onCopy;
    this.expanded = new Set();
    this.renderLimits = new Map();
    this.root = document.createElement('div');
    this.root.className = 'font-mono text-sm';
  }

  /**
   * Renders the tree root.
   * @returns {HTMLElement} Root element.
   */
  render() {
    this.root.innerHTML = '';
    this.root.append(this.renderValue('(root)', this.data, this.path, 0, true));
    return this.root;
  }

  /**
   * Renders a value node.
   * @param {string} key Node key.
   * @param {*} value Node value.
   * @param {string} path Node path.
   * @param {number} depth Nesting depth.
   * @param {boolean} forceExpanded Whether root should render expanded.
   * @returns {HTMLElement} Node element.
   */
  renderValue(key, value, path, depth, forceExpanded = false) {
    const type = getType(value);
    const isBranch = type === 'object' || type === 'array';
    const wrapper = document.createElement('div');
    const row = document.createElement('div');
    row.className = 'json-row group';
    row.style.setProperty('--json-depth', String(depth));
    row.dataset.path = path;
    row.innerHTML = `
      <button class="toggle json-toggle hover-surface h-7 w-7 rounded" title="${isBranch ? 'Expand' : 'Value'}">${isBranch ? (forceExpanded || this.expanded.has(path) ? 'v' : '>') : '.'}</button>
      <div class="json-main">
        <div class="json-key" title=""></div>
        <div class="value json-value ${TYPE_CLASS[type]}"></div>
      </div>
      <div class="json-actions text-xs">
        <button type="button" data-action="copy-path" class="json-action">Path</button>
        <button type="button" data-action="copy-value" class="json-action">Copy</button>
        <button type="button" data-action="edit" class="json-action">Edit</button>
        <button type="button" data-action="add" class="json-action">Add</button>
        <button type="button" data-action="delete" class="json-action json-action-danger">Delete</button>
      </div>
    `;

    row.querySelector('.json-key').textContent = key;
    row.querySelector('.json-key').title = key;
    row.querySelector('.value').textContent = this.preview(value);
    row.addEventListener('contextmenu', (event) => this.openContextMenu(event, key, value, path, type));
    row.querySelector('.json-actions').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      event.stopPropagation();
      await this.handleAction(button.dataset.action, value, path, type);
    });

    if (isBranch) {
      row.querySelector('.toggle').addEventListener('click', () => this.toggleBranch(wrapper, value, path, depth));
    } else {
      row.querySelector('.value').addEventListener('dblclick', () => this.startInlineEdit(row, value, path));
    }

    wrapper.append(row);

    if (isBranch && (forceExpanded || this.expanded.has(path))) {
      wrapper.append(this.renderChildren(value, path, depth + 1));
    }

    return wrapper;
  }

  /**
   * Renders object/array children.
   * @param {object|array} value Branch value.
   * @param {string} path Branch path.
   * @param {number} depth Nesting depth.
   * @returns {HTMLElement} Children element.
   */
  renderChildren(value, path, depth) {
    const children = document.createElement('div');
    const entries = Object.entries(value || {});
    const limit = this.renderLimits.get(path) || 200;

    for (const [key, child] of entries.slice(0, limit)) {
      children.append(this.renderValue(key, child, joinPath(path, key), depth));
    }

    if (entries.length > limit) {
      const button = document.createElement('button');
      button.className = 'btn-secondary ml-8 mt-2 rounded-md border px-3 py-2 text-xs';
      button.textContent = `Show ${Math.min(200, entries.length - limit)} more`;
      button.addEventListener('click', () => {
        this.renderLimits.set(path, limit + 200);
        this.render();
      });
      children.append(button);
    }

    return children;
  }

  /**
   * Toggles a branch node.
   * @param {HTMLElement} wrapper Node wrapper.
   * @param {*} value Node value.
   * @param {string} path Node path.
   * @param {number} depth Node depth.
   * @returns {Promise<void>} Resolves after toggle.
   */
  async toggleBranch(wrapper, value, path, depth) {
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
      this.render();
      return;
    }

    this.expanded.add(path);
    this.render();

    if (value === null || typeof value !== 'object') {
      const response = await this.apiFetch(`/data/${this.projectId}?path=${encodeURIComponent(path)}`);
      this.data = response.data;
      this.render();
    }
  }

  /**
   * Returns a compact preview string.
   * @param {*} value Value.
   * @returns {string} Preview.
   */
  preview(value) {
    const type = getType(value);
    if (type === 'object') return `{ ${Object.keys(value || {}).length} keys }`;
    if (type === 'array') return `[ ${value.length} items ]`;
    if (type === 'string') return `"${value}"`;
    return String(value);
  }

  /**
   * Starts primitive inline editing.
   * @param {HTMLElement} row Row element.
   * @param {*} value Current value.
   * @param {string} path Node path.
   * @returns {void}
   */
  startInlineEdit(row, value, path) {
    const valueCell = row.querySelector('.value');
    const input = document.createElement('input');
    input.className = 'field w-full rounded border px-2 py-1 outline-none';
    input.value = typeof value === 'string' ? value : JSON.stringify(value);
    valueCell.innerHTML = '';
    valueCell.append(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        this.render();
      }
      if (event.key === 'Enter') {
        await this.onEdit(path, parseInlineValue(input.value), { immediate: true });
      }
    });
  }

  /**
   * Opens a right-click context menu.
   * @param {MouseEvent} event Mouse event.
   * @param {string} key Node key.
   * @param {*} value Node value.
   * @param {string} path Node path.
   * @param {string} type JSON type.
   * @returns {void}
   */
  openContextMenu(event, key, value, path, type) {
    event.preventDefault();
    document.querySelectorAll('.json-context-menu').forEach((menu) => menu.remove());

    const menu = document.createElement('div');
    menu.className = 'json-context-menu surface-secondary fixed z-50 w-44 overflow-hidden rounded-md border border-secondary text-sm shadow-xl';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.innerHTML = `
      <button data-action="copy-path" class="hover-surface block w-full px-3 py-2 text-left">Copy path</button>
      <button data-action="copy-value" class="hover-surface block w-full px-3 py-2 text-left">Copy value</button>
      <button data-action="edit" class="hover-surface block w-full px-3 py-2 text-left">Edit</button>
      <button data-action="add" class="hover-surface block w-full px-3 py-2 text-left">Add child</button>
      <button data-action="delete" class="badge-danger block w-full px-3 py-2 text-left">Delete node</button>
    `;

    menu.addEventListener('click', async (clickEvent) => {
      const action = clickEvent.target.dataset.action;
      menu.remove();
      await this.handleAction(action, value, path, type);
    });

    document.body.append(menu);
    window.setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    });
  }

  /**
   * Runs a tree row action.
   * @param {string} action Action id.
   * @param {*} value Node value.
   * @param {string} path Node path.
   * @param {string} type JSON type.
   * @returns {Promise<void>} Resolves after action.
   */
  async handleAction(action, value, path, type) {
    if (action === 'copy-path') await this.onCopy(path);
    if (action === 'copy-value') await this.onCopy(JSON.stringify(value, null, 2));
    if (action === 'edit') await this.onEdit(path, value);
    if (action === 'delete') await this.onDelete(path);
    if (action === 'add') {
      await this.onAdd(type === 'object' || type === 'array' ? path : path.replace(/\/[^/]+$/, '') || '/');
    }
  }
}
