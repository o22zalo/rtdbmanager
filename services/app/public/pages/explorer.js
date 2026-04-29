import { apiFetch, toast } from '../app.js';
import { JsonTree } from '../components/JsonTree.js';
import { Modal, confirmDialog } from '../components/Modal.js';

/**
 * Renders the RTDB explorer page.
 * @param {string} projectId Project id.
 * @returns {Promise<HTMLElement>} Explorer page.
 */
export async function renderExplorer(projectId) {
  const root = document.createElement('section');
  root.className = 'grid min-h-screen grid-rows-[auto_1fr]';
  root.innerHTML = `
    <header class="surface-primary border-b border-tertiary p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="project-name text-primary text-lg font-semibold tracking-normal">Explorer</h1>
          <p class="database-url text-tertiary mt-1 break-all text-xs"></p>
        </div>
        <div class="grid w-full grid-cols-3 gap-2 sm:w-auto sm:flex sm:flex-wrap">
          <button class="refresh btn-secondary rounded-md border px-3 py-2 text-sm" title="Refresh">Refresh</button>
          <button class="export btn-secondary rounded-md border px-3 py-2 text-sm" title="Export JSON">Export</button>
          <button class="add btn-primary rounded-md px-3 py-2 text-sm" title="Add node">Add Node</button>
        </div>
      </div>
      <div class="grid gap-2 md:grid-cols-[1fr_260px]">
        <nav class="breadcrumbs surface-secondary flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-tertiary px-3 py-2 text-sm"></nav>
        <input class="path-input field rounded-md border px-3 py-2 font-mono text-sm outline-none" value="/">
      </div>
    </header>
    <div class="grid min-h-0 grid-cols-1 lg:grid-cols-[220px_1fr]">
      <aside class="surface-primary text-tertiary hidden border-r border-tertiary p-4 text-sm lg:block">
        <div class="text-secondary mb-2 font-medium">Path</div>
        <div class="side-path break-all font-mono text-xs">/</div>
      </aside>
      <main class="min-w-0 overflow-auto">
        <div class="tree min-h-full p-3"></div>
      </main>
    </div>
  `;

  const state = {
    projectId,
    project: null,
    path: '/',
    data: null
  };

  const loadProject = async () => {
    const response = await apiFetch(`/projects/${projectId}`);
    state.project = response.project;
    root.querySelector('.project-name').textContent = response.project.name;
    root.querySelector('.database-url').textContent = response.project.databaseUrl;
  };

  const loadData = async (path = state.path) => {
    state.path = normalizeDisplayPath(path);
    root.querySelector('.path-input').value = state.path;
    root.querySelector('.side-path').textContent = state.path;
    renderBreadcrumbs(root, state.path, loadData);
    root.querySelector('.tree').innerHTML = '<div class="text-tertiary p-4 text-sm">Loading...</div>';

    const response = await apiFetch(`/data/${projectId}?path=${encodeURIComponent(state.path)}`);
    state.data = response.data;
    renderTree(root, state, loadData);
  };

  root.querySelector('.refresh').addEventListener('click', () => loadData().catch((error) => toast.error(error.message)));
  root.querySelector('.export').addEventListener('click', () => {
    window.location.href = `/data/${projectId}/export?path=${encodeURIComponent(state.path)}`;
  });
  root.querySelector('.add').addEventListener('click', () => openAddNode(projectId, state.path, loadData));
  root.querySelector('.path-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      loadData(event.target.value).catch((error) => toast.error(error.message));
    }
  });

  await loadProject();
  await loadData('/');
  return root;
}

/**
 * Normalizes display paths.
 * @param {string} path Path.
 * @returns {string} Normalized path.
 */
function normalizeDisplayPath(path) {
  const cleaned = String(path || '/').trim();
  if (cleaned === '' || cleaned === '/') return '/';
  return `/${cleaned.replace(/^\/+|\/+$/g, '')}`;
}

/**
 * Renders breadcrumbs.
 * @param {HTMLElement} root Page root.
 * @param {string} path Current path.
 * @param {Function} loadData Data loader.
 * @returns {void}
 */
function renderBreadcrumbs(root, path, loadData) {
  const breadcrumbs = root.querySelector('.breadcrumbs');
  const parts = path === '/' ? [] : path.replace(/^\//, '').split('/');
  breadcrumbs.innerHTML = '';

  const rootButton = breadcrumbButton('/', () => loadData('/'));
  breadcrumbs.append(rootButton);

  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    const separator = document.createElement('span');
    separator.className = 'text-tertiary';
    separator.textContent = '/';
    breadcrumbs.append(separator);
    breadcrumbs.append(breadcrumbButton(part, () => loadData(current)));
  }
}

/**
 * Creates a breadcrumb button.
 * @param {string} label Button label.
 * @param {Function} onClick Click handler.
 * @returns {HTMLElement} Button.
 */
