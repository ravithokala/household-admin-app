// @ts-check

import * as db from './db.js';
import * as changes from './changes.js';
import { call } from '../api.js';

/**
 * The app's data (ADR-003, as family-calendar): the sheet is the master copy; this phone keeps a
 * copy in IndexedDB so the app opens at once and can be viewed offline. Saving happens only
 * online, straight to the server: each change is checked here first (the server's own rules),
 * sent, and the rows the server returns replace this phone's copies. Offline, saving says so.
 * The copy refreshes on opening, on returning to the app, when the connection returns, and every
 * five minutes (to pick up the other person's changes).
 */

/** @type {changes.Data} */
export const data = { items: {}, history: {}, entities: {} };

export const status = {
  user: '',
  users: /** @type {string[]} */ ([]),
  /** Server time of the last successful refresh, or null before the first. */
  since: /** @type {string|null} */ (null),
  lastSynced: /** @type {number|null} */ (null),
  online: navigator.onLine,
  refreshing: false,
  /** Why the last refresh failed, if it did (not when simply offline). */
  error: /** @type {string|null} */ (null),
};

/** @type {Set<() => void>} */
const listeners = new Set();

/** Called after anything changes (data or status). @param {() => void} fn */
export const onChange = (fn) => { listeners.add(fn); };
const changed = () => listeners.forEach((fn) => fn());

/** Loads this phone's copy. @returns {Promise<boolean>} whether there was one */
export async function load() {
  const saved = await db.loadAll();
  data.items = Object.fromEntries(saved.items.map((r) => [r.item_id, r]));
  data.history = Object.fromEntries(saved.history.map((r) => [r.history_id, r]));
  data.entities = Object.fromEntries(saved.entities.map((r) => [r.entity_id, r]));
  status.since = saved.meta.since ?? null;
  status.user = saved.meta.user ?? '';
  status.users = saved.meta.users ?? [];
  status.lastSynced = saved.meta.lastSynced ?? null;
  changed();
  return status.since !== null;
}

/** @returns {changes.Who} */
const who = () => ({ user: status.user, users: status.users, now: new Date().toISOString(), newId: () => crypto.randomUUID() });

/** @param {string} message @returns {{ ok: false, errors: Issue[] }} */
const refuse = (message) => ({ ok: false, errors: [{ field: 'request', code: 'NOT_SAVED', message }] });

/** Whether a failure means there is no connection. @param {unknown} e */
const isOffline = (e) => !navigator.onLine || /fetch|network|load failed/i.test(e instanceof Error ? e.message : String(e));

/**
 * Checks a change here, sends it, and keeps what the server returns. Nothing is saved on the
 * phone unless the server accepted it (or, for a refused edit, the server's current row).
 * @param {(w: changes.Who) => changes.Change} make
 * @returns {Promise<{ ok: true, rows: ChangedRows } | { ok: false, errors: Issue[] }>}
 */
async function write(make) {
  const change = make(who());
  if (!change.ok) return change;
  if (!navigator.onLine) return refuse("You're offline: connect to save. Everything here can still be viewed.");
  /** @type {import('../api.js').ApiResponse} */
  let r;
  try {
    r = await call('sync.push', { ops: [change.op] });
  } catch (e) {
    return refuse(isOffline(e) ? "You're offline: connect to save." : `Could not save: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!r.ok) return { ok: false, errors: r.errors };
  /** @type {OpResult} */
  const result = r.data.results[0];
  // Accepted: the saved rows. Refused as out of date: the other person's version, so the screen shows it.
  await keep(result.rows);
  if (!result.ok) return { ok: false, errors: result.errors.length ? result.errors : [{ field: 'request', code: result.code ?? 'NOT_SAVED', message: 'The change was not saved.' }] };
  return { ok: true, rows: result.rows };
}

/** @param {ChangedRows} rows */
async function keep(rows) {
  changes.applyRows(data, rows);
  await db.saveRows(rows);
  changed();
}

/** @param {string} id @param {Record<string, unknown>} fields */
export const saveItem = (id, fields) => write((w) => changes.saveItem(data, id, fields, w));
/** @param {string} id @param {boolean} [deleted] */
export const setItemDeleted = (id, deleted = true) => write((w) => changes.setItemDeleted(data, id, deleted, w));
/** @param {string} id @param {Record<string, unknown>} input */
export const renewItem = (id, input) => write((w) => changes.renewItem(data, id, input, w));
/** @param {string} id @param {Record<string, unknown>} fields */
export const saveEntity = (id, fields) => write((w) => changes.saveEntity(data, id, fields, w));
/** @param {string} id */
export const removeEntity = (id) => write((w) => changes.removeEntity(data, id, w));

/** @type {Promise<void>|null} */
let running = null;

/**
 * Fetches what changed on the server since the last refresh. One at a time: a call while one
 * runs shares it.
 * @returns {Promise<void>}
 */
export function refresh() {
  if (!running) running = run().finally(() => { running = null; });
  return running;
}

async function run() {
  status.refreshing = true;
  changed();
  try {
    const r = await call('sync.pull', { since: status.since });
    if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
    const pulled = /** @type {{ server_time: string, full: boolean, user: string, users: string[], items: Item[], history: HistoryEntry[], entities: Entity[] }} */ (r.data);
    if (pulled.full) {
      data.items = {};
      data.history = {};
      data.entities = {};
    }
    changes.applyRows(data, pulled);
    await db.saveRows(pulled, { replace: pulled.full });
    Object.assign(status, { since: pulled.server_time, user: pulled.user, users: pulled.users, lastSynced: Date.now(), error: null, online: true });
    await db.setMeta({ since: status.since, user: status.user, users: status.users, lastSynced: status.lastSynced });
  } catch (e) {
    status.online = !isOffline(e);
    status.error = status.online ? (e instanceof Error ? e.message : String(e)) : null;
    throw e;
  } finally {
    status.refreshing = false;
    changed();
  }
}

/**
 * An online-only request that changes data in bulk (restoring a backup); then a full reload.
 * @param {string} action @param {unknown} [payload]
 */
export async function bulk(action, payload = {}) {
  const r = await call(action, payload);
  if (r.ok) {
    status.since = null;
    await refresh();
  }
  return r;
}

/** Forgets everything on this phone (signing out). */
export async function forget() {
  await db.clearAll();
  data.items = {};
  data.history = {};
  data.entities = {};
  Object.assign(status, { user: '', users: [], since: null, lastSynced: null, error: null });
  changed();
}

/** Keeps the copy current: when the connection returns, when the app is reopened, and every five minutes. */
export function keepInStep() {
  const attempt = () => { if (navigator.onLine) refresh().catch(() => { /* shown in the header */ }); };
  window.addEventListener('online', () => { status.online = true; attempt(); });
  window.addEventListener('offline', () => { status.online = false; changed(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') attempt(); });
  window.setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - (status.lastSynced ?? 0) > 300000) attempt();
  }, 60000);
}
