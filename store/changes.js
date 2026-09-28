// @ts-check

import { Validation } from '../shared/validation.js';
import { Renewals } from '../shared/renewals.js';
import { Model } from '../shared/model.js';

/**
 * Turning what someone did into a write for the server (Op), checked with the server's own rules
 * first so mistakes show at once, plus the rows it will make. Pure: no storage, no network, so it
 * is tested in Node. Saving is online-only (ADR-003): store.js sends the Op and keeps the rows the
 * server returns.
 *
 * @typedef {{ items: Record<string, Item>, history: Record<string, HistoryEntry>, entities: Record<string, Entity> }} Data
 * @typedef {{ user: string, users: string[], now: string, newId: () => string }} Who
 * @typedef {{ ok: true, op: Op, rows: ChangedRows } | { ok: false, errors: Issue[] }} Change
 */

/** @param {Partial<ChangedRows>} rows @returns {ChangedRows} */
const rowsOf = (rows) => ({ items: rows.items ?? [], history: rows.history ?? [], entities: rows.entities ?? [] });

/** @param {string} message @returns {Change} */
const refuse = (message) => ({ ok: false, errors: [{ field: 'request', code: 'INVALID', message }] });

/** @param {Data} data */
const liveEntities = (data) => Object.values(data.entities);

/**
 * Add (id not yet known) or edit an item.
 * @param {Data} data
 * @param {string} id
 * @param {Record<string, unknown>} fields
 * @param {Who} who
 * @returns {Change}
 */
export function saveItem(data, id, fields, who) {
  const existing = data.items[id] ?? null;
  if (existing?.deleted) return refuse('This item has been deleted.');
  const checked = Validation.item(fields, { users: who.users, entities: liveEntities(data) });
  if (checked.errors.length) return { ok: false, errors: checked.errors };
  const base = existing?.version ?? 0;
  /** @type {Item} */
  const item = { ...(existing ?? Model.blankItem()), ...checked.value, item_id: id, deleted: false, version: base + 1,
    updated_at: who.now, updated_by: who.user, is_sample: existing?.is_sample ?? false };
  return { ok: true, op: { op_id: who.newId(), type: 'item.upsert', payload: { item_id: id, base_version: base, fields: checked.value } }, rows: rowsOf({ items: [item] }) };
}

/**
 * Delete an item, or (deleted false) undo that.
 * @param {Data} data @param {string} id @param {boolean} deleted @param {Who} who
 * @returns {Change}
 */
export function setItemDeleted(data, id, deleted, who) {
  const existing = data.items[id];
  if (!existing) return refuse('No such item.');
  const item = { ...existing, deleted, version: existing.version + 1, updated_at: who.now, updated_by: who.user };
  return { ok: true, op: { op_id: who.newId(), type: 'item.delete', payload: { item_id: id, base_version: existing.version, deleted } }, rows: rowsOf({ items: [item] }) };
}

/**
 * Mark as renewed.
 * @param {Data} data @param {string} id @param {Record<string, unknown>} input @param {Who} who
 * @returns {Change}
 */
export function renewItem(data, id, input, who) {
  const existing = data.items[id];
  if (!existing || existing.deleted) return refuse('No such item.');
  if (existing.archived) return refuse(`${existing.title} is already marked done.`);
  const checked = Validation.renewal(input, existing);
  if (checked.errors.length) return { ok: false, errors: checked.errors };
  const historyId = who.newId();
  const result = Renewals.renew(existing, checked.value, { history_id: historyId, now: who.now, user: who.user });
  return {
    ok: true,
    op: { op_id: who.newId(), type: 'item.renew', payload: { item_id: id, base_version: existing.version, history_id: historyId, renewal: checked.value } },
    rows: rowsOf({ items: [result.item], history: [result.history] }),
  };
}

/**
 * Add or edit a vehicle, home or person.
 * @param {Data} data @param {string} id @param {Record<string, unknown>} fields @param {Who} who
 * @returns {Change}
 */
export function saveEntity(data, id, fields, who) {
  const existing = data.entities[id] ?? null;
  const checked = Validation.entity(fields);
  if (existing && checked.value.entity_type !== existing.entity_type) checked.errors.push({ field: 'entity_type', code: 'INVALID', message: 'cannot be changed' });
  if (checked.errors.length) return { ok: false, errors: checked.errors };
  const base = existing?.version ?? 0;
  /** @type {Entity} */
  const entity = { ...(existing ?? Model.blankEntity()), ...checked.value, entity_id: id, deleted: false, version: base + 1,
    updated_at: who.now, updated_by: who.user, is_sample: existing?.is_sample ?? false };
  return { ok: true, op: { op_id: who.newId(), type: 'entity.upsert', payload: { entity_id: id, base_version: base, fields: checked.value } }, rows: rowsOf({ entities: [entity] }) };
}

/**
 * Remove a vehicle, home or person that no live item belongs to.
 * @param {Data} data @param {string} id @param {Who} who
 * @returns {Change}
 */
export function removeEntity(data, id, who) {
  const existing = data.entities[id];
  if (!existing || existing.deleted) return refuse('No such entry.');
  const using = Object.values(data.items).filter((i) => i.entity_id === id && !i.deleted);
  if (using.length) return refuse(`${existing.name} still has ${using.length} item(s): ${using.slice(0, 3).map((i) => i.title).join(', ')}. Move or delete them first.`);
  const entity = { ...existing, deleted: true, version: existing.version + 1, updated_at: who.now, updated_by: who.user };
  return { ok: true, op: { op_id: who.newId(), type: 'entity.delete', payload: { entity_id: id, base_version: existing.version } }, rows: rowsOf({ entities: [entity] }) };
}

/**
 * Copies rows into the data, replacing any older copy of each.
 * @param {Data} data @param {ChangedRows} rows
 */
export function applyRows(data, rows) {
  rows.items.forEach((r) => { data.items[r.item_id] = r; });
  rows.history.forEach((r) => { data.history[r.history_id] = r; });
  rows.entities.forEach((r) => { data.entities[r.entity_id] = r; });
}

/**
 * A backup file of this phone's copy (works offline).
 * @param {Data} data @param {string} now
 */
export function backup(data, now) {
  return {
    app: 'household-admin',
    format: 1,
    exported_at: now,
    items: Object.values(data.items).filter((i) => !i.deleted),
    history: Object.values(data.history),
    entities: Object.values(data.entities).filter((e) => !e.deleted),
  };
}

/**
 * The items shown on a list, filtered and searched. Every word must match somewhere.
 * @param {Data} data
 * @param {{ category?: string, entity?: string, query?: string, done?: boolean }} filters
 *   entity: an entity id, or 'household'
 */
export function filterItems(data, filters) {
  const words = (filters.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return Renewals.sortByActBy(Object.values(data.items).filter((i) => {
    if (i.deleted || (i.archived && !filters.done)) return false;
    if (filters.category && i.category !== filters.category) return false;
    if (filters.entity === 'household' ? i.entity_type !== 'household' : filters.entity && i.entity_id !== filters.entity) return false;
    if (!words.length) return true;
    const entity = i.entity_id ? data.entities[i.entity_id] : null;
    const text = [i.title, i.provider, i.reference, i.notes, entity?.name, entity?.reg, ...i.attachments.map((a) => a.label)].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => text.includes(w));
  }));
}
