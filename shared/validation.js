// @ts-check
// GENERATED from apps-script/domain/validation.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Dates } from './dates.js';
import { Model } from './model.js';
import { Templates } from './templates.js';
import { Sensitive } from './sensitive.js';

/**
 * Checks and tidies what someone entered. The server always validates; the phone runs the same
 * checks first so a change made offline is not queued only to be refused later.
 * Each function returns the tidied values plus any errors ({ field, code, message }).
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Validation = (() => {
  const ID = /^[A-Za-z0-9-]{8,64}$/;
  const LIMITS = Object.freeze({ title: 120, provider: 120, reference: 80, notes: 2000, label: 80, location: 300, name: 80, address: 300 });
  const MAX_LEAD_DAYS = 730;
  const MAX_EVERY = 50;
  const MAX_PENCE = 100000000;
  const MAX_ATTACHMENTS = 10;
  const MAX_QUOTES = 10;

  /** Fields the app may change on an item; the server sets the rest. */
  const ITEM_INPUT = Object.freeze(['title', 'category', 'template_id', 'entity_type', 'entity_id', 'due_date', 'lead_time_days',
    'recurrence_unit', 'recurrence_every', 'roll_from', 'owners', 'provider', 'reference', 'cost_pence', 'notes', 'attachments', 'archived']);
  const ENTITY_INPUT = Object.freeze(['entity_type', 'name', 'reg', 'make', 'model', 'address', 'is_rental']);

  /** @param {unknown} value */
  const isId = (value) => typeof value === 'string' && ID.test(value);

  /**
   * A small collector, so each check reads as one line.
   */
  function collector() {
    /** @type {Issue[]} */
    const errors = [];
    return {
      errors,
      /** @param {string} field @param {string} code @param {string} message */
      add(field, code, message) { errors.push({ field, code, message }); },
      /**
       * Optional text: trimmed, blank becomes null; too long or sensitive is an error.
       * @param {string} field @param {unknown} value @param {number} max
       * @returns {string|null}
       */
      text(field, value, max) {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') { this.add(field, 'INVALID', 'must be text'); return null; }
        const trimmed = value.trim();
        if (trimmed.length > max) this.add(field, 'TOO_LONG', `must be at most ${max} characters`);
        const problem = Sensitive.problem(trimmed);
        if (problem) this.add(field, 'SENSITIVE', problem);
        return trimmed === '' ? null : trimmed;
      },
      /**
       * @param {string} field @param {unknown} value @param {number} min @param {number} max
       * @returns {number|null}
       */
      int(field, value, min, max) {
        if (value === null || value === undefined || value === '') return null;
        const n = typeof value === 'string' ? Number(value) : value;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
          this.add(field, 'INVALID', `must be a whole number from ${min} to ${max}`);
          return null;
        }
        return n;
      },
      /** @param {string} field @param {unknown} value @returns {string|null} */
      date(field, value) {
        if (value === null || value === undefined || value === '') return null;
        if (!Dates.isValid(value)) { this.add(field, 'INVALID', 'must be a real date'); return null; }
        return value;
      },
    };
  }

  /**
   * An item's editable fields.
   * @param {Record<string, unknown>} input
   * @param {{ users: string[], entities: Entity[] }} known
   */
  function item(input, known) {
    const c = collector();
    const title = c.text('title', input.title, LIMITS.title);
    if (!title) c.add('title', 'REQUIRED', 'is required');

    const category = typeof input.category === 'string' && Templates.CATEGORIES.some((x) => x.id === input.category) ? input.category : null;
    if (!category) c.add('category', 'INVALID', 'is not a known category');

    const templateId = input.template_id === null || input.template_id === undefined || input.template_id === '' ? null : String(input.template_id);
    if (templateId && !Templates.get(templateId)) c.add('template_id', 'INVALID', 'is not a known template');

    const entityType = /** @type {EntityType} */ (input.entity_type);
    if (!Model.ENTITY_TYPES.includes(entityType)) c.add('entity_type', 'INVALID', 'must be vehicle, property, person or household');
    let entityId = input.entity_id === '' || input.entity_id === undefined ? null : input.entity_id;
    if (entityType === 'household') {
      entityId = null;
    } else if (Model.ENTITY_TYPES.includes(entityType)) {
      const entity = known.entities.find((e) => e.entity_id === entityId && !e.deleted);
      if (!entityId) c.add('entity_id', 'REQUIRED', `choose which ${Model.ENTITY_LABELS[entityType].toLowerCase()} this is for`);
      else if (!entity) c.add('entity_id', 'NOT_FOUND', 'is not a known vehicle, home or person');
      else if (entity.entity_type !== entityType) c.add('entity_id', 'INVALID', `is not a ${Model.ENTITY_LABELS[entityType].toLowerCase()}`);
    }

    const dueDate = c.date('due_date', input.due_date);
    if (!dueDate && !c.errors.some((e) => e.field === 'due_date')) c.add('due_date', 'REQUIRED', 'is required');
    const lead = c.int('lead_time_days', input.lead_time_days, 0, MAX_LEAD_DAYS);
    if (lead === null && !c.errors.some((e) => e.field === 'lead_time_days')) c.add('lead_time_days', 'REQUIRED', 'is required');

    const unit = /** @type {RecurrenceUnit} */ (input.recurrence_unit);
    if (!Model.RECURRENCE_UNITS.includes(unit)) c.add('recurrence_unit', 'INVALID', 'must be none, month or year');
    let every = unit === 'none' ? null : c.int('recurrence_every', input.recurrence_every, 1, MAX_EVERY);
    if (unit !== 'none' && every === null && !c.errors.some((e) => e.field === 'recurrence_every')) c.add('recurrence_every', 'REQUIRED', 'is required');
    const rollFrom = /** @type {RollFrom} */ (input.roll_from ?? 'due');
    if (!Model.ROLL_FROM.includes(rollFrom)) c.add('roll_from', 'INVALID', 'must be due or done');

    const owners = Array.isArray(input.owners) ? [...new Set(input.owners.map(String))] : [];
    if (input.owners !== undefined && !Array.isArray(input.owners)) c.add('owners', 'INVALID', 'must be a list');
    owners.filter((o) => !known.users.includes(o)).forEach((o) => c.add('owners', 'INVALID', `${o} is not an app user`));

    const cost = c.int('cost_pence', input.cost_pence, 0, MAX_PENCE);

    /** @type {Attachment[]} */
    const attachments = [];
    if (input.attachments !== undefined && input.attachments !== null) {
      if (!Array.isArray(input.attachments) || input.attachments.length > MAX_ATTACHMENTS) {
        c.add('attachments', 'INVALID', `must be a list of at most ${MAX_ATTACHMENTS}`);
      } else {
        input.attachments.forEach((a, i) => {
          const label = c.text(`attachments.${i}.label`, a?.label, LIMITS.label);
          const location = c.text(`attachments.${i}.location`, a?.location, LIMITS.location);
          if (!label && location) c.add(`attachments.${i}.label`, 'REQUIRED', 'is required');
          if (label) attachments.push({ label, location });
        });
      }
    }

    const value = {
      title: title ?? '',
      category: category ?? 'other',
      template_id: templateId,
      entity_type: entityType,
      entity_id: /** @type {string|null} */ (entityId),
      due_date: dueDate ?? '',
      lead_time_days: lead ?? 0,
      recurrence_unit: unit,
      recurrence_every: every,
      roll_from: rollFrom,
      owners,
      provider: c.text('provider', input.provider, LIMITS.provider),
      reference: c.text('reference', input.reference, LIMITS.reference),
      cost_pence: cost,
      notes: c.text('notes', input.notes, LIMITS.notes),
      attachments,
      archived: input.archived === true,
    };
    return { value, errors: c.errors };
  }

  /**
   * A vehicle, home or person.
   * @param {Record<string, unknown>} input
   */
  function entity(input) {
    const c = collector();
    const type = /** @type {Entity['entity_type']} */ (input.entity_type);
    if (!['vehicle', 'property', 'person'].includes(type)) c.add('entity_type', 'INVALID', 'must be vehicle, property or person');
    let reg = c.text('reg', input.reg, 10);
    if (reg) reg = reg.toUpperCase().replace(/\s+/g, '');
    if (type === 'vehicle') {
      if (!reg) c.add('reg', 'REQUIRED', 'is required');
      else if (!/^[A-Z0-9]{2,8}$/.test(reg)) c.add('reg', 'INVALID', 'must be letters and numbers, e.g. AB12CDE');
    }
    let name = c.text('name', input.name, LIMITS.name);
    if (!name && type === 'vehicle' && reg) name = reg;
    if (!name) c.add('name', 'REQUIRED', 'is required');
    const value = {
      entity_type: type,
      name: name ?? '',
      reg: type === 'vehicle' ? reg : null,
      make: type === 'vehicle' ? c.text('make', input.make, LIMITS.name) : null,
      model: type === 'vehicle' ? c.text('model', input.model, LIMITS.name) : null,
      address: type === 'property' ? c.text('address', input.address, LIMITS.address) : null,
      is_rental: type === 'property' && input.is_rental === true,
    };
    return { value, errors: c.errors };
  }

  /**
   * "Mark as renewed" for an item.
   * @param {Record<string, unknown>} input
   * @param {Item} current
   */
  function renewal(input, current) {
    const c = collector();
    const renewedOn = c.date('renewed_on', input.renewed_on);
    if (!renewedOn && !c.errors.some((e) => e.field === 'renewed_on')) c.add('renewed_on', 'REQUIRED', 'is required');
    const newDue = c.date('new_due_date', input.new_due_date);
    const recurring = current.recurrence_unit !== 'none';
    if (!newDue && recurring && !c.errors.some((e) => e.field === 'new_due_date')) c.add('new_due_date', 'REQUIRED', 'is required');
    if (newDue && newDue <= current.due_date) c.add('new_due_date', 'INVALID', `must be after the current due date (${Dates.formatUk(current.due_date)})`);

    /** @type {Quote[]} */
    const quotes = [];
    if (input.quotes !== undefined && input.quotes !== null) {
      if (!Array.isArray(input.quotes) || input.quotes.length > MAX_QUOTES) {
        c.add('quotes', 'INVALID', `must be a list of at most ${MAX_QUOTES}`);
      } else {
        input.quotes.forEach((q, i) => {
          const provider = c.text(`quotes.${i}.provider`, q?.provider, LIMITS.provider);
          const cost = c.int(`quotes.${i}.cost_pence`, q?.cost_pence, 0, MAX_PENCE);
          if (provider) quotes.push({ provider, cost_pence: cost });
        });
      }
    }
    /** @type {RenewalInput} */
    const value = {
      renewed_on: renewedOn ?? '',
      new_due_date: newDue,
      provider: c.text('provider', input.provider, LIMITS.provider),
      cost_pence: c.int('cost_pence', input.cost_pence, 0, MAX_PENCE),
      quotes,
      notes: c.text('notes', input.notes, LIMITS.notes),
    };
    return { value, errors: c.errors };
  }

  return { ITEM_INPUT, ENTITY_INPUT, isId, item, entity, renewal };
})();

export { Validation };
