export function getGumOptions(gumValue) {
  if (gumValue === '--') {
    return null;
  }

  return {
    audio: gumValue.includes('A'),
    video: gumValue.includes('V'),
  };
}

export async function getUserVideoTrack(navigator) {
  const [vTrack] = await navigator.mediaDevices
    .getUserMedia({ video: true })
    .then(stream => stream.getTracks());
  return vTrack;
}
export async function getUserAudioTrack(navigator) {
  const [aTrack] = await navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(stream => stream.getTracks());
  return aTrack;
}
export async function getDisplayVideoTrack(navigator) {
  const [vTrack] = await navigator.mediaDevices
    .getDisplayMedia({ video: true })
    .then(stream => stream.getTracks());
  return vTrack;
}

export function logPeerEvent(peer) {
  [
    'open',
    'call',
    'close',
    'connection',
    'disconnected',
    'expiresin',
    'error',
  ].forEach(ev => {
    peer.on(ev, arg => console.log(`Peer@${ev}`, arg));
  });
}

export function logMediaConnectionEvent(mc) {
  ['stream', 'close', 'error'].forEach(ev => {
    mc.on(ev, arg => console.log(`MediaConnection@${ev}`, arg));
  });
}

export function logDataConnectionEvent(dc) {
  ['open', 'data', 'close', 'error'].forEach(ev => {
    dc.on(ev, arg => console.log(`DataConnection@${ev}`, arg));
  });
}

export function logMeshRoomEvent(room) {
  [
    'open',
    'peerJoin',
    'peerLeave',
    'log',
    'stream',
    'data',
    'close',
    'error',
  ].forEach(ev => {
    room.on(ev, arg => console.log(`MeshRoom@${ev}`, arg));
  });
}

export function logSfuRoomEvent(room) {
  [
    'open',
    'peerJoin',
    'peerLeave',
    'log',
    'stream',
    'data',
    'close',
    'error',
  ].forEach(ev => {
    room.on(ev, arg => console.log(`SfuRoom@${ev}`, arg));
  });
}
