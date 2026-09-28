// @ts-check

import { el, today, uk } from '../dom.js';
import { Templates } from '../shared/templates.js';
import { Model } from '../shared/model.js';
import { Dates } from '../shared/dates.js';
import { Renewals } from '../shared/renewals.js';
import { data, saveItem } from '../store/store.js';
import { openSheet, toast } from './sheet.js';
import { field, input, select, textarea, money, saveButton, showErrors } from './fields.js';
import { entitySheet } from './entities.js';

/**
 * The + button: pick a template (or a blank item), then the form, pre-filled so usually only the
 * due date and what it belongs to are left.
 */
export function templatePicker() {
  const body = el('div', { class: 'picker' },
    Templates.CATEGORIES.map((c) => {
      const of = Templates.ALL.filter((t) => t.category === c.id);
      return of.length ? el('section', {}, el('h3', {}, c.label),
        el('div', { class: 'choices' }, of.map((t) => el('button', { type: 'button', class: 'choice', onclick: () => { sheet.close(); itemSheet(null, t); } },
          el('span', { class: 'choice-title' }, t.title),
          el('span', { class: 'choice-sub' }, `${Model.recurrenceLabel(t.recurrence_unit, t.recurrence_every)} · act ${t.lead_time_days} days ahead`))))) : '';
    }),
    el('section', {}, el('h3', {}, 'Something else'),
      el('div', { class: 'choices' }, el('button', { type: 'button', class: 'choice', onclick: () => { sheet.close(); itemSheet(null, null); } },
        el('span', { class: 'choice-title' }, 'Custom item'), el('span', { class: 'choice-sub' }, 'Start from a blank form')))),
    el('p', { class: 'muted small' }, 'Template lead times are defaults. Check current rules and your provider\'s terms.'));
  const sheet = openSheet('Add an item', body);
}

/**
 * Adds (item null) or edits an item.
 * @param {Item|null} item
 * @param {Template|null} [template]
 */
