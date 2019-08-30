const { localStorage } = window;

export default function renderSettings($c) {
  const $apiKey = $c.querySelector('[data-api-key]');
  const $signUrl = $c.querySelector('[data-sign-url]');
  const $forceTurn = $c.querySelector('[data-force-turn]');

  // track changes
  $apiKey.oninput = () => {
    localStorage.setItem('__SKYWAY_TESTER_KEY__', $apiKey.value);
  };
  $signUrl.oninput = () => {
    localStorage.setItem('__SKYWAY_TESTER_SIGN__', $signUrl.value);
  };
  $forceTurn.onchange = () => {
    localStorage.setItem('__SKYWAY_TESTER_TURN__', $forceTurn.checked);
  };

  // restore
  $apiKey.value = localStorage.getItem('__SKYWAY_TESTER_KEY__');
  $signUrl.value = localStorage.getItem('__SKYWAY_TESTER_SIGN__');
  $forceTurn.checked =
    localStorage.getItem('__SKYWAY_TESTER_TURN__') === 'true';
}
