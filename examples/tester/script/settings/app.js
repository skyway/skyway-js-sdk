import { setState, getState } from '../state.js';

export default function($c) {
  const $apiKey = $c.querySelector('[data-api-key]');
  const $signUrl = $c.querySelector('[data-sign-url]');
  const $forceTurn = $c.querySelector('[data-force-turn]');
  const $meta = $c.querySelector('[data-meta]');
  const sdkSrc = document.querySelector('script[src*=skyway]');

  // track changes
  $apiKey.oninput = () => {
    setState('__SKYWAY_TESTER_KEY__', $apiKey.value);
  };
  $signUrl.oninput = () => {
    setState('__SKYWAY_TESTER_SIGN__', $signUrl.value);
  };
  $forceTurn.onchange = () => {
    setState('__SKYWAY_TESTER_TURN__', $forceTurn.checked);
  };

  // restore
  $apiKey.value = getState('__SKYWAY_TESTER_KEY__');
  $signUrl.value = getState('__SKYWAY_TESTER_SIGN__');
  $forceTurn.checked = getState('__SKYWAY_TESTER_TURN__') === 'true';

  $meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();
}
