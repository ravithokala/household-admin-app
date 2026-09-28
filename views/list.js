// @ts-check

import { el } from '../dom.js';
import { Templates } from '../shared/templates.js';
import { Model } from '../shared/model.js';
import { data } from '../store/store.js';
import { filterItems } from '../store/changes.js';
import { itemRow, empty } from './parts.js';

/** Filters survive switching tabs (not reloads). */
const filters = { query: '', category: '', entity: '', done: false };

/**
 * All: every item, soonest act-by first, with search and filters by category and by what it
 * belongs to.
 * @param {HTMLElement} main
 */
export function list(main) {
  const results = el('ul', { class: 'rows' });
  const summary = el('p', { class: 'hint' });
  const draw = () => {
    const items = filterItems(data, { query: filters.query, category: filters.category || undefined, entity: filters.entity || undefined, done: filters.done });
    results.replaceChildren(...items.map(itemRow));
    summary.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
    if (!items.length) results.replaceChildren(el('li', {}, empty(Object.keys(data.items).length ? 'No items match.' : 'No items yet. Tap + to add one.')));
  };

  const search = /** @type {HTMLInputElement} */ (el('input', { type: 'search', class: 'search-input', placeholder: 'Search title, provider, reference…', 'aria-label': 'Search', value: filters.query }));
  search.addEventListener('input', () => { filters.query = search.value; draw(); });

  const category = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Category' },
    el('option', { value: '' }, 'All categories'),
    Templates.CATEGORIES.map((c) => el('option', { value: c.id, selected: c.id === filters.category }, c.label))));
  category.addEventListener('change', () => { filters.category = category.value; draw(); });

  const entities = Object.values(data.entities).filter((e) => !e.deleted).sort((a, b) => a.entity_type.localeCompare(b.entity_type) || a.name.localeCompare(b.name));
  const entity = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Belongs to' },
    el('option', { value: '' }, 'Everything'),
    el('option', { value: 'household', selected: filters.entity === 'household' }, 'Household'),
    ['vehicle', 'property', 'person'].map((type) => {
      const of = entities.filter((e) => e.entity_type === type);
      return of.length ? el('optgroup', { label: `${Model.ENTITY_LABELS[/** @type {EntityType} */ (type)]}s` },
        of.map((e) => el('option', { value: e.entity_id, selected: e.entity_id === filters.entity }, e.name))) : '';
    })));
  entity.addEventListener('change', () => { filters.entity = entity.value; draw(); });

  const done = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: filters.done }));
  done.addEventListener('change', () => { filters.done = done.checked; draw(); });

  main.replaceChildren(
    el('h1', { class: 'screen-title' }, 'All items'),
    search,
    el('div', { class: 'filters' }, category, entity),
    el('div', { class: 'toolbar' }, summary, el('label', { class: 'check small' }, done, el('span', {}, 'Show done one-offs'))),
    results);
  draw();
}
