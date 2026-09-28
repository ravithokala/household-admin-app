// @ts-check

import { el, uk, relative, today } from '../dom.js';
import { Renewals } from '../shared/renewals.js';
import { Model } from '../shared/model.js';
import { Templates } from '../shared/templates.js';
import { data, setItemDeleted } from '../store/store.js';
import { statusPill, belongsTo, empty } from './parts.js';
import { toast } from './sheet.js';
import { itemSheet } from './itemForm.js';
import { renewSheet } from './renew.js';
import { costChart } from './chart.js';

/**
 * One item: its dates and status, details, renewal history and cost trend.
 * @param {HTMLElement} main
 * @param {string} id
 */
export function itemDetail(main, id) {
  const item = data.items[id];
  if (!item || item.deleted) {
    main.replaceChildren(el('a', { class: 'back', href: '#/all' }, '‹ All items'), empty('This item has been deleted or is not on this phone yet.'));
    return;
  }
  const d = Renewals.describe(item, today());
  const history = Object.values(data.history).filter((h) => h.item_id === id).sort((a, b) => (a.renewed_on < b.renewed_on ? 1 : -1));
  /** @param {string} term @param {unknown} value */
  const fact = (term, value) => (value === null || value === undefined || value === '' ? '' : [el('dt', {}, term), el('dd', {}, value)]);

  const remove = async () => {
    const r = await setItemDeleted(id, true);
    if (!r.ok) { toast(r.errors.map((e) => e.message).join(' ')); return; }
    window.location.hash = '#/all';
    toast(`Deleted ${item.title}.`, [], () => { setItemDeleted(id, false); });
  };

  main.replaceChildren(
    el('a', { class: 'back', href: '#/all' }, '‹ All items'),
    el('div', { class: `card detail status-${d.status}` },
      el('div', { class: 'detail-head' },
        el('div', {}, el('h1', { class: 'screen-title' }, item.title), el('p', { class: 'row-sub' }, belongsTo(item), ' · ', Templates.categoryLabel(item.category))),
        statusPill(d.status, d.expired)),
      el('div', { class: 'dates' },
        el('div', { class: 'date-box primary-date' }, el('span', { class: 'date-label' }, 'Act by'), el('span', { class: 'date-value' }, uk(d.act_by)),
          el('span', { class: 'date-rel' }, item.archived ? 'done' : relative(d.days_to_act))),
        el('div', { class: 'date-box' }, el('span', { class: 'date-label' }, 'Due / expires'), el('span', { class: 'date-value' }, uk(item.due_date)),
          el('span', { class: 'date-rel' }, relative(d.days_to_due)))),
      el('dl', { class: 'facts' },
        fact('Repeats', Model.recurrenceLabel(item.recurrence_unit, item.recurrence_every)),
        fact('Lead time', `${item.lead_time_days} days`),
        fact('Next date from', item.recurrence_unit === 'none' ? null : item.roll_from === 'done' ? 'the day it is done' : 'the old due date'),
        fact('Provider', item.provider),
        fact('Reference', item.reference),
        fact('Cost', Model.money(item.cost_pence)),
        fact('Notes', item.notes),
        item.attachments.length ? [el('dt', {}, 'Documents'), el('dd', {}, el('ul', { class: 'plain' }, item.attachments.map((a) => el('li', {}, a.label, a.location ? el('span', { class: 'muted' }, ` — ${a.location}`) : ''))))] : '',
        fact('Last changed', item.updated_at ? `${uk(item.updated_at.slice(0, 10))}${item.updated_by ? ` by ${item.updated_by}` : ''}` : null)),
      el('div', { class: 'actions' },
        item.archived ? '' : el('button', { class: 'primary', type: 'button', onclick: () => renewSheet(item) }, item.recurrence_unit === 'none' ? 'Renew or mark done' : 'Mark as renewed'),
        el('button', { class: 'secondary', type: 'button', onclick: () => itemSheet(item) }, 'Edit'))),
    el('section', { class: 'card' },
      el('h2', {}, 'Cost trend'),
      costChart(Renewals.costTrend(item, history))),
    el('section', { class: 'card' },
      el('h2', {}, 'Renewal history'),
      history.length === 0 ? empty('No renewals recorded yet.') : el('ul', { class: 'history' }, history.map((h) => el('li', {},
        el('div', { class: 'history-top' }, el('strong', {}, uk(h.renewed_on)), el('span', {}, Model.money(h.cost_pence))),
        el('div', { class: 'row-sub' }, [h.provider, `was due ${uk(h.previous_due_date)}`, h.new_due_date ? `renewed to ${uk(h.new_due_date)}` : 'marked done'].filter(Boolean).join(' · ')),
        h.quotes.length ? el('div', { class: 'quotes' }, 'Quotes: ', h.quotes.map((q) => `${q.provider}${q.cost_pence !== null ? ` ${Model.money(q.cost_pence)}` : ''}`).join(', ')) : '',
        h.notes ? el('div', { class: 'muted small' }, h.notes) : '')))),
    el('button', { class: 'danger-link', type: 'button', onclick: remove }, 'Delete this item'));
}
