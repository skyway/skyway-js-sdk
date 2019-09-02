/* eslint-disable require-atomic-updates */
import { getPeerOptions } from '../state.js';
import {
  logPeerEvent,
  logSfuRoomEvent,
  getGumOptions,
  getUserVideoTrack,
  getUserAudioTrack,
  getDisplayVideoTrack,
} from '../utils.js';
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
    console.log('new Peer() w/ options');
    console.log(JSON.stringify(peerOptions, null, 2));

    peer = new Peer(peerOptions);
    logPeerEvent(peer);

    await new Promise(r => peer.once('open', r));
    $localId.value = peer.id;
  };

  $join.onclick = async () => {
    if (!$roomId.value) return;
    if (room) return;

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
    const roomOptions = { mode: 'sfu', stream };
    console.log(`Peer#joinRoom() ${$roomId.value} w/ options`);
    console.log(JSON.stringify(roomOptions, null, 2));
    console.log('and stream w/ tracks');
    console.log(stream ? stream.getTracks() : null);

    room = peer.joinRoom($roomId.value, roomOptions);

    logSfuRoomEvent(room);
    room.on('stream', stream => {
      console.log('receive stream w/ tracks');
      console.log(stream.getTracks());

      stream.getTracks().forEach(track => {
        const $media = document.createElement(track.kind);
        $media.srcObject = stream;
        $media.controls = true;
        if (track.kind === 'video') {
          $media.muted = $media.playsInline = true;
        }
        $media.dataset.peerId = stream.peerId;
        $remoteVideos.append($media);
        $media.play();
      });
    });

    room.on('peerLeave', peerId => {
      $c.querySelector(`[data-peer-id="${peerId}"]`).remove();
    });

    room.on('data', ({ src, data }) => {
      $dataSink.textContent = `${data} from ${src}`;
    });
  };

  $replace.onclick = async () => {
    if (!room) return;

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

    console.log('SfuRoom#replaceStream()');
    console.log('stream w/ tracks');
    console.log(stream ? stream.getTracks() : null);
    room.replaceStream(stream);
  };

  $send.onclick = () => {
    if (!room) return;

    const text = `Hello at ${Date.now()}`;
    console.log('SfuRoom#send() w/ text');
    console.log(text);
    room.send(text);
  };

  $close.onclick = () => {
    if (!room) return;

    console.log('SfuRoom#close()');
    room.close();
  };
}
