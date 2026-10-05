// @ts-check

import { el, uk } from '../dom.js';
import { VERSION } from '../version.js';
import { call } from '../api.js';
import { phoneChecks } from '../checks.js';
import { data, status } from '../store/store.js';

/**
 * More → System check (ADR-012, as family-calendar's ADR-095): the server's read-only checks,
 * then this phone's own. One line each, fixed wording, counts and dates at most. The last result
 * is kept in memory only, so it survives More redrawing but not a reload.
 * When a change adds something the app depends on, add a line for it (here or on the server).
 *
 * @typedef {{ name: string, ok: boolean, detail: string, items?: string[] }} CheckLine  items: a short list under the line (Failed requests, ADR-020)
 * @typedef {{ server: CheckLine[] | null, serverProblem: string | null, phone: CheckLine[], ms: number | null }} Report
 */

/** @type {{ running: true } | { report: Report } | null} */
let state = null;
/** Draws the section now on screen: More redraws itself on every refresh, replacing it. */
let drawLatest = () => { /* no section yet */ };

/**
 * This phone's checks. The server's counts (when it answered) are compared with this phone's copy.
 * @param {{ items: number, entities: number, history: number } | null} serverCounts
 * @returns {Promise<CheckLine[]>}
 */
async function thisPhone(serverCounts) {
  /** @type {CheckLine[]} */
  const lines = [];
  // The checks every app shares (app-kit's checks.js); this app's own two go between them.
  const shared = await phoneChecks(VERSION);
  lines.push(shared.version, shared.connection);

  const synced = status.lastSynced ? new Date(status.lastSynced) : null;
  const when = synced ? `${uk(synced.toISOString().slice(0, 10))} at ${synced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : null;
  lines.push(status.error ? { name: 'Updates', ok: false, detail: `The last update from the sheet failed${when ? ` · last good one ${when}` : ''}` }
    : { name: 'Updates', ok: when !== null, detail: when ? `Last updated from the sheet ${when}` : 'Not updated from the sheet yet' });

  const mine = {
    items: Object.values(data.items).filter((i) => !i.deleted).length,
    entities: Object.values(data.entities).filter((e) => !e.deleted).length,
    history: Object.keys(data.history).length,
  };
  const summary = `${mine.items} items, ${mine.entities} vehicles/homes/people, ${mine.history} history entries`;
  if (!serverCounts) lines.push({ name: 'Phone copy', ok: false, detail: `${summary} · could not compare with the sheet` });
  else {
    const same = mine.items === serverCounts.items && mine.entities === serverCounts.entities && mine.history === serverCounts.history;
    lines.push({ name: 'Phone copy', ok: same,
      detail: same ? `${summary}, the same as the sheet`
        : `${summary}, but the sheet has ${serverCounts.items} items, ${serverCounts.entities} vehicles/homes/people, ${serverCounts.history} history entries: close and reopen the app` });
  }

  // The last failed requests (app-kit's problems.js, ADR-020), so a "Not updated" spell can be looked at afterwards.
  lines.push(shared.offline, shared.storage, shared.problems);
  return lines;
}

/** The More section: a button, a status line, then the lines. */
export function systemSection() {
  const section = el('section', { class: 'card', id: 'system' });
  const draw = () => {
    const report = state && 'report' in state ? state.report : null;
    const all = report ? [...(report.server ?? []), ...report.phone] : [];
    const failed = all.filter((c) => !c.ok).length;
    const running = Boolean(state && 'running' in state);
    const statusText = running ? 'Checking… this can take a few seconds'
      : report ? `${failed ? `${failed} of ${all.length} checks failed` : `All ${all.length} checks passed`}${report.ms !== null ? ` · ${(report.ms / 1000).toFixed(1)} s` : ''}`
        : 'Checks the sheet, the settings, Google sign-in and this phone.';
    const button = /** @type {HTMLButtonElement} */ (el('button', { class: 'button', type: 'button', onclick: go, disabled: running },
      report ? 'Run the system check again' : 'Run system check'));
    /** @param {string} title @param {CheckLine[]} lines */
    const list = (title, lines) => [el('h3', { class: 'check-group' }, title), el('ul', { class: 'checks' }, lines.map((c) => el('li', { class: c.ok ? 'check ok' : 'check fail' },
      el('span', { class: 'check-mark', 'aria-label': c.ok ? 'Passed' : 'Failed' }, c.ok ? '✓' : '✕'),
      el('div', {}, el('div', { class: 'check-name' }, c.name), el('div', { class: 'check-detail' }, c.detail),
        c.items?.length ? el('ul', { class: 'check-items' }, c.items.map((i) => el('li', {}, i))) : ''))))];
    section.replaceChildren(
      el('h2', {}, 'System check'),
      el('p', { class: `muted small${failed ? ' danger-text' : ''}`, role: 'status' }, statusText),
      button,
      ...(report ? [
        ...(report.server ? list('Server and sheet', report.server) : [el('p', { class: 'msg error' }, `The server check did not run: ${report.serverProblem}`)]),
        ...list('This phone', report.phone),
      ] : []));
  };
  async function go() {
    if (state && 'running' in state) return;
    const mine = state = { running: /** @type {true} */ (true) };
    drawLatest();
    /** @type {Report} */
    const report = { server: null, serverProblem: null, phone: [], ms: null };
    let counts = null;
    try {
      const r = await call('system.check', {});
      if (r.ok) {
        report.server = r.data.checks;
        report.ms = r.data.ms;
        counts = r.data.counts;
      } else {
        report.serverProblem = r.errors.map((e) => e.message).join('; ');
      }
    } catch (e) {
      report.serverProblem = navigator.onLine ? (e instanceof Error ? e.message : String(e)) : 'no connection';
    }
    report.phone = await thisPhone(counts);
    if (state !== mine) return;
    state = { report };
    drawLatest();
  }
  drawLatest = draw;
  draw();
  return section;
}
