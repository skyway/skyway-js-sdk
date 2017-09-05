/* eslint-disable require-jsdoc */
$(function() {
  // Peer object
  const peer = new Peer({
    key:   window.__SKYWAY_KEY__,
    debug: 3,
  });

  let localStream;

  peer.on('open', () => {
    $('#my-id').text(peer.id);
  });

  // Receiving a call
  peer.on('call', call => {
    // Answer the call automatically (instead of prompting user) for demo purposes
    call.answer(localStream);
  });

  peer.on('error', err => {
    alert(err.message);
  });

  // Click handlers setup
  $('#broadcast').on('submit', e => {
    e.preventDefault();
    navigator.mediaDevices.getUserMedia({audio: true, video: true}).then(stream => {
      $('#video').get(0).srcObject = stream;
      localStream = stream;
    }).catch(err => {
      $('#step1-error').show();
      console.error(err);
    });
  });

  $('#watch').on('submit', e => {
    e.preventDefault();
    // Initiate a call!
    console.log($('#callto-id').val());
    const call = peer.call($('#callto-id').val());

    // Wait for stream on the call, then set peer video display
    call.on('stream', stream => {
      const el = $('#video').get(0);
      el.srcObject = stream;
      el.play();
    });

    call.on('close', () => {
      console.log('connection closed');
    });
  });
});
