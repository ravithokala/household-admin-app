// @ts-check

import { el, uk } from '../dom.js';
import { VERSION } from '../version.js';
import { data, status, bulk } from '../store/store.js';
import { backup } from '../store/changes.js';
import { openSheet, toast } from './sheet.js';
import { busy } from './fields.js';
import { applyTheme, savedTheme } from '../theme.js';
import { systemSection } from './system.js';
import { loadTimeText } from '../freshness.js';

/**
 * More: vehicles/homes/people, data status, backup and restore, appearance, system check, account.
 * @param {HTMLElement} main
 * @param {{ signOut: () => Promise<void>, signOutEverywhere: () => Promise<string|null> }} actions  signOutEverywhere answers why it failed
 */
export function more(main, actions) {
  const synced = status.lastSynced ? new Date(status.lastSynced) : null;

  const themeChoice = (/** @type {string} */ value, /** @type {string} */ label) => el('button', { type: 'button', 'aria-pressed': String(savedTheme() === value),
    onclick: () => { applyTheme(value); more(main, actions); } }, label);

  main.replaceChildren(
    el('h1', { class: 'screen-title' }, 'More'),
    el('section', { class: 'card' },
      el('h2', {}, 'Household'),
      el('a', { class: 'menu-link', href: '#/entities' }, 'Vehicles, homes and people', el('span', { class: 'chevron' }, '›'))),
    el('section', { class: 'card' },
      el('h2', {}, 'Data'),
      el('p', {}, status.online ? 'Changes are saved straight to the sheet; this phone keeps a copy for quick opening.' : 'Offline: you can view everything; saving needs a connection.'),
      el('p', { class: 'muted small' }, synced ? `Updated from the sheet ${uk(synced.toISOString().slice(0, 10))} at ${synced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.` : 'Not updated yet.',
        status.error ? ` Last problem: ${status.error}` : '')),
    el('section', { class: 'card' },
      el('h2', {}, 'Backup'),
      el('p', { class: 'muted small' }, 'The sheet in Google Drive is the main copy. A backup file is an extra copy you keep yourself; it can be made offline.'),
      el('div', { class: 'actions start' },
        el('button', { class: 'button', type: 'button', onclick: exportBackup }, 'Download backup'),
        el('button', { class: 'button', type: 'button', onclick: importBackup }, 'Restore from a backup…'))),
    el('section', { class: 'card' },
      el('h2', {}, 'Appearance'),
      el('div', { class: 'segmented', role: 'group', 'aria-label': 'Theme' }, themeChoice('auto', 'Auto'), themeChoice('light', 'Light'), themeChoice('dark', 'Dark'))),
    systemSection(),
    el('section', { class: 'card' },
      el('h2', {}, 'Account'),
      el('p', {}, status.user ? `Signed in as ${status.user}.` : 'Signed in.', status.users.length > 1 ? ` App users: ${status.users.join(', ')}.` : ''),
      el('div', { class: 'actions start' },
        el('button', { class: 'button', type: 'button', onclick: actions.signOut }, 'Sign out of this phone'),
        // A lost phone: ends this account's sign-in on every device, this one included.
        el('button', { class: 'button danger', type: 'button', onclick: async () => {
          if (!window.confirm('Sign out on every device where you are signed in, including this one?')) return;
          const problem = await actions.signOutEverywhere();
          if (problem) toast(`Could not sign out all devices: ${problem}`);
        } }, 'Sign out all devices'))),
    // Where a slow open spends its time (as the other two apps): the last refresh from the sheet.
    el('p', { class: 'version' }, `Version ${VERSION}`, status.timing ? el('span', { class: 'load-time' }, loadTimeText(status.timing)) : ''));
}

function exportBackup() {
  const file = new Blob([JSON.stringify(backup(data, new Date().toISOString()), null, 2)], { type: 'application/json' });
  const link = /** @type {HTMLAnchorElement} */ (el('a', { href: URL.createObjectURL(file), download: `household-admin-backup-${new Date().toISOString().slice(0, 10)}.json` }));
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  toast('Backup downloaded.');
}

function importBackup() {
  const picker = /** @type {HTMLInputElement} */ (el('input', { type: 'file', accept: 'application/json,.json' }));
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    if (!file) return;
    /** @type {any} */
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      toast('That file is not a backup from this app.');
      return;
    }
    const counts = `${parsed?.items?.length ?? 0} items, ${parsed?.entities?.length ?? 0} vehicles/homes/people, ${parsed?.history?.length ?? 0} history entries`;
    const restore = (/** @type {'merge'|'replace'} */ mode) => async (/** @type {Event} */ ev) => {
      try {
        const r = await busy(/** @type {HTMLButtonElement} */ (ev.currentTarget), () => bulk('backup.import', { mode, backup: parsed }));
        if (!r.ok) { toast(r.errors.slice(0, 3).map((e) => `${e.field}: ${e.message}`).join('; ')); return; }
        sheet.close();
        toast(mode === 'replace' ? 'Restored.' : `Added ${r.data.added.items} item(s); ${r.data.skipped} already here.`);
      } catch (e) {
        // Say what went wrong: not every failure is the connection.
        toast(navigator.onLine ? `Could not restore: ${e instanceof Error ? e.message : String(e)}` : 'Restoring needs a connection.');
      }
    };
    const sheet = openSheet('Restore a backup', el('div', { class: 'form' },
      el('p', {}, `${file.name}: ${counts}${parsed?.exported_at ? `, made ${uk(String(parsed.exported_at).slice(0, 10))}` : ''}.`),
      el('p', { class: 'muted small' }, 'Add missing: keeps everything here and adds anything in the backup that is not. Replace: makes the sheet exactly the backup, for everyone; changes since the backup are lost.'),
      el('div', { class: 'actions' },
        el('button', { class: 'secondary', type: 'button', onclick: restore('merge') }, 'Add missing'),
        el('button', { class: 'danger', type: 'button', onclick: restore('replace') }, 'Replace everything'))));
  });
  picker.click();
}
