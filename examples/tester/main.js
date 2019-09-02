import renderSettingsApp from './script/settings/app.js';
import renderSignalingApp from './script/signaling/app.js';
import renderMediaConnectionApp from './script/media-connection/app.js';
import renderDataConnectionApp from './script/data-connection/app.js';
import renderMeshRoomApp from './script/mesh-room/app.js';
import renderSfuRoomApp from './script/sfu-room/app.js';

(async function main() {
  renderSettingsApp(document.querySelector('[data-settings-section]'));
  renderSignalingApp(document.querySelector('[data-signaling-section]'));
  renderMediaConnectionApp(
    document.querySelector('[data-media-connection-section]')
  );
  renderDataConnectionApp(
    document.querySelector('[data-data-connection-section]')
  );
  renderMeshRoomApp(document.querySelector('[data-mesh-room-section]'));
  renderSfuRoomApp(document.querySelector('[data-sfu-room-section]'));
})();
