// @ts-check

import { el, today } from '../dom.js';
import { Renewals } from '../shared/renewals.js';
import { data } from '../store/store.js';
import { itemRow, empty } from './parts.js';

/**
 * Home: only what needs attention, by act-by date. Everything overdue, and whatever must be
 * acted on in the next 60 days, grouped red / amber / green. Everyone's items (RT, 2026-09-28).
 * @param {HTMLElement} main
 */
export function dashboard(main) {
  const live = Object.values(data.items).filter((i) => !i.deleted);
  const groups = Renewals.attention(live, today());
  const total = groups.overdue.length + groups.actSoon.length + groups.sorted.length;

  const counter = (/** @type {string} */ cls, /** @type {number} */ n, /** @type {string} */ label) =>
    el('div', { class: `counter ${n ? cls : 'zero'}` }, el('span', { class: 'counter-number' }, String(n)), el('span', { class: 'counter-label' }, label));

  /** @param {string} title @param {string} hint @param {Item[]} items @param {string} cls */
  const section = (title, hint, items, cls) => items.length === 0 ? '' : el('section', { class: `group ${cls}` },
    el('h2', {}, title, el('span', { class: 'count' }, String(items.length))),
    el('p', { class: 'hint' }, hint),
    el('ul', { class: 'rows' }, items.map(itemRow)));

  const noItems = Object.values(data.items).every((i) => i.deleted);
  main.replaceChildren(
    el('h1', { class: 'screen-title' }, 'Needs attention'),
    el('div', { class: 'counters' },
      counter('bad', groups.overdue.length, 'Overdue'),
      counter('soon', groups.actSoon.length, 'Act soon'),
      counter('ok', groups.sorted.length, 'Coming up')),
    section('Overdue', 'The act-by date has passed. Deal with these first.', groups.overdue, 'bad'),
    section('Act soon', `Act-by date within ${Renewals.SOON_DAYS} days.`, groups.actSoon, 'soon'),
    section('Coming up', `Sorted for now; act-by date within ${Renewals.HORIZON_DAYS} days.`, groups.sorted, 'ok'),
    total === 0 && !noItems ? empty(`Nothing needs attention in the next ${Renewals.HORIZON_DAYS} days.`) : '',
    noItems ? el('div', { class: 'card welcome' },
      el('h2', {}, 'Nothing tracked yet'),
      el('p', {}, 'Tap + to add your first renewal. Templates fill in the lead time and how often it repeats.')) : '');
}
