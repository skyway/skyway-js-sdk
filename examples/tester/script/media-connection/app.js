/* eslint-disable require-atomic-updates */
import { getPeerOptions } from '../state.js';
const { navigator, Peer } = window;

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

    peer.on('call', async mc => {
      console.log('ev: Peer@call');

      $remoteId.value = mc.remoteId;

      let stream = null;
      const gumOptions = getGumOptions($gumSelect.value);
      if (gumOptions) {
        console.log('getUserMedia() w/ options');
        console.log(JSON.stringify(gumOptions, null, 2));
        stream = await navigator.mediaDevices.getUserMedia(gumOptions);
        $localVideo.srcObject = stream;
        $localVideo.play();
      }

      mc.on('stream', onRemoteStream);
      mc.on('close', onClose);

      // TODO
      const answerOptions = {};
      console.log('answer() w/ options');
      console.log(JSON.stringify(answerOptions, null, 2));
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
      console.log('getUserMedia() w/ options');
      console.log(JSON.stringify(gumOptions, null, 2));
      stream = await navigator.mediaDevices.getUserMedia(gumOptions);
      $localVideo.srcObject = stream;
      $localVideo.play();
    }

    // TODO
    const callOptions = {};
    console.log('call() w/ options');
    console.log(JSON.stringify(callOptions, null, 2));

    const mc = peer.call($remoteId.value, stream, callOptions);
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
        const [vTrack] = await navigator.mediaDevices
          .getDisplayMedia({
            video: true,
          })
          .then(stream => stream.getVideoTracks());
        stream.addTrack(vTrack);
      }

      if (gumOptions.audio) {
        const [aTrack] = await navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(stream => stream.getAudioTracks());
        stream.addTrack(aTrack);
      }

      console.log('replace stream w/ tracks');
      console.log(stream.getTracks());

      $localVideo.srcObject = stream;
      $localVideo.play();
    } else {
      $localVideo.srcObject = null;
    }

    conn.replaceStream(stream);
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

  function onRemoteStream(stream) {
    console.log('ev: MediaConnection@stream');

    $remoteVideo.srcObject = stream;
    $remoteVideo.play();

    console.log('stream w/ tracks');
    console.log(stream.getTracks());
  }

  function onClose() {
    console.log('ev: MediaConnection@close');
    $remoteVideo.srcObject = null;
  }
}

function getGumOptions(gumValue) {
  if (gumValue === '--') {
    return null;
  }

  return {
    audio: gumValue.includes('A'),
    video: gumValue.includes('V'),
  };
}
