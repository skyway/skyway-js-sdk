/* eslint-disable require-atomic-updates */
import { getPeerOptions } from '../state.js';
const { Peer } = window;

export default function($c) {
  const $setUp = $c.querySelector('[data-setup]');
  const $localId = $c.querySelector('[data-local-id]');
  const $localVideo = $c.querySelector('[data-local-video]');
  const $remoteVideos = $c.querySelector('[data-remote-videos]');
  const $roomId = $c.querySelector('[data-room-id]');
  const $gumSelect = $c.querySelector('[data-gum-select]');
  const $join = $c.querySelector('[data-join]');
  const $replace = $c.querySelector('[data-replace]');
  const $send = $c.querySelector('[data-send]');
  const $dataSink = $c.querySelector('[data-data-sink]');
  const $close = $c.querySelector('[data-close]');

  let peer; //: Peer
  let room; //: SfuRoom

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
  };

  $join.onclick = async () => {
    if (!$roomId.value) return;
    if (room) return;

    const stream = await gum($gumSelect.value, console);
    $localVideo.srcObject = stream;
    $localVideo.play();

    // TODO
    const roomOptions = { mode: 'sfu', stream };
    console.log(`join to room: ${$roomId.value} w/ options`);
    console.log(JSON.stringify(roomOptions, null, 2));

    room = peer.joinRoom($roomId.value, roomOptions);

    room.on('stream', stream => {
      console.log('ev: SfuRoom@stream');

      console.log('stream w/ tracks');
      console.log(stream.getTracks());

      const $remoteVideo = document.createElement('video');
      $remoteVideo.srcObject = stream;
      $remoteVideo.play();
      $remoteVideo.dataset.peerId = stream.peerId;

      $remoteVideos.append($remoteVideo);
    });

    room.on('peerLeave', peerId => {
      console.log('ev: SfuRoom@peerLeave');
      console.log(peerId);

      $c.querySelector(`[data-peer-id=${peerId}]`).remove();
    });

    room.on('data', ({ src, data }) => {
      console.log('ev: SfuRoom@data');
      $dataSink.textContent = `${data} from ${src}`;
    });

    room.on('close', () => {
      console.log('ev: SfuRoom@close');
    });
  };

  $replace.onclick = async () => {
    if (!room) return;

    console.log('replace w/ display video(no audio)');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    $localVideo.srcObject = stream;
    $localVideo.play();

    room.replaceStream(stream);
  };

  $send.onclick = () => {
    if (!room) return;

    const text = `Hello at ${Date.now()}`;
    console.log(`send() ${text}`);

    room.send(text);
  };

  $close.onclick = () => {
    if (!room) return;

    console.log('close()');
    room.close();
  };
}

async function gum(gumValue) {
  let stream;
  const gumOptions = {};
  if (gumValue !== '--') {
    gumOptions.audio = gumValue.includes('A');
    gumOptions.video = gumValue.includes('V');

    console.log('getUserMedia() w/ options');
    console.log(JSON.stringify(gumOptions, null, 2));
    stream = await navigator.mediaDevices.getUserMedia(gumOptions);
  }

  return stream;
}
