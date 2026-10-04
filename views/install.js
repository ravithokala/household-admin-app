// @ts-check

import { el } from '../dom.js';
import { toast } from './sheet.js';
import { installState, install, installHint, onInstallChange } from '../install.js';

/**
 * More → Install this app, at the bottom (ADR-019, app-kit's install.js): Android Chrome's ⋮ menu
 * refuses to install a second app from ravithokala.github.io, so the app offers its own button.
 * Nothing is shown once the app runs from its icon. The section redraws itself when Chrome's offer
 * arrives.
 */

/** Draws the section now on screen; More redraws itself on every refresh, replacing it. */
let drawLatest = () => { /* no section yet */ };
onInstallChange(() => drawLatest());

export function installSection() {
  const section = el('section', { class: 'card', id: 'install' });
  const draw = () => {
    const state = installState();
    section.hidden = state === 'installed';
    section.replaceChildren(
      el('h2', {}, 'Install this app'),
      ...(state === 'ready'
        ? [el('p', { class: 'muted small' }, 'Adds Household to your home screen, so it opens full screen and works offline.'),
          el('div', { class: 'actions start' }, el('button', { class: 'button', type: 'button', onclick: async () => {
            if (await install() === 'accepted') toast('Installing… look for Household on your home screen.');
          } }, 'Install this app'))]
        : [el('p', { class: 'muted small' }, installHint())]));
  };
  drawLatest = draw;
  draw();
  return section;
}
