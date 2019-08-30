import renderSettings from './script/render-settings.js';
import renderSignaling from './script/render-signaling.js';
import renderMediaConnection from './script/render-media-connection.js';

(async function main() {
  const $settingsSection = document.querySelector('[data-settings-section]');
  const $signalingSection = document.querySelector('[data-signaling-section]');
  const $mediaConnectionSection = document.querySelector(
    '[data-media-connection-section]'
  );

  const state = new Map();
  const logger = {
    log(...args) {
      console.log(...args);
    },
    warn(...args) {
      console.warn(...args);
    },
    error(...args) {
      console.error(...args);
    },
  };

  renderSettings($settingsSection, state, logger);
  renderSignaling($signalingSection, state, logger);
  renderMediaConnection($mediaConnectionSection, state, logger);
})();
