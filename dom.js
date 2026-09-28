// @ts-check

import { Dates } from './shared/dates.js';

/**
 * Builds an element. Text is always inserted as text, never as HTML.
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs]
 * @param {...unknown} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = String(value);
    else if (key === 'style' && typeof value === 'object' && value !== null) Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), /** @type {EventListener} */ (value));
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === '' || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

/**
 * An SVG element (for the cost chart).
 * @param {string} tag
 * @param {Record<string, string|number>} [attrs]
 * @param {...(Node|string)} children
 */
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  node.append(...children);
  return node;
}

/** @param {string} id */
export const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** Today in the UK. */
export const today = () => Dates.londonDate();

/** DD/MM/YYYY. @param {string|null|undefined} iso */
export const uk = (iso) => Dates.formatUk(iso);

/**
 * 'today', 'tomorrow', 'in 12 days', '3 days ago'.
 * @param {number} days
 */
export function relative(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
