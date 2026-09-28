// @ts-check

import * as db from './db.js';
import * as changes from './changes.js';
import { call } from '../api.js';

/**
 * The app's data and its syncing (ADR-003). Screens read `data` directly and call the write
 * functions; each write updates this phone at once (and IndexedDB), queues the change, and syncs
 * in the background: push the queue, then pull what others changed. Offline, changes wait in the
 * queue and go when the connection is back.
 *
 * @typedef {{ message: string, redo?: () => Promise<void> }} Problem
 */

/** @type {changes.Data} */
export const data = { items: {}, history: {}, entities: {} };

export const status = {
  user: '',
  users: /** @type {string[]} */ ([]),
  /** Server time of the last successful pull, or null before the first. */
  since: /** @type {string|null} */ (null),
  lastSynced: /** @type {number|null} */ (null),
  pending: 0,
  online: navigator.onLine,
  syncing: false,
  /** Why the last sync failed, if it did. */
  error: /** @type {string|null} */ (null),
};

/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {Set<(p: Problem) => void>} */
const problemListeners = new Set();

/** Called after anything changes (data or sync status). @param {() => void} fn */
export const onChange = (fn) => { listeners.add(fn); };
/** Called when the server refused a queued change. @param {(p: Problem) => void} fn */
export const onProblem = (fn) => { problemListeners.add(fn); };
const changed = () => listeners.forEach((fn) => fn());

/** Loads this phone's copy. @returns {Promise<boolean>} whether there was one */
export async function load() {
  const saved = await db.loadAll();
  data.items = Object.fromEntries(saved.items.map((r) => [r.item_id, r]));
  data.history = Object.fromEntries(saved.history.map((r) => [r.history_id, r]));
  data.entities = Object.fromEntries(saved.entities.map((r) => [r.entity_id, r]));
  status.pending = saved.outbox.length;
  status.since = saved.meta.since ?? null;
  status.user = saved.meta.user ?? '';
  status.users = saved.meta.users ?? [];
  status.lastSynced = saved.meta.lastSynced ?? null;
  changed();
  return status.since !== null;
}

/** @returns {changes.Who} */
const who = () => ({ user: status.user, users: status.users, now: new Date().toISOString(), newId: () => crypto.randomUUID() });

/**
 * Applies a change here, queues it, and starts a sync.
 * @param {(w: changes.Who) => changes.Change} make
 * @returns {Promise<{ ok: true, op: Op, rows: ChangedRows } | { ok: false, errors: Issue[] }>}
 */
async function commit(make) {
  const change = make(who());
  if (!change.ok) return change;
  changes.applyRows(data, change.rows);
  await db.queue(change.op, change.rows);
  status.pending += 1;
  changed();
  soon();
  return change;
}

/** @param {string} id @param {Record<string, unknown>} fields */
export const saveItem = (id, fields) => commit((w) => changes.saveItem(data, id, fields, w));
/** @param {string} id @param {boolean} [deleted] */
export const setItemDeleted = (id, deleted = true) => commit((w) => changes.setItemDeleted(data, id, deleted, w));
/** @param {string} id @param {Record<string, unknown>} input */
export const renewItem = (id, input) => commit((w) => changes.renewItem(data, id, input, w));
/** @param {string} id @param {Record<string, unknown>} fields */
export const saveEntity = (id, fields) => commit((w) => changes.saveEntity(data, id, fields, w));
/** @param {string} id */
export const removeEntity = (id) => commit((w) => changes.removeEntity(data, id, w));

let timer = 0;
/** Syncs shortly, so a burst of changes goes in one request. */
function soon() {
  clearTimeout(timer);
  timer = window.setTimeout(() => { sync().catch(() => { /* status.error says why */ }); }, 300);
}

/** @type {Promise<void>|null} */
let running = null;

/**
 * Push the queue, then pull. One at a time; a call while one runs waits for it and runs again.
 * @returns {Promise<void>}
 */
export async function sync() {
  if (running) { await running; return sync(); }
  running = run().finally(() => { running = null; });
  return running;
}

async function run() {
  status.syncing = true;
  changed();
  try {
    await push();
    await pull();
    status.error = null;
    status.online = true;
    status.lastSynced = Date.now();
    await db.setMeta({ lastSynced: status.lastSynced });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // A failed fetch means no connection: the queue simply waits.
    status.online = navigator.onLine && !/fetch|network|load failed/i.test(message);
    status.error = status.online ? message : null;
    throw e;
  } finally {
    status.syncing = false;
    changed();
  }
}

