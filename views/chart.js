// @ts-check

import { el, svg, uk } from '../dom.js';
import { Model } from '../shared/model.js';

/**
 * The cost of each renewal as a small column chart, oldest first, with the change since the
 * previous one. Hand-drawn SVG: no chart library. Values are labelled directly, so the chart
 * reads without hovering, and a text summary sits beside it for screen readers.
 * @param {Array<{ date: string, cost_pence: number }>} points
 */
export function costChart(points) {
  if (points.length === 0) return el('p', { class: 'muted small' }, 'No costs recorded yet. They are added each time the item is marked as renewed.');
  const shown = points.slice(-8);
  const width = 320;
  const height = 150;
  const top = 22;
  const bottom = 22;
  const max = Math.max(...shown.map((p) => p.cost_pence)) || 1;
  const slot = width / shown.length;
  const bar = Math.min(44, slot * 0.6);
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img', 'aria-hidden': 'true' },
    svg('line', { x1: 0, x2: width, y1: height - bottom, y2: height - bottom, class: 'chart-axis' }),
    ...shown.flatMap((p, i) => {
      const h = Math.max(2, ((height - top - bottom) * p.cost_pence) / max);
      const x = slot * i + (slot - bar) / 2;
      const y = height - bottom - h;
      const last = i === shown.length - 1;
      return [
        svg('rect', { x, y, width: bar, height: h, rx: 3, class: last ? 'chart-bar latest' : 'chart-bar' }),
        svg('text', { x: x + bar / 2, y: y - 6, class: 'chart-value', 'text-anchor': 'middle' }, Model.money(Math.round(p.cost_pence / 100) * 100)),
        svg('text', { x: x + bar / 2, y: height - 6, class: 'chart-label', 'text-anchor': 'middle' }, p.date.slice(0, 4)),
      ];
    }));
  const first = shown[0].cost_pence;
  const latest = shown[shown.length - 1].cost_pence;
  const change = shown.length > 1 && first > 0 ? Math.round(((latest - first) / first) * 100) : null;
  const summary = shown.map((p) => `${uk(p.date)}: ${Model.money(p.cost_pence)}`).join('; ');
  return el('figure', { class: 'chart-wrap' }, chart,
    el('figcaption', { class: 'muted small' },
      change === null ? `Latest ${Model.money(latest)}.` : `Latest ${Model.money(latest)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% since ${shown[0].date.slice(0, 4)}.`,
      el('span', { class: 'sr-only' }, ` ${summary}`)));
}
