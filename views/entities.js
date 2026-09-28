// @ts-check

import { el } from '../dom.js';
import { Model } from '../shared/model.js';
import { data, saveEntity, removeEntity } from '../store/store.js';
import { openSheet, toast } from './sheet.js';
import { field, input, checkbox, saveButton, showErrors } from './fields.js';
import { empty } from './parts.js';

/** @type {ReadonlyArray<Entity['entity_type']>} */
const TYPES = ['vehicle', 'property', 'person'];

/**
 * Vehicles, homes and people that items belong to.
 * @param {HTMLElement} main
 */
export function entitiesScreen(main) {
  const live = Object.values(data.entities).filter((e) => !e.deleted);
  const count = (/** @type {string} */ id) => Object.values(data.items).filter((i) => i.entity_id === id && !i.deleted).length;
  main.replaceChildren(
    el('a', { class: 'back', href: '#/more' }, '‹ More'),
    el('h1', { class: 'screen-title' }, 'Vehicles, homes and people'),
    ...TYPES.map((type) => {
      const of = live.filter((e) => e.entity_type === type).sort((a, b) => a.name.localeCompare(b.name));
      const label = Model.ENTITY_LABELS[type];
      return el('section', { class: 'card' },
        el('div', { class: 'section-head' }, el('h2', {}, `${label}s`),
          el('button', { class: 'link', type: 'button', onclick: () => entitySheet(null, type) }, `+ Add`)),
        of.length === 0 ? empty(`No ${label.toLowerCase()}s yet.`) : el('ul', { class: 'rows' }, of.map((e) => el('li', {},
          el('button', { class: 'row', type: 'button', onclick: () => entitySheet(e, type) },
            el('div', { class: 'row-main' },
              el('div', { class: 'row-title' }, e.name),
              el('div', { class: 'row-sub' }, [e.reg, [e.make, e.model].filter(Boolean).join(' '), e.address, e.is_rental ? 'Rental' : '',
                e.calendar_code ? `Calendar: ${e.calendar_code}` : ''].filter(Boolean).join(' · ')),
              el('div', { class: 'row-when' }, `${count(e.entity_id)} item(s)`)))))));
    }));
}

/**
 * Adds or edits a vehicle, home or person.
 * @param {Entity|null} entity
 * @param {Entity['entity_type']} type
 * @param {(e: Entity) => void} [onSaved]
 */
export function entitySheet(entity, type, onSaved) {
  const name = input('text', entity?.name ?? null, { maxlength: 80, placeholder: type === 'vehicle' ? 'e.g. Family car (optional)' : '' });
  const code = input('text', entity?.calendar_code ?? null, { maxlength: 4, autocapitalize: 'characters', autocomplete: 'off', placeholder: 'e.g. C' });
  const reg = input('text', entity?.reg ?? null, { maxlength: 10, autocapitalize: 'characters', autocomplete: 'off' });
  const make = input('text', entity?.make ?? null, { maxlength: 80 });
  const model = input('text', entity?.model ?? null, { maxlength: 80 });
  const address = input('text', entity?.address ?? null, { maxlength: 300 });
  const rental = checkbox(entity?.is_rental ?? false, 'This is a rental property');
  const messages = el('div', { class: 'messages' });
  const label = Model.ENTITY_LABELS[type].toLowerCase();
  // Fixed when the form opens: tapping Add again after a lost answer resends the same one.
  const newId = crypto.randomUUID();

  const save = saveButton(entity ? 'Save' : 'Add', async () => {
    const id = entity?.entity_id ?? newId;
    const r = await saveEntity(id, { entity_type: type, name: name.get(), reg: reg.get(), make: make.get(), model: model.get(), address: address.get(), is_rental: rental.get(), calendar_code: code.get() });
    if (!r.ok) { showErrors(messages, r.errors); return; }
    sheet.close();
    toast(entity ? 'Saved.' : `Added ${r.rows.entities[0].name}.`);
    onSaved?.(r.rows.entities[0]);
  });
  const remove = entity ? el('button', { class: 'danger', type: 'button', onclick: async () => {
    const r = await removeEntity(entity.entity_id);
    if (!r.ok) { showErrors(messages, r.errors); return; }
    sheet.close();
    toast(`Removed ${entity.name}.`);
  } }, 'Remove') : '';

  const sheet = openSheet(entity ? `Edit ${entity.name}` : `Add a ${label}`, el('div', { class: 'form' },
    type === 'vehicle' ? [field('Registration', reg.node), field('Name', name.node), el('div', { class: 'row2' }, field('Make', make.node), field('Model', model.node))] : '',
    type === 'property' ? [field('Name', name.node), field('Address', address.node), rental.node] : '',
    type === 'person' ? [field('Name', name.node), field('Code in the family calendar (optional)', code.node),
      el('p', { class: 'muted small' }, 'The letter the family calendar uses for this person, e.g. C. Their items shown on the calendar are marked with it.')] : '',
    messages,
    el('div', { class: 'actions' }, remove, save)));
}
