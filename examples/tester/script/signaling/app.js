import { getPeerOptions } from '../state.js';
import { logPeerEvent } from '../utils.js';
const { Peer } = window;

export default function($c) {
  const $connect = $c.querySelector('[data-connect]');
  const $disconnect = $c.querySelector('[data-disconnect]');
  const $reconnect = $c.querySelector('[data-reconnect]');
  const $destroy = $c.querySelector('[data-destroy]');

  let peer; //: Peer

  $connect.onclick = () => {
    if (peer) return;

    const peerOptions = getPeerOptions();
    console.log('new Peer() w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);
    logPeerEvent(peer);

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      console.log(`peer opened w/ id: ${peerId} and it takes ${time}ms`);
      console.log(`server url is ${peer.socket.signalingServerUrl}`);
    });
    peer.socket.once('OPEN', ({ turnCredential }) => {
      console.log('turn is enable w/ credential');
      console.log(JSON.stringify(turnCredential, null, 2));
    });
  };

  $disconnect.onclick = () => {
    if (!peer) return;

    console.log('Peer#disconnect()');
    peer.disconnect();
  };

  $reconnect.onclick = () => {
    if (!peer) return;

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      console.log('reconnect() success');
      console.log(`server url is ${peer.socket.signalingServerUrl}`);
      console.log(`your id is ${peerId} and it takes ${time}ms`);
    });

    console.log('Peer#reconnect()');
    peer.reconnect();
  };

  $destroy.onclick = () => {
    if (!peer) return;

    console.log('Peer#destroy()');
    peer.destroy();
  };
}