function breadcrumbButton(label, onClick) {
  const button = document.createElement('button');
  button.className = 'hover-surface text-info rounded px-2 py-1';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Renders the JSON tree.
 * @param {HTMLElement} root Page root.
 * @param {object} state Explorer state.
 * @param {Function} loadData Data loader.
 * @returns {void}
 */
function renderTree(root, state, loadData) {
  const container = root.querySelector('.tree');
  container.innerHTML = '';
  const tree = new JsonTree({
    projectId: state.projectId,
    path: state.path,
    data: state.data,
    apiFetch,
    onCopy: async (value) => {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    },
    onEdit: async (path, value, options = {}) => {
      await openEditNode(state.projectId, path, value, () => loadData(state.path), options);
    },
    onDelete: async (path) => {
      await deleteNode(state.projectId, path, () => loadData(state.path));
    },
    onAdd: async (path) => {
      await openAddNode(state.projectId, path, () => loadData(state.path));
    }
  });
  container.append(tree.render());
}

/**
 * Opens an edit modal or saves primitive inline edits.
 * @param {string} projectId Project id.
 * @param {string} path Node path.
 * @param {*} value New or current value.
 * @param {Function} refresh Refresh callback.
 * @param {{immediate?: boolean}} options Edit options.
 * @returns {Promise<void>} Resolves after edit.
 */
async function openEditNode(projectId, path, value, refresh, options = {}) {
  if (options.immediate) {
    await saveNodeValue(projectId, path, value);
    toast.success('Value saved');
    await refresh();
    return;
  }

  const body = document.createElement('div');
  body.className = 'grid gap-2';
  body.innerHTML = `
    <textarea class="editor field min-h-[320px] rounded-md border p-3 font-mono text-sm outline-none"></textarea>
    <p class="error text-danger min-h-5 text-sm"></p>
  `;
  body.querySelector('.editor').value = formatEditableValue(value);

  const footer = document.createElement('div');
  footer.className = 'flex justify-end gap-2';
  footer.innerHTML = `
    <button class="save btn-primary rounded-md px-3 py-2 text-sm">Save</button>
  `;

  const modal = new Modal({ title: `Edit ${path}`, body, footer }).open();
  footer.querySelector('.save').addEventListener('click', async () => {
    try {
      const parsed = parseEditedValue(body.querySelector('.editor').value, value);
      await saveNodeValue(projectId, path, parsed);
      modal.close();
      toast.success('Node saved');
      await refresh();
    } catch (error) {
      body.querySelector('.error').textContent = error.message;
    }
  });
}

/**
 * Saves a node value.
 * @param {string} projectId Project id.
 * @param {string} path Node path.
 * @param {*} value Value to save.
 * @returns {Promise<void>} Resolves after save.
 */
async function saveNodeValue(projectId, path, value) {
  await apiFetch(`/data/${projectId}?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  });
}

/**
 * Formats a value for the edit textarea.
 * @param {*} value Current value.
 * @returns {string} Editable value.
 */
function formatEditableValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * Parses an edited value while keeping string edits ergonomic.
 * @param {string} raw Raw editor text.
 * @param {*} original Original value.
 * @returns {*} Parsed value.
 */
function parseEditedValue(raw, original) {
  if (typeof original === 'string') {
    return raw;
  }

  return JSON.parse(raw);
}

/**
 * Opens the add node modal.
 * @param {string} projectId Project id.
 * @param {string} parentPath Parent path.
 * @param {Function} refresh Refresh callback.
 * @returns {Promise<void>} Resolves after adding.
 */
async function openAddNode(projectId, parentPath, refresh) {
  const body = document.createElement('form');
  body.className = 'grid gap-3';
  body.innerHTML = `
    <label class="grid gap-1 text-sm">
      <span class="text-secondary">Key</span>
      <input name="key" required class="field rounded-md border px-3 py-2 outline-none">
    </label>
    <label class="grid gap-1 text-sm">
      <span class="text-secondary">Type</span>
      <select name="type" class="field rounded-md border px-3 py-2 outline-none">
        <option value="string">String</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
        <option value="null">Null</option>
        <option value="object">Object</option>
        <option value="array">Array</option>
      </select>
    </label>
    <label class="grid gap-1 text-sm">
      <span class="text-secondary">Value</span>
      <textarea name="value" class="field min-h-28 rounded-md border px-3 py-2 font-mono outline-none"></textarea>
    </label>
    <p class="error text-danger min-h-5 text-sm"></p>
  `;

  const footer = document.createElement('div');
  footer.className = 'flex justify-end';
  footer.innerHTML = '<button type="submit" form="add-node-form" class="btn-primary rounded-md px-3 py-2 text-sm">Add</button>';
  body.id = 'add-node-form';

  const modal = new Modal({ title: `Add child to ${parentPath}`, body, footer }).open();
  body.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(body);
      const path = `${normalizeDisplayPath(parentPath).replace(/\/$/, '')}/${form.get('key')}`.replace(/^\/\//, '/');
      const value = parseValue(form.get('type'), form.get('value'));
      await apiFetch(`/data/${projectId}?path=${encodeURIComponent(path)}`, {
        method: 'PUT',
        body: JSON.stringify({ value })
      });
      modal.close();
      toast.success('Node added');
      await refresh();
    } catch (error) {
      body.querySelector('.error').textContent = error.message;
    }
  });
}

/**
 * Parses add-node values by selected type.
 * @param {string} type Value type.
 * @param {string} raw Raw input.
 * @returns {*} Parsed value.
 */
function parseValue(type, raw) {
  if (type === 'string') return String(raw || '');
  if (type === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error('Value must be a number.');
    return value;
  }
  if (type === 'boolean') return raw === 'true' || raw === '1';
  if (type === 'null') return null;
  if (type === 'array' || type === 'object') {
    const parsed = raw ? JSON.parse(raw) : type === 'array' ? [] : {};
    if (type === 'array' && !Array.isArray(parsed)) throw new Error('Value must be a JSON array.');
    if (type === 'object' && (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object')) throw new Error('Value must be a JSON object.');
    return parsed;
  }
  return raw;
}

/**
 * Deletes a node after confirmation.
 * @param {string} projectId Project id.
 * @param {string} path Node path.
 * @param {Function} refresh Refresh callback.
 * @returns {Promise<void>} Resolves after delete.
 */
async function deleteNode(projectId, path, refresh) {
  if (!await confirmDialog(`Delete ${path}?`)) return;
  await apiFetch(`/data/${projectId}?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  toast.success('Node deleted');
  await refresh();
}
