export function getPeerOptions(state) {
  const apiKey = state.get('apiKey');
  const signUrl = state.get('signUrl');
  const forceTurn = state.get('forceTurn');

  const peerOptions = {
    key: apiKey,
  };

  // custom signaling server url for dev
  if (signUrl !== '') {
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