async function push() {
  const queued = await db.outbox();
  if (queued.length === 0) return;
  const batch = queued.slice(0, 100);
  const r = await call('sync.push', { ops: batch.map(({ op_id, type, payload }) => ({ op_id, type, payload })) });
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  /** @type {OpResult[]} */
  const results = r.data.results;
  const answered = new Map(results.map((x) => [x.op_id, x]));
  const done = batch.filter((op) => answered.has(op.op_id));
  // Later queued writes keep their local rows until the server answers for them too.
  const stillQueued = changes.pendingIds(queued.filter((op) => !answered.has(op.op_id)));
  /** @type {ChangedRows} */
  const rows = { items: [], history: [], entities: [] };
  for (const op of done) {
    const result = /** @type {OpResult} */ (answered.get(op.op_id));
    rows.items.push(...result.rows.items);
    rows.history.push(...result.rows.history);
    rows.entities.push(...result.rows.entities);
    if (!result.ok) report(op, result);
  }
  changes.applyRows(data, rows, stillQueued);
  await db.saveRows(rows, { keep: stillQueued });
  await db.dropFromOutbox(done.map((op) => op.seq));
  status.pending = queued.length - done.length;
  // A refused write may leave rows here that only it made (a new item, a renewal's history
  // entry): the full pull that follows replaces this phone's copy with the server's.
  if (results.some((x) => !x.ok)) status.since = null;
  if (queued.length > batch.length) await push();
}

/**
 * Tells the screens about a refused change, with a way to redo an edit on the current version.
 * @param {Op} op @param {OpResult} result
 */
function report(op, result) {
  const message = result.errors.map((e) => (e.field && e.field !== 'request' ? `${e.field.replace(/_/g, ' ')}: ${e.message}` : e.message)).join(' ')
    || 'A change could not be saved.';
  /** @type {Problem} */
  const problem = { message };
  if (result.code === 'CONFLICT' && op.type === 'item.upsert') {
    problem.redo = async () => { await saveItem(op.payload.item_id, op.payload.fields); };
  } else if (result.code === 'CONFLICT' && op.type === 'entity.upsert') {
    problem.redo = async () => { await saveEntity(op.payload.entity_id, op.payload.fields); };
  }
  problemListeners.forEach((fn) => fn(problem));
}

async function pull() {
  const r = await call('sync.pull', { since: status.since });
  if (!r.ok) throw new Error(r.errors.map((e) => e.message).join('; '));
  const pulled = /** @type {{ server_time: string, full: boolean, user: string, users: string[], items: Item[], history: HistoryEntry[], entities: Entity[] }} */ (r.data);
  const keep = changes.pendingIds(await db.outbox());
  if (pulled.full) {
    // Everything is replaced, except rows with a change still waiting to be sent.
    /** @param {Record<string, any>} map */
    const kept = (map) => Object.fromEntries(Object.entries(map).filter(([id]) => keep.has(id)));
    data.items = kept(data.items);
    data.history = kept(data.history);
    data.entities = kept(data.entities);
  }
  changes.applyRows(data, pulled, keep);
  await db.saveRows(pulled, { replace: pulled.full, keep });
  status.since = pulled.server_time;
  status.user = pulled.user;
  status.users = pulled.users;
  await db.setMeta({ since: status.since, user: status.user, users: status.users });
}

/**
 * An online-only request that changes data in bulk (restoring a backup); then a full reload.
 * @param {string} action @param {unknown} [payload]
 */
export async function bulk(action, payload = {}) {
  await sync();
  const r = await call(action, payload);
  if (r.ok) {
    status.since = null;
    await sync();
  }
  return r;
}

/** Forgets everything on this phone (signing out). */
export async function forget() {
  await db.clearAll();
  data.items = {};
  data.history = {};
  data.entities = {};
  Object.assign(status, { user: '', users: [], since: null, lastSynced: null, pending: 0, error: null });
  changed();
}

/** Keeps in step: when the connection returns, when the app is reopened, and every few minutes. */
export function keepInStep() {
  const attempt = () => { if (navigator.onLine) sync().catch(() => { /* shown in the header */ }); };
  window.addEventListener('online', () => { status.online = true; attempt(); });
  window.addEventListener('offline', () => { status.online = false; changed(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') attempt(); });
  // Every minute while changes wait; otherwise every five, to pick up the other person's changes.
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (status.pending > 0 || Date.now() - (status.lastSynced ?? 0) > 300000) attempt();
  }, 60000);
}
