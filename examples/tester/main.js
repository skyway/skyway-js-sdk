import renderSettingsApp from './script/settings/app.js';
import renderSignalingApp from './script/signaling/app.js';
import renderMediaConnectionApp from './script/media-connection/app.js';
import renderDataConnectionApp from './script/data-connection/app.js';

(async function main() {
  renderSettingsApp(document.querySelector('[data-settings-section]'));
  renderSignalingApp(document.querySelector('[data-signaling-section]'));
  renderMediaConnectionApp(
    document.querySelector('[data-media-connection-section]')
  );
  renderDataConnectionApp(
    document.querySelector('[data-data-connection-section]')
  );
})();
