import { getPeerOptions } from './utils.js';
const { Peer } = window;

export default function renderSignaling($c, state, logger) {
  const $connect = $c.querySelector('[data-connect]');
  const $disconnect = $c.querySelector('[data-disconnect]');
  const $reconnect = $c.querySelector('[data-reconnect]');
  const $destroy = $c.querySelector('[data-destroy]');

  let peer; //: Peer

  $connect.onclick = () => {
    if (peer) return;

    const peerOptions = getPeerOptions(state);
    logger.log('connect to signaling server w/ options');
    logger.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      logger.log('ev: Peer@open');
      logger.log(`w/ id: ${peerId} and it takes ${time}ms`);
      logger.log(`server url is ${peer.socket.signalingServerUrl}`);
    });
    peer.socket.once('OPEN', ({ turnCredential }) => {
      logger.log('turn is enable w/ credential');
      logger.log(JSON.stringify(turnCredential, null, 2));
    });

    peer.on('disconnected', peerId => {
      logger.log(`ev: Peer#disconnected w/ id: ${peerId}`);
    });
    peer.on('close', () => {
      logger.log(`ev: Peer#close w/ id: ${peer.id}`);
    });
    peer.on('error', err => {
      logger.error(`ev: Peer#error w/ id: ${peer.id}`);
      logger.error(err);
    });
  };

  $disconnect.onclick = () => {
    if (!peer) return;

    logger.log(`disconnect ${peer.id}`);
    peer.disconnect();
  };

  $reconnect.onclick = () => {
    if (!peer) return;

    const now = Date.now();
    peer.once('open', peerId => {
      const time = Date.now() - now;

      logger.log('ev: Peer@open by reconnect()');
      logger.log(`server url is ${peer.socket.signalingServerUrl}`);
      logger.log(`your id is ${peerId} and it takes ${time}ms`);
    });

    logger.log(`recoonect ${peer.id}`);
    peer.reconnect();
  };

  $destroy.onclick = () => {
    if (!peer) return;

    logger.log(`destory ${peer.id}`);
    peer.destroy();
  };
}
