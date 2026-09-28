// @ts-check

import { el, uk } from '../dom.js';
import { VERSION } from '../version.js';
import { call } from '../api.js';
import { data, status } from '../store/store.js';

/**
 * More → System check (ADR-012, as family-calendar's ADR-095): the server's read-only checks,
 * then this phone's own. One line each, fixed wording, counts and dates at most. The last result
 * is kept in memory only, so it survives More redrawing but not a reload.
 * When a change adds something the app depends on, add a line for it (here or on the server).
 *
 * @typedef {{ name: string, ok: boolean, detail: string }} CheckLine
 * @typedef {{ server: CheckLine[] | null, serverProblem: string | null, phone: CheckLine[], ms: number | null }} Report
 */

/** @type {{ running: true } | { report: Report } | null} */
let state = null;
/** Draws the section now on screen: More redraws itself on every sync, replacing it. */
let drawLatest = () => { /* no section yet */ };

/**
 * This phone's checks. The server's counts (when it answered) are compared with this phone's copy.
 * @param {{ items: number, entities: number, history: number } | null} serverCounts
 * @returns {Promise<CheckLine[]>}
 */
async function phoneChecks(serverCounts) {
  /** @type {CheckLine[]} */
  const lines = [];
  lines.push({ name: 'App version', ok: VERSION !== 'local', detail: VERSION === 'local' ? 'An unpublished copy' : VERSION });
  lines.push({ name: 'Connection', ok: navigator.onLine, detail: navigator.onLine ? 'Online' : 'Offline: changes wait on this phone until the connection is back' });

  const synced = status.lastSynced ? new Date(status.lastSynced) : null;
  const when = synced ? `last synced ${uk(synced.toISOString().slice(0, 10))} at ${synced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'not synced yet';
  lines.push(status.error ? { name: 'Sync', ok: false, detail: `The last sync failed · ${when}` }
    : status.pending ? { name: 'Sync', ok: false, detail: `${status.pending} change(s) waiting to be sent · ${when}` }
      : { name: 'Sync', ok: synced !== null, detail: `All changes saved to the sheet · ${when}` });

  const mine = {
    items: Object.values(data.items).filter((i) => !i.deleted).length,
    entities: Object.values(data.entities).filter((e) => !e.deleted).length,
    history: Object.keys(data.history).length,
  };
  const summary = `${mine.items} items, ${mine.entities} vehicles/homes/people, ${mine.history} history entries`;
  if (!serverCounts) lines.push({ name: 'Phone copy', ok: false, detail: `${summary} · could not compare with the sheet` });
  else {
    const same = mine.items === serverCounts.items && mine.entities === serverCounts.entities && mine.history === serverCounts.history;
    lines.push({ name: 'Phone copy', ok: same || status.pending > 0,
      detail: same ? `${summary}, the same as the sheet` : status.pending > 0 ? `${summary} · differs until the waiting changes are sent`
        : `${summary}, but the sheet has ${serverCounts.items} items, ${serverCounts.entities} vehicles/homes/people, ${serverCounts.history} history entries: tap Sync now` });
  }

  const offline = Boolean(navigator.serviceWorker?.controller);
  lines.push({ name: 'Works offline', ok: offline, detail: offline ? 'The app is saved on this phone and opens without a connection' : 'Not yet: open the app once more while online' });

  /** @type {boolean|undefined} */
  let kept;
  try { kept = await navigator.storage?.persisted?.(); } catch (e) { kept = undefined; }
  // Information only: browsers decide this themselves (installed apps are usually kept).
  lines.push({ name: 'Phone storage', ok: true,
    detail: kept === true ? 'Kept: the browser will not clear this app\'s copy'
      : kept === false ? 'May be cleared by the browser if space runs low (the sheet keeps everything; adding the app to the Home Screen helps)'
        : 'This browser does not say' });
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
      el('div', {}, el('div', { class: 'check-name' }, c.name), el('div', { class: 'check-detail' }, c.detail)))))];
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
    report.phone = await phoneChecks(counts);
    if (state !== mine) return;
    state = { report };
    drawLatest();
  }
  drawLatest = draw;
  draw();
  return section;
}
