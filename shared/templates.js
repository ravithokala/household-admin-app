// @ts-check
// GENERATED from apps-script/domain/templates.js by scripts/sync-shared.js. Do not edit here:
// edit that file and run `npm run sync:shared`.

/**
 * Built-in templates: adding an item from one fills in its category, recurrence and lead time,
 * so only the due date and what it belongs to are left to enter. This is the one file to edit
 * to change them.
 *
 * !! These are sensible defaults, not advice. Rules, deadlines and good lead times change: check
 * !! GOV.UK, DVLA, HMRC, Ofgem, Ofcom and your providers before relying on them. (Last reviewed
 * !! 2026-09-28.)
 *
 * lead_time_days  how many days before the due date to act (the act-by date).
 * roll_from       'due': the next due date counts from the old due date (insurance, MOT);
 *                 'done': from the day it was actually done (dental checkup, boiler service).
 * fixed_date      'MM-DD' for deadlines that fall on the same date every year.
 *
 * Shared with the phone app: scripts/sync-shared.js copies this file to pwa/shared/.
 */
const Templates = (() => {
  /** @type {ReadonlyArray<{ id: string, label: string }>} */
  const CATEGORIES = Object.freeze([
    { id: 'vehicle', label: 'Vehicle' },
    { id: 'home', label: 'Home' },
    { id: 'personal', label: 'Personal' },
    { id: 'financial', label: 'Financial' },
    { id: 'other', label: 'Other' },
  ]);

  /** @type {ReadonlyArray<Template>} */
  const ALL = Object.freeze([
    // Vehicle
    { id: 'mot', title: 'MOT', category: 'vehicle', entity_type: 'vehicle', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 30,
      hint: 'An MOT can be done up to a month (minus a day) before it runs out and keep the same renewal date. Earlier than that, the new date counts from the test.' },
    { id: 'car-tax', title: 'Car tax', category: 'vehicle', entity_type: 'vehicle', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 14,
      hint: 'Vehicle tax (VED) with DVLA. Needs a valid MOT and insurance. Direct Debit renews automatically.' },
    { id: 'car-insurance', title: 'Car insurance', category: 'vehicle', entity_type: 'vehicle', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 28,
      hint: 'Quotes are often cheapest about three to four weeks before renewal. Check it does not auto-renew at a higher price.' },
    { id: 'breakdown', title: 'Breakdown cover', category: 'vehicle', entity_type: 'vehicle', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 21,
      hint: 'Check whether it is already included with the car insurance or a bank account.' },
    { id: 'car-service', title: 'Car service', category: 'vehicle', entity_type: 'vehicle', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'done', lead_time_days: 21,
      hint: 'Often every 12 months or a set mileage, whichever comes first. Can be booked alongside the MOT.' },

    // Home
    { id: 'home-insurance', title: 'Home insurance', category: 'home', entity_type: 'property', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 28,
      hint: 'Buildings and contents. Compare quotes three to four weeks before renewal.' },
    { id: 'boiler-service', title: 'Boiler service', category: 'home', entity_type: 'property', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'done', lead_time_days: 30,
      hint: 'By a Gas Safe registered engineer. Many boiler warranties require a yearly service.' },
    { id: 'energy-contract', title: 'Energy contract end', category: 'home', entity_type: 'property', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 49,
      hint: 'Suppliers cannot charge exit fees in the last 49 days of a fixed tariff. Set the recurrence to the new fix length when you renew.' },
    { id: 'broadband-contract', title: 'Broadband contract end', category: 'home', entity_type: 'property', recurrence_unit: 'month', recurrence_every: 24, roll_from: 'due', lead_time_days: 31,
      hint: 'Providers must send an end-of-contract notice 10 to 40 days before. Prices usually rise afterwards.' },
    { id: 'tv-licence', title: 'TV licence', category: 'home', entity_type: 'property', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 30,
      hint: 'Renews at the end of the month it was bought. Direct Debit renews automatically.' },

    // Personal
    { id: 'passport-adult', title: 'Passport (adult)', category: 'personal', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 10, roll_from: 'done', lead_time_days: 180,
      hint: 'Allow processing time, and check the destination: many countries need 3 to 6 months validity left. The due date is the expiry printed in the passport.' },
    { id: 'passport-child', title: 'Passport (child)', category: 'personal', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 5, roll_from: 'done', lead_time_days: 180,
      hint: 'Child passports last 5 years. Allow processing time and check destination validity rules.' },
    { id: 'ghic', title: 'GHIC card', category: 'personal', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 5, roll_from: 'due', lead_time_days: 30,
      hint: 'Free from the NHS. Beware of paid look-alike sites.' },
    { id: 'driving-licence', title: 'Driving licence photocard', category: 'personal', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 10, roll_from: 'due', lead_time_days: 56,
      hint: 'The photocard must be renewed every 10 years (from 70, the licence itself every 3 years). DVLA usually sends a reminder.' },
    { id: 'dental', title: 'Dental checkup', category: 'personal', entity_type: 'person', recurrence_unit: 'month', recurrence_every: 6, roll_from: 'done', lead_time_days: 14,
      hint: 'Your dentist may recommend anything from 3 to 24 months. Adjust the recurrence to match.' },
    { id: 'eye-test', title: 'Eye test', category: 'personal', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 2, roll_from: 'done', lead_time_days: 21,
      hint: 'Usually every 2 years; yearly for children and some adults.' },

    // Financial
    { id: 'mortgage-fix', title: 'Mortgage fixed rate ends', category: 'financial', entity_type: 'property', recurrence_unit: 'none', recurrence_every: null, roll_from: 'due', lead_time_days: 183,
      hint: 'Many lenders let you secure a new deal about six months ahead. Enter the new fix end date when you renew.' },
    { id: 'self-assessment', title: 'Self Assessment tax return', category: 'financial', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 60, fixed_date: '01-31',
      hint: 'Online return and balancing payment due 31 January.' },
    { id: 'payment-on-account', title: 'Tax payment on account (July)', category: 'financial', entity_type: 'person', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 30, fixed_date: '07-31',
      hint: 'Second payment on account due 31 July, if you make payments on account.' },
    { id: 'subscription', title: 'Subscription', category: 'financial', entity_type: 'household', recurrence_unit: 'year', recurrence_every: 1, roll_from: 'due', lead_time_days: 14,
      hint: 'Set the title to the service. Decide whether to keep it before it renews.' },
  ].map((t) => Object.freeze(/** @type {Template} */ (t))));

  /** @param {string|null|undefined} id @returns {Template|null} */
  const get = (id) => ALL.find((t) => t.id === id) ?? null;

  /** @param {string} id */
  const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return { CATEGORIES, ALL, get, categoryLabel };
})();

export { Templates };
