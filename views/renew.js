// @ts-check

import { el, today, uk } from '../dom.js';
import { Renewals } from '../shared/renewals.js';
import { Model } from '../shared/model.js';
import { renewItem } from '../store/store.js';
import { openSheet, toast } from './sheet.js';
import { field, input, textarea, money, saveButton, showErrors } from './fields.js';

/**
 * Mark as renewed: the new due date (suggested from the recurrence), provider, cost and any
 * quotes compared. The old details go into the history; the item rolls forward.
 * @param {Item} item
 */
export function renewSheet(item) {
  const oneOff = item.recurrence_unit === 'none';
  const renewedOn = input('date', today(), { max: today() });
  const newDue = input('date', Renewals.suggestNextDue(item, today()));
  const suggestion = el('p', { class: 'muted small' });
  const suggest = () => {
    const on = renewedOn.get();
    const next = on ? Renewals.suggestNextDue(item, on) : null;
    suggestion.textContent = oneOff
      ? 'A one-off: leave the new due date blank to mark it done, or enter one to keep tracking it.'
      : next ? `Suggested from ${item.roll_from === 'done' ? 'the renewal date' : `the old due date (${uk(item.due_date)})`}: ${uk(next)}. Change it to match the new certificate or policy.` : '';
  };
  // Changing the renewal date moves the suggestion only while the due date has not been edited.
  let edited = false;
  newDue.node.addEventListener('input', () => { edited = true; });
  renewedOn.node.addEventListener('input', () => {
    suggest();
    const on = renewedOn.get();
    if (!edited && on) newDue.node.value = Renewals.suggestNextDue(item, on) ?? '';
  });
  suggest();

  const provider = input('text', item.provider, { maxlength: 120 });
  const cost = money(null);
  const notes = textarea(null, { maxlength: 2000, rows: 2 });

  const quoteRows = el('div', { class: 'quotes-edit' });
  /** @type {Array<{ provider: { get: () => string|null }, cost: { get: () => unknown } }>} */
  const quotes = [];
  const addQuote = () => {
    const p = input('text', null, { placeholder: 'Provider', maxlength: 120, 'aria-label': 'Quote provider' });
    const c = money(null);
    c.node.setAttribute('aria-label', 'Quote price');
    quotes.push({ provider: p, cost: c });
    quoteRows.append(el('div', { class: 'row2' }, p.node, c.node));
  };

  const messages = el('div', { class: 'messages' });
  const save = saveButton(oneOff ? 'Save' : 'Mark as renewed', async () => {
    const r = await renewItem(item.item_id, {
      renewed_on: renewedOn.get(), new_due_date: newDue.get(), provider: provider.get(), cost_pence: cost.get(), notes: notes.get(),
      quotes: quotes.map((q) => ({ provider: q.provider.get(), cost_pence: q.cost.get() })).filter((q) => q.provider),
    });
    if (!r.ok) { showErrors(messages, r.errors); return; }
    sheet.close();
    const next = newDue.get();
    toast(next ? `${item.title} renewed: next due ${uk(next)}.` : `${item.title} marked done.`);
  });

  const sheet = openSheet(`Renew ${item.title}`, el('div', { class: 'form' },
    el('p', { class: 'muted' }, `Currently due ${uk(item.due_date)}${item.cost_pence !== null ? `, last cost ${Model.money(item.cost_pence)}` : ''}.`),
    el('div', { class: 'row2' }, field('Renewed on', renewedOn.node), field(oneOff ? 'New due date (optional)' : 'New due date', newDue.node)),
    suggestion,
    el('div', { class: 'row2' }, field('Provider', provider.node), field('Cost this time', cost.node)),
    el('details', { class: 'more-fields' },
      el('summary', {}, 'Quotes compared (optional)'),
      quoteRows,
      el('button', { type: 'button', class: 'link', onclick: addQuote }, '+ Add a quote')),
    field('Notes', notes.node),
    messages,
    el('div', { class: 'actions' }, save)));
  addQuote();
}
