// @ts-check

/**
 * This phone's copy of the data, in IndexedDB (ADR-003). The sheet is the master copy; this one
 * lets the app open at once and work offline. Stores:
 *   items, history, entities  rows as the server sends them
 *   outbox                    writes made here and not yet confirmed by the server, in order
 *   meta                      { key, value }: last pull time, who is signed in
 * The database name is this app's own: the other apps on this origin use other names.
 */

const NAME = 'household-admin';
const VERSION = 1;

/** @type {Promise<IDBDatabase>|null} */
let opening = null;

/** @returns {Promise<IDBDatabase>} */
function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('items', { keyPath: 'item_id' });
      db.createObjectStore('history', { keyPath: 'history_id' });
      db.createObjectStore('entities', { keyPath: 'entity_id' });
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
    request.onblocked = () => reject(new Error('Close this app in other tabs, then reload.'));
  });
  return opening;
}

/**
 * Runs `work` in one transaction and resolves when it has committed.
 * @template T
 * @param {string[]} stores
 * @param {IDBTransactionMode} mode
 * @param {(tx: IDBTransaction) => T} work
 * @returns {Promise<T>}
 */
async function transact(stores, mode, work) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = work(tx);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('storage write was cancelled'));
  });
}

/**
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
const done = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

/**
 * Everything saved on this phone.
 * @returns {Promise<{ items: Item[], history: HistoryEntry[], entities: Entity[], outbox: Array<Op & { seq: number }>, meta: Record<string, any> }>}
 */
export async function loadAll() {
  const db = await open();
  const tx = db.transaction(['items', 'history', 'entities', 'outbox', 'meta'], 'readonly');
  const [items, history, entities, outbox, meta] = await Promise.all(
    ['items', 'history', 'entities', 'outbox', 'meta'].map((s) => done(tx.objectStore(s).getAll())));
  return { items, history, entities, outbox, meta: Object.fromEntries(meta.map((/** @type {any} */ m) => [m.key, m.value])) };
}

/**
 * Saves rows (and optionally replaces everything first), in one transaction.
 * @param {ChangedRows} rows
 * @param {{ replace?: boolean, keep?: Set<string> }} [options]  replace: drop rows not in `rows`, except ids in keep
 */
export function saveRows(rows, options = {}) {
  return transact(['items', 'history', 'entities'], 'readwrite', (tx) => {
    /** @type {Array<[string, 'item_id'|'history_id'|'entity_id', any[]]>} */
    const plan = [['items', 'item_id', rows.items], ['history', 'history_id', rows.history], ['entities', 'entity_id', rows.entities]];
    for (const [store, key, list] of plan) {
      const os = tx.objectStore(store);
      if (options.replace) {
        const keep = options.keep ?? new Set();
        const incoming = new Set(list.map((r) => r[key]));
        const cursor = os.openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) return;
          const id = String(c.key);
          if (!incoming.has(id) && !keep.has(id)) c.delete();
          c.continue();
        };
      }
      list.filter((r) => !options.keep?.has(r[key])).forEach((r) => os.put(r));
    }
  });
}

/**
 * Queues a write and saves its local effect, together, so neither is kept without the other.
 * @param {Op} op
 * @param {ChangedRows} rows
 */
export function queue(op, rows) {
  return transact(['items', 'history', 'entities', 'outbox'], 'readwrite', (tx) => {
    rows.items.forEach((r) => tx.objectStore('items').put(r));
    rows.history.forEach((r) => tx.objectStore('history').put(r));
    rows.entities.forEach((r) => tx.objectStore('entities').put(r));
    tx.objectStore('outbox').add(op);
  });
}

/** @returns {Promise<Array<Op & { seq: number }>>} */
export async function outbox() {
  const db = await open();
  return done(db.transaction('outbox', 'readonly').objectStore('outbox').getAll());
}

/** @param {number[]} seqs */
export function dropFromOutbox(seqs) {
  return transact(['outbox'], 'readwrite', (tx) => seqs.forEach((s) => tx.objectStore('outbox').delete(s)));
}

/** @param {Record<string, unknown>} values */
export function setMeta(values) {
  return transact(['meta'], 'readwrite', (tx) => Object.entries(values).forEach(([key, value]) => tx.objectStore('meta').put({ key, value })));
}

/** Empties everything (sign-out). */
export function clearAll() {
  return transact(['items', 'history', 'entities', 'outbox', 'meta'], 'readwrite', (tx) =>
    ['items', 'history', 'entities', 'outbox', 'meta'].forEach((s) => tx.objectStore(s).clear()));
}
