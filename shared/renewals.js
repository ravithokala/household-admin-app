// @ts-check
// GENERATED from apps-script/domain/renewals.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.
import { Dates } from './dates.js';

/**
 * The app's core rules. The useful date is the ACT-BY date (due date minus lead time), not the
 * expiry: status, the dashboard and reminders all follow it.
 *
 *   overdue  (red)    the act-by date has passed ("Expired" too if the due date has passed)
 *   actSoon  (amber)  act-by is today or within SOON_DAYS
 *   sorted   (green)  act-by is further away
 *   done              a one-off that has been dealt with (archived)
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Renewals = (() => {
  /** Act-by within this many days turns amber. */
  const SOON_DAYS = 30;
  /** The dashboard shows items whose act-by date falls within this many days (and all overdue ones). */
  const HORIZON_DAYS = 60;

  /** @param {string} dueDate @param {number} leadTimeDays */
  const actByDate = (dueDate, leadTimeDays) => Dates.addDays(dueDate, -leadTimeDays);

  /**
   * @param {Pick<Item, 'due_date'|'lead_time_days'|'archived'>} item
   * @param {string} today
   * @returns {Status}
   */
  function status(item, today) {
    if (item.archived) return 'done';
    const actBy = actByDate(item.due_date, item.lead_time_days);
    if (today > actBy) return 'overdue';
    return Dates.daysBetween(today, actBy) <= SOON_DAYS ? 'actSoon' : 'sorted';
  }

  /**
   * Everything the screens show about an item's dates.
   * @param {Pick<Item, 'due_date'|'lead_time_days'|'archived'>} item
   * @param {string} today
   */
  function describe(item, today) {
    const actBy = actByDate(item.due_date, item.lead_time_days);
    return {
      act_by: actBy,
      status: status(item, today),
      expired: !item.archived && today > item.due_date,
      days_to_act: Dates.daysBetween(today, actBy),
      days_to_due: Dates.daysBetween(today, item.due_date),
    };
  }

  /**
   * The dashboard: live items whose act-by date is on or before today + horizon, grouped by
   * status, each group soonest act-by first.
   * @template {Item} T
   * @param {T[]} items
   * @param {string} today
   * @param {number} [horizon]
   */
  function attention(items, today, horizon = HORIZON_DAYS) {
    const limit = Dates.addDays(today, horizon);
    /** @type {{ overdue: T[], actSoon: T[], sorted: T[] }} */
    const groups = { overdue: [], actSoon: [], sorted: [] };
    for (const item of sortByActBy(items.filter((i) => !i.deleted && !i.archived))) {
      if (actByDate(item.due_date, item.lead_time_days) > limit) continue;
      const s = status(item, today);
      if (s !== 'done') groups[s].push(item);
    }
    return groups;
  }

  /**
   * Soonest act-by first; ties by title.
   * @template {Pick<Item, 'due_date'|'lead_time_days'|'title'>} T
   * @param {T[]} items
   */
  function sortByActBy(items) {
    return [...items].sort((a, b) => {
      const x = actByDate(a.due_date, a.lead_time_days);
      const y = actByDate(b.due_date, b.lead_time_days);
      return x < y ? -1 : x > y ? 1 : a.title.localeCompare(b.title);
    });
  }

  /**
   * Adds one recurrence period.
   * @param {string} iso @param {RecurrenceUnit} unit @param {number|null} every
   */
  function addPeriod(iso, unit, every) {
    if (unit === 'none' || !every) return null;
    return unit === 'year' ? Dates.addYears(iso, every) : Dates.addMonths(iso, every);
  }

  /**
   * The due date to suggest when an item is renewed; the user confirms or changes it. Null for a
   * one-off. From the old due date (roll_from 'due'), moved on whole periods until it is after the
   * renewal date, or from the renewal date itself (roll_from 'done').
   * @param {Pick<Item, 'due_date'|'recurrence_unit'|'recurrence_every'|'roll_from'>} item
   * @param {string} renewedOn
   * @returns {string|null}
   */
  function suggestNextDue(item, renewedOn) {
    if (item.recurrence_unit === 'none' || !item.recurrence_every) return null;
    if (item.roll_from === 'done') return addPeriod(renewedOn, item.recurrence_unit, item.recurrence_every);
    // Count periods from the original date, so month-end dates do not drift (31 Jan → 28 Feb → 31 Mar).
    for (let n = 1; n <= 1000; n += 1) {
      const next = /** @type {string} */ (addPeriod(item.due_date, item.recurrence_unit, item.recurrence_every * n));
      if (next > renewedOn) return next;
    }
    return null;
  }

  /**
   * Marks an item renewed: the renewal becomes a history entry, and the item rolls forward to the
   * new due date with the new provider and cost. A one-off with no new due date is marked done.
   * Pure: the caller has validated the input and saves both records.
   * @param {Item} item
   * @param {RenewalInput} renewal
   * @param {{ history_id: string, now: string, user: string }} meta
   * @returns {{ item: Item, history: HistoryEntry }}
   */
  function renew(item, renewal, meta) {
    const history = {
      history_id: meta.history_id,
      item_id: item.item_id,
      renewed_on: renewal.renewed_on,
      previous_due_date: item.due_date,
      new_due_date: renewal.new_due_date,
      provider: renewal.provider ?? item.provider,
      cost_pence: renewal.cost_pence,
      quotes: renewal.quotes,
      notes: renewal.notes,
      version: 1,
      updated_at: meta.now,
      updated_by: meta.user,
      is_sample: item.is_sample,
    };
    const rolled = {
      ...item,
      due_date: renewal.new_due_date ?? item.due_date,
      provider: renewal.provider ?? item.provider,
      cost_pence: renewal.cost_pence ?? item.cost_pence,
      archived: renewal.new_due_date === null,
      version: item.version + 1,
      updated_at: meta.now,
      updated_by: meta.user,
    };
    return { item: rolled, history };
  }

  /**
   * The cost of each renewal that recorded one, oldest first, for the cost-trend chart.
   * @param {Item} item
   * @param {HistoryEntry[]} history  this item's entries
   * @returns {Array<{ date: string, cost_pence: number }>}
   */
  function costTrend(item, history) {
    return history
      .filter((h) => h.item_id === item.item_id && h.cost_pence !== null)
      .sort((a, b) => (a.renewed_on < b.renewed_on ? -1 : a.renewed_on > b.renewed_on ? 1 : 0))
      .map((h) => ({ date: h.renewed_on, cost_pence: /** @type {number} */ (h.cost_pence) }));
  }

  return { SOON_DAYS, HORIZON_DAYS, actByDate, status, describe, attention, sortByActBy, addPeriod, suggestNextDue, renew, costTrend };
})();

export { Renewals };
