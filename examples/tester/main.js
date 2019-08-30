import renderSettings from './script/render-settings.js';
import renderSignaling from './script/render-signaling.js';
import renderMediaConnection from './script/render-media-connection.js';
import renderDataConnection from './script/render-data-connection.js';

(async function main() {
  const $settingsSection = document.querySelector('[data-settings-section]');
  const $signalingSection = document.querySelector('[data-signaling-section]');
  const $mediaConnectionSection = document.querySelector(
    '[data-media-connection-section]'
  );
  const $dataConnectionSection = document.querySelector(
    '[data-data-connection-section]'
  );

  renderSettings($settingsSection);
  renderSignaling($signalingSection);
  renderMediaConnection($mediaConnectionSection);
  renderDataConnection($dataConnectionSection);
})();
