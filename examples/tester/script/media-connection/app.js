/* eslint-disable require-atomic-updates */
import { getPeerOptions } from '../state.js';
import {
  logPeerEvent,
  logMediaConnectionEvent,
  getGumOptions,
  getUserVideoTrack,
  getUserAudioTrack,
  getDisplayVideoTrack,
} from '../utils.js';
const { Peer } = window;

export default function($c) {
  const $setUp = $c.querySelector('[data-setup]');
  const $localId = $c.querySelector('[data-local-id]');
  const $remoteId = $c.querySelector('[data-remote-id]');
  const $localVideo = $c.querySelector('[data-local-video]');
  const $remoteVideo = $c.querySelector('[data-remote-video]');
  const $gumSelect = $c.querySelector('[data-gum-select]');
  const $call = $c.querySelector('[data-call]');
  const $replace = $c.querySelector('[data-replace]');
  const $close = $c.querySelector('[data-close]');
  const $fclose = $c.querySelector('[data-fclose]');

  let peer; //: Peer
  let conn; //: MediaConnection

  $setUp.onclick = async () => {
    if (peer) return;

    const peerOptions = getPeerOptions();
    console.log('new Peer() w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);
    logPeerEvent(peer);

    await new Promise(r => peer.once('open', r));
    $localId.value = peer.id;

    peer.on('call', async mc => {
      $remoteId.value = mc.remoteId;

      let stream = null;
      const gumOptions = getGumOptions($gumSelect.value);
      if (gumOptions) {
        stream = new MediaStream();

        if (gumOptions.video) {
          const vTrack = await getUserVideoTrack(navigator);
          stream.addTrack(vTrack);
        }
        if (gumOptions.audio) {
          const aTrack = await getUserAudioTrack(navigator);
          stream.addTrack(aTrack);
        }

        $localVideo.srcObject = stream;
        $localVideo.play();
      }

      logMediaConnectionEvent(mc);
      mc.on('stream', onRemoteStream);
      mc.on('close', onClose);

      // TODO
      const answerOptions = {};
      console.log('MediaConnection#answer() w/ options');
      console.log(JSON.stringify(answerOptions, null, 2));
      console.log('and stream w/ tracks');
      console.log(stream ? stream.getTracks() : null);
      mc.answer(stream, answerOptions);

      conn = mc;
    });
  };

  $call.onclick = async () => {
    if (!$localId.value) return;
    if (!$remoteId.value) return;
    if (conn) return;

    let stream = null;
    const gumOptions = getGumOptions($gumSelect.value);
    if (gumOptions) {
      stream = new MediaStream();

      if (gumOptions.video) {
        const vTrack = await getUserVideoTrack(navigator);
        stream.addTrack(vTrack);
      }
      if (gumOptions.audio) {
        const aTrack = await getUserAudioTrack(navigator);
        stream.addTrack(aTrack);
      }

      $localVideo.srcObject = stream;
      $localVideo.play();
    }

    // TODO
    const callOptions = {};
    console.log('MediaConnection#call() w/ options');
    console.log(JSON.stringify(callOptions, null, 2));
    console.log('and stream w/ tracks');
    console.log(stream ? stream.getTracks() : null);

    const mc = peer.call($remoteId.value, stream, callOptions);
    logMediaConnectionEvent(mc);
    mc.on('stream', onRemoteStream);
    mc.on('close', onClose);

    conn = mc;
  };

  $replace.onclick = async () => {
    if (!conn) return;

    let stream = null;
    const gumOptions = getGumOptions($gumSelect.value);
    if (gumOptions) {
      stream = new MediaStream();

      if (gumOptions.video) {
        const vTrack = await getDisplayVideoTrack(navigator);
        stream.addTrack(vTrack);
      }
      if (gumOptions.audio) {
        const aTrack = await getUserAudioTrack(navigator);
        stream.addTrack(aTrack);
      }

      $localVideo.srcObject = stream;
      $localVideo.play();
    } else {
      $localVideo.srcObject = null;
    }

    console.log('MediaConnection#replaceStream()');
    console.log('stream w/ tracks');
    console.log(stream ? stream.getTracks() : null);
    conn.replaceStream(stream);
  };

  $close.onclick = () => {
    if (!conn) return;

    console.log('MediaConnection#close()');
    conn.close();
  };
  $fclose.onclick = () => {
    if (!conn) return;

    console.log('MediaConnection#close(true)');
    conn.close(true);
  };

  function onRemoteStream(stream) {
    $remoteVideo.srcObject = stream;
    $remoteVideo.play();

    console.log('receive stream w/ tracks');
    console.log(stream.getTracks());
  }

  function onClose() {
    $remoteVideo.srcObject = null;

    console.log('close conn');
  }
}
