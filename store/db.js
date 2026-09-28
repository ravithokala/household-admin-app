// @ts-check

/**
 * This phone's copy of the data, in IndexedDB (ADR-003). The sheet is the master copy; this one
 * lets the app open at once and be viewed offline. Stores:
 *   items, history, entities  rows as the server sends them
 *   meta                      { key, value }: last refresh time, who is signed in
 * The database name is this app's own: the other apps on this origin use other names.
 * Version 2 removed the offline write queue (outbox) when saving became online-only.
 */

const NAME = 'household-admin';
const VERSION = 2;

/** @type {Promise<IDBDatabase>|null} */
let opening = null;

/** @returns {Promise<IDBDatabase>} */
function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      /** @type {Array<[string, string]>} */
      const stores = [['items', 'item_id'], ['history', 'history_id'], ['entities', 'entity_id'], ['meta', 'key']];
      for (const [name, keyPath] of stores) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
      if (db.objectStoreNames.contains('outbox')) db.deleteObjectStore('outbox');
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
 * @returns {Promise<{ items: Item[], history: HistoryEntry[], entities: Entity[], meta: Record<string, any> }>}
 */
export async function loadAll() {
  const db = await open();
  const tx = db.transaction(['items', 'history', 'entities', 'meta'], 'readonly');
  const [items, history, entities, meta] = await Promise.all(
    ['items', 'history', 'entities', 'meta'].map((s) => done(tx.objectStore(s).getAll())));
  return { items, history, entities, meta: Object.fromEntries(meta.map((/** @type {any} */ m) => [m.key, m.value])) };
}

/**
 * Saves rows (and optionally replaces everything), in one transaction.
 * @param {ChangedRows} rows
 * @param {{ replace?: boolean }} [options]  replace: drop rows not in `rows`
 */
export function saveRows(rows, options = {}) {
  return transact(['items', 'history', 'entities'], 'readwrite', (tx) => {
    /** @type {Array<[string, 'item_id'|'history_id'|'entity_id', any[]]>} */
    const plan = [['items', 'item_id', rows.items], ['history', 'history_id', rows.history], ['entities', 'entity_id', rows.entities]];
    for (const [store, key, list] of plan) {
      const os = tx.objectStore(store);
      if (options.replace) {
        const incoming = new Set(list.map((r) => r[key]));
        const cursor = os.openCursor();
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) return;
          if (!incoming.has(String(c.key))) c.delete();
          c.continue();
        };
      }
      list.forEach((r) => os.put(r));
    }
  });
}

/** @param {Record<string, unknown>} values */
export function setMeta(values) {
  return transact(['meta'], 'readwrite', (tx) => Object.entries(values).forEach(([key, value]) => tx.objectStore('meta').put({ key, value })));
}

/** Empties everything (sign-out). */
export function clearAll() {
  return transact(['items', 'history', 'entities', 'meta'], 'readwrite', (tx) =>
    ['items', 'history', 'entities', 'meta'].forEach((s) => tx.objectStore(s).clear()));
}
