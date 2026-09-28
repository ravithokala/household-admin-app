// @ts-check

import { CONFIG } from './config.js';
import { init, session, signOutOfGoogle } from './auth.js';
import { sessionKey, signOut as endSession } from './api.js';
import { el, $ } from './dom.js';
import * as store from './store/store.js';
import { dashboard } from './views/dashboard.js';
import { list } from './views/list.js';
import { itemDetail } from './views/item.js';
import { more } from './views/more.js';
import { entitiesScreen } from './views/entities.js';
import { templatePicker } from './views/itemForm.js';
import { toast } from './views/sheet.js';

/**
 * Household Admin (ADR-001). Starts the app, signs in, loads this phone's copy, keeps it in step
 * with the sheet, and sends each address to its screen:
 *   #/home  what needs attention     #/all  every item, searchable     #/item/<id>  one item
 *   #/more  settings, backup          #/entities  vehicles, homes and people
 */

const TABS = [['home', 'Home'], ['all', 'All'], ['more', 'More']];

/** The screen and its argument from the address. */
function route() {
  const [screen = 'home', arg = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { screen: ['home', 'all', 'item', 'more', 'entities'].includes(screen) ? screen : 'home', arg: decodeURIComponent(arg) };
}

/** The tab a screen belongs to. @param {string} screen */
const tabOf = (screen) => (screen === 'item' ? 'all' : screen === 'entities' ? 'more' : screen);

let signedIn = false;

/** Draws the current screen. Keeps focus and typing in the search box across redraws. */
function show() {
  if (!signedIn) return;
  const { screen, arg } = route();
  const main = $('main');
  const active = document.activeElement;
  const searching = active instanceof HTMLInputElement && active.classList.contains('search-input') ? active.selectionStart : null;
  if (screen === 'home') dashboard(main, show);
  else if (screen === 'all') list(main);
  else if (screen === 'item') itemDetail(main, arg);
  else if (screen === 'entities') entitiesScreen(main);
  else more(main, { signOut });
  if (searching !== null) {
    const box = /** @type {HTMLInputElement|null} */ (main.querySelector('.search-input'));
    box?.focus();
    box?.setSelectionRange(searching, searching);
  }
  document.querySelectorAll('#tabs a').forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('data-tab') === tabOf(screen))));
  $('add').hidden = screen === 'more' || screen === 'entities';
  showSyncState();
}

/** The header badge: offline, changes waiting, or a problem. */
function showSyncState() {
  const badge = $('sync');
  const s = store.status;
  const text = !s.online ? (s.pending ? `Offline · ${s.pending} waiting` : 'Offline')
    : s.error ? 'Sync problem'
      : s.pending ? `${s.pending} waiting` : s.syncing ? 'Syncing…' : '';
  badge.textContent = text;
  badge.hidden = text === '';
  badge.className = `badge ${!s.online ? 'offline' : s.error ? 'problem' : 'busy'}`;
  badge.title = s.error ?? '';
}

async function signOut() {
  if (store.status.pending && !window.confirm(`${store.status.pending} change(s) have not been sent yet and will be lost. Sign out anyway?`)) return;
  await endSession();
  signOutOfGoogle();
  await store.forget();
  signedIn = false;
  window.location.hash = '#/home';
  window.location.reload();
}

/** @param {string} message */
function showError(message) {
  $('main').replaceChildren(el('p', { class: 'error' }, message));
}

async function start() {
  // GitHub Pages cannot forbid framing: refuse to run inside another page (as the portfolio app).
  let framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (framed) { showError('This app cannot be shown inside another page. Open it directly.'); return; }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { /* works without it */ });
  if (!CONFIG.apiUrl || !CONFIG.clientId) {
    showError('This app is not configured yet (config.js): see the README.');
    return;
  }

  $('tabs').replaceChildren(...TABS.map(([id, label]) => el('a', { href: `#/${id}`, 'data-tab': id }, label)));
  $('add').addEventListener('click', () => templatePicker());
  $('sync').addEventListener('click', () => { window.location.hash = '#/more'; });
  window.addEventListener('hashchange', () => { show(); window.scrollTo(0, 0); });
  store.onChange(() => show());
  store.onProblem((p) => toast(p.message, [], p.redo ? () => { p.redo?.(); } : undefined, p.redo ? 'Redo my change' : undefined));

  let hasCopy = false;
  try {
    hasCopy = await store.load();
  } catch (e) {
    showError(`This phone's storage could not be opened: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  // A signed-in phone with a saved copy opens at once, even offline; Google is only needed to sign in.
  if (!session()) {
    if (!navigator.onLine) { showError('Connect to the internet to sign in the first time.'); return; }
    $('main').replaceChildren(el('p', { class: 'muted' }, 'Sign in with your Google account to use the app.'));
    try {
      await init(CONFIG.clientId, $('signin'));
      await sessionKey();
    } catch (e) {
      showError(`Could not sign in: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    $('signin').replaceChildren();
  } else {
    // Ready for when the session expires and Google is needed again.
    init(CONFIG.clientId, $('signin')).then(() => $('signin').replaceChildren()).catch(() => { /* offline: the saved session is used */ });
  }

  signedIn = true;
  if (hasCopy) show();
  else $('main').replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
  store.keepInStep();
  try {
    await store.sync();
  } catch (e) {
    if (!hasCopy) showError(store.status.online ? `Could not load: ${store.status.error}` : 'Offline: connect once to load the data.');
  }
  if (store.status.user) show();
}

start();
