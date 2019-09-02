const { localStorage } = window;

export function setState(key, value) {
  localStorage.setItem(key, value);
}

export function getState(key) {
  return localStorage.getItem(key);
}

export function getPeerOptions() {
  const apiKey = localStorage.getItem('__SKYWAY_TESTER_KEY__');
  const signUrl = localStorage.getItem('__SKYWAY_TESTER_SIGN__');
  const forceTurn = localStorage.getItem('__SKYWAY_TESTER_TURN__') === 'true';

  const peerOptions = {
    key: apiKey,
  };

  // custom signaling server url for dev
  if (signUrl) {
    const { host, protocol } = new URL(signUrl);
    Object.assign(peerOptions, {
      host,
      port: protocol === 'https:' ? 443 : 80,
      secure: protocol === 'https:',
    });
  }

  // force to use relay candidates only
  if (forceTurn) {
    Object.assign(peerOptions, {
      config: {
        iceTransportPolicy: 'relay',
      },
    });
  }

  return peerOptions;
}
