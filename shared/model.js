// @ts-check
// GENERATED from apps-script/domain/model.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * The records' fields (in sheet column order) and their fixed vocabularies. Only facts are
 * stored: the act-by date and status are always calculated (domain/renewals.js).
 * Adding a field at the END of a list is additive (Bootstrap appends the column); any other
 * change to a tab holding live data needs an explicit migration.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Model = (() => {
  const ITEM_FIELDS = Object.freeze(['item_id', 'title', 'category', 'template_id', 'entity_type', 'entity_id', 'due_date',
    'lead_time_days', 'recurrence_unit', 'recurrence_every', 'roll_from', 'owners', 'provider', 'reference', 'cost_pence',
    'notes', 'attachments', 'archived', 'deleted', 'version', 'updated_at', 'updated_by', 'is_sample', 'on_calendar']);

  const HISTORY_FIELDS = Object.freeze(['history_id', 'item_id', 'renewed_on', 'previous_due_date', 'new_due_date', 'provider',
    'cost_pence', 'quotes', 'notes', 'version', 'updated_at', 'updated_by', 'is_sample']);

  const ENTITY_FIELDS = Object.freeze(['entity_id', 'entity_type', 'name', 'reg', 'make', 'model', 'address', 'is_rental',
    'deleted', 'version', 'updated_at', 'updated_by', 'is_sample', 'calendar_code']);

  /** The write log: one row per write from the app, so a resent offline write is applied once. */
  const OP_FIELDS = Object.freeze(['op_id', 'at', 'user', 'type', 'target_id', 'result']);

  /** @type {ReadonlyArray<EntityType>} */
  const ENTITY_TYPES = Object.freeze(['vehicle', 'property', 'person', 'household']);
  /** @type {ReadonlyArray<RecurrenceUnit>} */
  const RECURRENCE_UNITS = Object.freeze(['none', 'month', 'year']);
  /** @type {ReadonlyArray<RollFrom>} */
  const ROLL_FROM = Object.freeze(['due', 'done']);

  /** @type {Readonly<Record<EntityType, string>>} */
  const ENTITY_LABELS = Object.freeze({ vehicle: 'Vehicle', property: 'Home', person: 'Person', household: 'Household' });

  /** Every field of an Item, with the values a new one starts with. @returns {Item} */
  const blankItem = () => ({
    item_id: '', title: '', category: 'other', template_id: null, entity_type: 'household', entity_id: null, due_date: '',
    lead_time_days: 30, recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', owners: [], provider: null,
    reference: null, cost_pence: null, notes: null, attachments: [], archived: false, deleted: false, version: 0,
    updated_at: null, updated_by: null, is_sample: false, on_calendar: false,
  });

  /** @returns {Entity} */
  const blankEntity = () => ({
    entity_id: '', entity_type: 'person', name: '', reg: null, make: null, model: null, address: null, is_rental: false,
    deleted: false, version: 0, updated_at: null, updated_by: null, is_sample: false, calendar_code: null,
  });

  /**
   * How a recurrence reads: 'Every year', 'Every 6 months', 'One-off'.
   * @param {RecurrenceUnit} unit @param {number|null} every
   */
  function recurrenceLabel(unit, every) {
    if (unit === 'none' || !every) return 'One-off';
    if (every === 1) return `Every ${unit}`;
    return `Every ${every} ${unit}s`;
  }

  /** '£1,234.50' from pence. @param {number|null|undefined} pence */
  function money(pence) {
    if (pence === null || pence === undefined) return '';
    const pounds = pence / 100;
    return `£${pounds.toLocaleString('en-GB', { minimumFractionDigits: pence % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Pence from what someone typed ('£1,234.5', '99'); null if blank; NaN if not a sum of money.
   * @param {string|null|undefined} text
   */
  function parseMoney(text) {
    const cleaned = String(text ?? '').replace(/[£,\s]/g, '');
    if (cleaned === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
    return Math.round(Number(cleaned) * 100);
  }

  return { ITEM_FIELDS, HISTORY_FIELDS, ENTITY_FIELDS, OP_FIELDS, ENTITY_TYPES, RECURRENCE_UNITS, ROLL_FROM, ENTITY_LABELS,
    blankItem, blankEntity, recurrenceLabel, money, parseMoney };
})();

export { Model };
