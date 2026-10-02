// @ts-check

import { el } from '../dom.js';

/**
 * Form fields for the app's sheets. Each returns the element and a way to read its value, so
 * forms stay plain data in, plain data out; the shared validation checks them.
 */

/**
 * @param {string} label
 * @param {HTMLElement} control
 * @param {string} [cls]
 */
export const field = (label, control, cls = '') => el('label', { class: `field ${cls}` }, el('span', {}, label), control);

/**
 * @param {string} type  text, date, time
 * @param {string|null} value
 * @param {Record<string, unknown>} [attrs]
 */
export function input(type, value, attrs = {}) {
  const node = /** @type {HTMLInputElement} */ (el('input', { type, value: value ?? '', ...attrs }));
  return { node, get: () => node.value.trim() || null };
}

/**
 * @param {string|null} value
 * @param {Array<[string, string]>} options  [value, label]
 */
export function select(value, options) {
  const node = /** @type {HTMLSelectElement} */ (el('select', {}, options.map(([v, label]) => el('option', { value: v, selected: v === value }, label))));
  return { node, get: () => node.value || null };
}

/**
 * @param {boolean} value
 * @param {string} label
 */
export function checkbox(value, label) {
  const box = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', checked: value }));
  return { node: el('label', { class: 'check' }, box, el('span', {}, label)), box, get: () => box.checked };
}

/**
 * Toggle chips for choosing people (or any short codes).
 * @param {string[]} options
 * @param {string[]} chosen
 * @param {{ single?: boolean }} [opts]
 */
export function chips(options, chosen, opts = {}) {
  const selected = new Set(chosen);
  /** @type {Array<() => void>} */
  const listeners = [];
  const node = el('div', { class: 'chips' });
  const draw = () => node.replaceChildren(...options.map((o) => el('button', {
    type: 'button', 'aria-pressed': String(selected.has(o)),
    onclick: () => {
      if (opts.single) { selected.clear(); selected.add(o); } else if (selected.has(o)) selected.delete(o); else selected.add(o);
      draw();
      listeners.forEach((fn) => fn());
    },
  }, o)));
  draw();
  return { node, get: () => options.filter((o) => selected.has(o)), onChange: (/** @type {() => void} */ fn) => listeners.push(fn) };
}

/**
 * A form's Save button, which disables itself while saving.
 * @param {string} label
 * @param {() => Promise<void>} save
 */
export function saveButton(label, save) {
  const button = /** @type {HTMLButtonElement} */ (el('button', { class: 'primary', type: 'button' }, label));
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Saving…';
    // A slow save says so, instead of looking stuck (it is retried automatically).
    const slow = setTimeout(() => { button.textContent = 'Still saving… (slow connection)'; }, 5000);
    try {
      await save();
    } finally {
      clearTimeout(slow);
      button.disabled = false;
      button.textContent = label;
    }
  });
  return button;
}

/**
 * Runs a server request from a button, disabled and saying so until the answer comes back, so it
 * cannot be pressed twice.
 * @template T
 * @param {HTMLButtonElement} button
 * @param {() => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function busy(button, work) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Working…';
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/**
 * @param {string|null} value
 * @param {Record<string, unknown>} [attrs]
 */
export function textarea(value, attrs = {}) {
  const node = /** @type {HTMLTextAreaElement} */ (el('textarea', { rows: 3, ...attrs }));
  node.value = value ?? '';
  return { node, get: () => node.value.trim() || null };
}

/**
 * A sum of money in pounds, read as pence ('£1,234.50' → 123450). A value that is not a sum is
 * returned as the text, so validation reports it.
 * @param {number|null} pence
 */
export function money(pence) {
  const node = /** @type {HTMLInputElement} */ (el('input', { type: 'text', inputmode: 'decimal', placeholder: '£', value: pence === null ? '' : (pence / 100).toFixed(2) }));
  return {
    node,
    get: () => {
      const cleaned = node.value.replace(/[£,\s]/g, '');
      if (cleaned === '') return null;
      return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : node.value;
    },
  };
}

/**
 * Shows errors next to the form: each message names its field.
 * @param {HTMLElement} target
 * @param {Issue[]} errors
 */
export function showErrors(target, errors) {
  target.replaceChildren(...errors.map((e) => el('div', { class: 'msg error' },
    e.field && e.field !== 'request' ? `${e.field.replace(/\.\d+\./g, ' ').replace(/_/g, ' ')}: ${e.message}` : e.message)));
  target.scrollIntoView({ block: 'nearest' });
}
