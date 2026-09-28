// @ts-check

import { el, uk, relative, today } from '../dom.js';
import { Renewals } from '../shared/renewals.js';
import { Model } from '../shared/model.js';
import { data } from '../store/store.js';

/** What each status says. Colour is never the only signal: every pill has words. */
export const STATUS_LABEL = Object.freeze({ overdue: 'Overdue', actSoon: 'Act soon', sorted: 'Sorted', done: 'Done' });
const STATUS_CLASS = Object.freeze({ overdue: 'bad', actSoon: 'soon', sorted: 'ok', done: 'muted-pill' });

/**
 * @param {Status} status
 * @param {boolean} [expired]
 */
export const statusPill = (status, expired = false) => el('span', { class: `pill ${STATUS_CLASS[status]}` }, expired ? 'Expired' : STATUS_LABEL[status]);

/** What an item belongs to, e.g. 'Family car · AB12CDE', 'Household'. @param {Item} item */
export function belongsTo(item) {
  if (item.entity_type === 'household' || !item.entity_id) return 'Household';
  const e = data.entities[item.entity_id];
  if (!e) return Model.ENTITY_LABELS[item.entity_type];
  return e.entity_type === 'vehicle' && e.reg && e.reg !== e.name ? `${e.name} · ${e.reg}` : e.name;
}

/**
 * One item in a list: title, what it is for, the act-by date, and its status.
 * @param {Item} item
 */
export function itemRow(item) {
  const d = Renewals.describe(item, today());
  const when = item.archived
    ? `Done · was due ${uk(item.due_date)}`
    : d.days_to_act < 0
      ? `Act-by was ${uk(d.act_by)} (${relative(d.days_to_act)}) · due ${uk(item.due_date)}`
      : `Act by ${uk(d.act_by)} (${relative(d.days_to_act)}) · due ${uk(item.due_date)}`;
  return el('li', {},
    el('a', { class: `row status-${d.status}`, href: `#/item/${item.item_id}` },
      el('div', { class: 'row-main' },
        el('div', { class: 'row-title' }, item.title, item.is_sample ? el('span', { class: 'tag' }, 'Sample') : ''),
        el('div', { class: 'row-sub' }, belongsTo(item)),
        el('div', { class: 'row-when' }, when)),
      statusPill(d.status, d.expired)));
}

/** @param {string} text */
export const empty = (text) => el('p', { class: 'empty muted' }, text);
