/* eslint-disable require-atomic-updates */
import { getPeerOptions } from './utils.js';
const { Peer, localStorage } = window;

export default function renderDataConnection($c) {
  const $setUp = $c.querySelector('[data-setup]');
  const $localId = $c.querySelector('[data-local-id]');
  const $remoteId = $c.querySelector('[data-remote-id]');
  const $connect = $c.querySelector('[data-connect]');
  const $dataSink = $c.querySelector('[data-data-sink]');
  const $send = $c.querySelector('[data-send]');
  const $close = $c.querySelector('[data-close]');
  const $fclose = $c.querySelector('[data-fclose]');

  let peer; //: Peer
  let conn; //: DataConnection

  $setUp.onclick = async () => {
    if (peer) return;

    const peerOptions = getPeerOptions(localStorage);
    console.log('connect to signaling server w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);

    await new Promise(r => peer.once('open', r));
    console.log('ev: Peer@open');
    $localId.value = peer.id;

    peer.on('error', err => {
      console.error(`ev: Peer#error w/ id: ${peer.id}`);
      console.error(err);
    });

    peer.on('connection', async dc => {
      console.log('ev: Peer@connection');

      $remoteId.value = dc.remoteId;

      dc.on('data', onRemoteData);
      dc.on('close', onClose);

      conn = dc;
    });
  };

  $connect.onclick = async () => {
    if (!$localId.value) return;
    if (!$remoteId.value) return;
    if (conn) return;

    // TODO
    const connectOptions = {};
    console.log('connect() w/ options');
    console.log(JSON.stringify(connectOptions, null, 2));

    const dc = peer.connect($remoteId.value, connectOptions);
    dc.on('data', onRemoteData);
    dc.on('close', onClose);

    conn = dc;
  };

  $send.onclick = () => {
    const text = `Hello at ${Date.now()}`;
    console.log(`send() ${text}`);

    conn.send(text);
  };

  $close.onclick = () => {
    if (!conn) return;

    console.log('close()');
    conn.close();
  };
  $fclose.onclick = () => {
    if (!conn) return;

    console.log('close(true)');
    conn.close(true);
  };

  function onRemoteData(data) {
    console.log('ev: MediaConnection@data');
    $dataSink.textContent = data;
  }

  function onClose() {
    console.log('ev: MediaConnection@close');
    $dataSink.textContent = 'CLOSED';
  }
}