export function itemSheet(item, template = null) {
  const start = item ?? {
    ...Model.blankItem(),
    ...(template ? {
      title: template.title, category: template.category, template_id: template.id, entity_type: template.entity_type,
      lead_time_days: template.lead_time_days, recurrence_unit: template.recurrence_unit, recurrence_every: template.recurrence_every,
      roll_from: template.roll_from, due_date: template.fixed_date ? Dates.nextYearly(template.fixed_date, today()) : '',
    } : {}),
  };
  const hint = Templates.get(start.template_id)?.hint;

  const title = input('text', start.title, { maxlength: 120, autocomplete: 'off' });
  const category = select(start.category, Templates.CATEGORIES.map((c) => [c.id, c.label]));
  const entityType = select(start.entity_type, Model.ENTITY_TYPES.map((t) => [t, Model.ENTITY_LABELS[t]]));
  const entityChoice = el('div', { class: 'entity-choice' });
  /** @type {{ get: () => string|null }} */
  let entityId = { get: () => null };
  const drawEntities = (/** @type {string|null} */ chosen) => {
    const type = entityType.get();
    if (type === 'household' || !type) { entityChoice.replaceChildren(); entityId = { get: () => null }; return; }
    const of = Object.values(data.entities).filter((e) => !e.deleted && e.entity_type === type).sort((a, b) => a.name.localeCompare(b.name));
    const label = Model.ENTITY_LABELS[/** @type {EntityType} */ (type)].toLowerCase();
    const pick = select(chosen ?? (of.length === 1 ? of[0].entity_id : ''), [['', `Choose a ${label}…`], ...of.map((e) => /** @type {[string, string]} */ ([e.entity_id, e.reg && e.reg !== e.name ? `${e.name} (${e.reg})` : e.name]))]);
    entityId = pick;
    entityChoice.replaceChildren(field(type === 'property' ? 'Which home' : `Which ${label}`, pick.node),
      el('button', { type: 'button', class: 'link', onclick: () => entitySheet(null, /** @type {Entity['entity_type']} */ (type), (created) => drawEntities(created.entity_id)) }, `+ Add a ${label}`));
  };
  entityType.node.addEventListener('change', () => drawEntities(null));
  drawEntities(start.entity_id);

  const due = input('date', start.due_date || null, { required: true });
  const lead = input('number', String(start.lead_time_days), { min: 0, max: 730, inputmode: 'numeric' });
  const actBy = el('p', { class: 'act-by' });
  const showActBy = () => {
    const d = due.get();
    const n = Number(lead.get());
    actBy.textContent = d && Dates.isValid(d) && Number.isInteger(n) && n >= 0
      ? `Act by ${uk(Renewals.actByDate(d, n))} (${n} days before the due date ${uk(d)})`
      : 'Enter the due date to see the act-by date.';
  };
  due.node.addEventListener('input', showActBy);
  lead.node.addEventListener('input', showActBy);
  showActBy();

  const unit = select(start.recurrence_unit, [['year', 'Years'], ['month', 'Months'], ['none', 'One-off (does not repeat)']]);
  const every = input('number', start.recurrence_every === null ? '1' : String(start.recurrence_every), { min: 1, max: 50, inputmode: 'numeric' });
  const everyField = field('Every', every.node);
  const showEvery = () => { everyField.hidden = unit.get() === 'none'; };
  unit.node.addEventListener('change', showEvery);
  showEvery();
  const rollFrom = select(start.roll_from, [['due', 'The old due date (keeps the anniversary)'], ['done', 'The day it was done']]);

  const provider = input('text', start.provider, { maxlength: 120 });
  const reference = input('text', start.reference, { maxlength: 80, autocomplete: 'off' });
  const cost = money(start.cost_pence);
  const notes = textarea(start.notes, { maxlength: 2000 });

  // Where documents are kept: text references only, never the files (ADR-008).
  const refs = el('div', { class: 'refs' });
  /** @type {Array<{ label: { get: () => string|null }, location: { get: () => string|null } }>} */
  const refFields = [];
  const addRef = (/** @type {Attachment|null} */ a) => {
    const label = input('text', a?.label ?? null, { placeholder: 'e.g. Policy schedule', maxlength: 80, 'aria-label': 'Document' });
    const where = input('text', a?.location ?? null, { placeholder: 'Where it is, e.g. Drive › Home › 2026', maxlength: 300, 'aria-label': 'Where it is kept' });
    refFields.push({ label, location: where });
    refs.append(el('div', { class: 'row2' }, label.node, where.node));
  };
  start.attachments.forEach(addRef);

  const messages = el('div', { class: 'messages' });
  const save = saveButton(item ? 'Save' : 'Add', async () => {
    const id = item?.item_id ?? crypto.randomUUID();
    const r = await saveItem(id, {
      title: title.get(), category: category.get(), template_id: start.template_id, entity_type: entityType.get(), entity_id: entityId.get(),
      due_date: due.get(), lead_time_days: lead.get(), recurrence_unit: unit.get(), recurrence_every: every.get(), roll_from: rollFrom.get(),
      provider: provider.get(), reference: reference.get(), cost_pence: cost.get(), notes: notes.get(),
      attachments: refFields.map((f) => ({ label: f.label.get(), location: f.location.get() })).filter((a) => a.label || a.location),
      archived: start.archived,
    });
    if (!r.ok) { showErrors(messages, r.errors); return; }
    sheet.close();
    toast(item ? 'Saved.' : `Added ${title.get()}.`);
    if (!item) window.location.hash = `#/item/${id}`;
  });

  const form = el('div', { class: 'form' },
    hint ? el('p', { class: 'hint-box' }, hint) : '',
    field('Title', title.node),
    el('div', { class: 'row2' }, field('Category', category.node), field('Belongs to', entityType.node)),
    entityChoice,
    el('div', { class: 'row2' }, field('Due / expiry date', due.node), field('Lead time (days)', lead.node)),
    actBy,
    el('div', { class: 'row2' }, field('Repeats', unit.node), everyField),
    field('Next due date counts from', rollFrom.node),
    el('details', { class: 'more-fields', open: Boolean(start.provider || start.reference || start.cost_pence !== null || start.notes || start.attachments.length) },
      el('summary', {}, 'Provider, reference, cost and notes'),
      field('Provider', provider.node),
      el('div', { class: 'row2' }, field('Reference / policy number', reference.node), field('Cost', cost.node)),
      field('Notes', notes.node),
      el('div', { class: 'field' }, el('span', {}, 'Where documents are kept'), refs,
        el('button', { type: 'button', class: 'link', onclick: () => addRef(null) }, '+ Add a document reference')),
      el('p', { class: 'muted small' }, 'Keep bank or card details and document scans out of this app: references and notes only.')),
    messages,
    el('div', { class: 'actions' }, save));
  const sheet = openSheet(item ? `Edit ${item.title}` : 'New item', form);
  if (!item && !template) title.node.focus();
}
