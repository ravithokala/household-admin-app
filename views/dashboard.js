// @ts-check

import { el, today } from '../dom.js';
import { Renewals } from '../shared/renewals.js';
import { data, status, bulk } from '../store/store.js';
import { itemRow, empty } from './parts.js';
import { toast } from './sheet.js';

const WHO_KEY = 'ha.who';

/** 'mine' or 'all', remembered on this phone. */
function whoFilter() {
  try { return localStorage.getItem(WHO_KEY) === 'mine' ? 'mine' : 'all'; } catch (e) { return 'all'; }
}

/**
 * Home: only what needs attention, by act-by date. Everything overdue, and whatever must be
 * acted on in the next 60 days, grouped red / amber / green.
 * @param {HTMLElement} main
 * @param {() => void} redraw
 */
export function dashboard(main, redraw) {
  const who = whoFilter();
  const live = Object.values(data.items).filter((i) => !i.deleted
    && (who === 'all' || i.owners.length === 0 || i.owners.includes(status.user)));
  const groups = Renewals.attention(live, today());
  const total = groups.overdue.length + groups.actSoon.length + groups.sorted.length;

  const counter = (/** @type {string} */ cls, /** @type {number} */ n, /** @type {string} */ label) =>
    el('div', { class: `counter ${n ? cls : 'zero'}` }, el('span', { class: 'counter-number' }, String(n)), el('span', { class: 'counter-label' }, label));

  /** @param {string} title @param {string} hint @param {Item[]} items @param {string} cls */
  const section = (title, hint, items, cls) => items.length === 0 ? '' : el('section', { class: `group ${cls}` },
    el('h2', {}, title, el('span', { class: 'count' }, String(items.length))),
    el('p', { class: 'hint' }, hint),
    el('ul', { class: 'rows' }, items.map(itemRow)));

  const setWho = (/** @type {string} */ value) => () => {
    try { localStorage.setItem(WHO_KEY, value); } catch (e) { /* not remembered */ }
    redraw();
  };

  const noItems = Object.values(data.items).every((i) => i.deleted);
  main.replaceChildren(
    el('div', { class: 'toolbar' },
      el('h1', { class: 'screen-title' }, 'Needs attention'),
      status.users.length > 1 ? el('div', { class: 'segmented', role: 'group', 'aria-label': 'Whose items' },
        el('button', { type: 'button', 'aria-pressed': String(who === 'mine'), onclick: setWho('mine') }, 'Mine'),
        el('button', { type: 'button', 'aria-pressed': String(who === 'all'), onclick: setWho('all') }, 'Everyone')) : ''),
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
      el('p', {}, 'Tap + to add a renewal from a template, or load some sample items to try the app. Sample items can be cleared in one go from More.'),
      el('button', { class: 'button', type: 'button', onclick: async (/** @type {Event} */ ev) => {
        const button = /** @type {HTMLButtonElement} */ (ev.currentTarget);
        button.disabled = true;
        try {
          const r = await bulk('sample.load');
          toast(r.ok ? 'Sample items loaded.' : r.errors.map((e) => e.message).join(' '));
        } catch (e) {
          toast('Loading sample items needs a connection.');
        } finally {
          button.disabled = false;
        }
      } }, 'Load sample items')) : '');
}
