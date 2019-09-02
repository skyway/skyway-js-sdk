/* eslint-disable require-atomic-updates */
import { getPeerOptions } from '../state.js';
import { logPeerEvent, logDataConnectionEvent } from '../utils.js';
const { Peer } = window;

export default function($c) {
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

    const peerOptions = getPeerOptions();
    console.log('new Peer() w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);
    logPeerEvent(peer);

    await new Promise(r => peer.once('open', r));
    $localId.value = peer.id;

    peer.on('connection', async dc => {
      $remoteId.value = dc.remoteId;

      logDataConnectionEvent(dc);
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
    console.log('DataConnection#connect() w/ options');
    console.log(JSON.stringify(connectOptions, null, 2));

    const dc = peer.connect($remoteId.value, connectOptions);

    logDataConnectionEvent(dc);
    dc.on('data', onRemoteData);
    dc.on('close', onClose);

    conn = dc;
  };

  $send.onclick = () => {
    const text = `Hello at ${Date.now()}`;

    console.log('DataConnection#send() w/ text');
    console.log(text);
    conn.send(text);
  };

  $close.onclick = () => {
    if (!conn) return;

    console.log('DataConnection#close()');
    conn.close();
  };
  $fclose.onclick = () => {
    if (!conn) return;

    console.log('DataConnection#close(true)');
    conn.close(true);
  };

  function onRemoteData(data) {
    $dataSink.textContent = data;
  }

  function onClose() {
    $dataSink.textContent = 'CLOSED';
  }
}
