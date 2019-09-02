import { getPeerOptions } from '../state.js';
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
    console.log('connect to signaling server w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      console.log('ev: Peer@open');
      console.log(`w/ id: ${peerId} and it takes ${time}ms`);
      console.log(`server url is ${peer.socket.signalingServerUrl}`);
    });
    peer.socket.once('OPEN', ({ turnCredential }) => {
      console.log('turn is enable w/ credential');
      console.log(JSON.stringify(turnCredential, null, 2));
    });

    peer.on('disconnected', peerId => {
      console.log(`ev: Peer#disconnected w/ id: ${peerId}`);
    });
    peer.on('close', () => {
      console.log(`ev: Peer#close w/ id: ${peer.id}`);
    });
    peer.on('error', err => {
      console.error(`ev: Peer#error w/ id: ${peer.id}`);
      console.error(err);
    });
  };

  $disconnect.onclick = () => {
    if (!peer) return;

    console.log(`disconnect ${peer.id}`);
    peer.disconnect();
  };

  $reconnect.onclick = () => {
    if (!peer) return;

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      console.log('ev: Peer@open by reconnect()');
      console.log(`server url is ${peer.socket.signalingServerUrl}`);
      console.log(`your id is ${peerId} and it takes ${time}ms`);
    });

    console.log(`recoonect ${peer.id}`);
    peer.reconnect();
  };

  $destroy.onclick = () => {
    if (!peer) return;

    console.log(`destory ${peer.id}`);
    peer.destroy();
  };
}
