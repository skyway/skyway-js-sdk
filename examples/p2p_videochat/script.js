// Compatibility shim
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// Peer object
var peer = new Peer({
  key: window.__SKY_WAY_KEY__,
  debug: 3
});
window.peer = peer;
peer.on('open', function(){
  $('#my-id').text(peer.id);
});
// Receiving a call
peer.on('call', function(call){
  // Answer the call automatically (instead of prompting user) for demo purposes
  call.answer(window.localStream);
  step3(call);
});
peer.on('error', function(err){
  alert(err.message);
  // Return to step 2 if error occurs
  step2();
});
// Click handlers setup
$(function(){
  $('#make-call').submit(function(e){
    e.preventDefault();
    // Initiate a call!
    console.log($('#callto-id').val())
    var call = peer.call($('#callto-id').val(), window.localStream);
    step3(call);
  });
  $('#end-call').click(function(){
    window.existingCall.close();
    step2();
  });
  // Retry if getUserMedia fails
  $('#step1-retry').click(function(){
    $('#step1-error').hide();
    step1();
  });
  // Get things started
  step0();
});

function step0 () {
  // set up audio and video input selectors
  var audioSelect = $('#audioSource');
  var videoSelect = $('#videoSource');
  var selectors = [audioSelect, videoSelect];

  navigator.mediaDevices.enumerateDevices()
    .then(function(deviceInfos) {
      var values = selectors.map(function(select) {
        return select.val() || '';
      });
      selectors.forEach(function(select) {
        const children = select.children(':first');
        while (children.length) {
          select.remove(children);
        }
      });

      for (var i = 0; i !== deviceInfos.length; ++i) {
        var deviceInfo = deviceInfos[i];
        var option = $('<option>');
        option.val(deviceInfo.deviceId);
        if (deviceInfo.kind === 'audioinput') {
          option.text(deviceInfo.label ||
            'Microphone ' + (audioSelect.children().length + 1));
          audioSelect.append(option);
        } else if (deviceInfo.kind === 'videoinput') {
          option.text(deviceInfo.label || 'Camera ' +
            (videoSelect.children().length + 1));
          videoSelect.append(option);
        }
      }
      selectors.forEach(function(select, selectorIndex) {
        if (Array.prototype.slice.call(select.children()).some(function(n) {
            return n.value === values[selectorIndex];
          })) {
          select.val(values[selectorIndex]);
        }
      });

      videoSelect.on('change', step1);
      audioSelect.on('change', step1);

      step1();
    });
}

function step1 () {
  // Get audio/video stream
  var audioSource = $('#audioSource').val();
  var videoSource = $('#videoSource').val();
  var constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
      $('#my-video').get(0).srcObject = stream;
      window.localStream = stream;

      if (window.existingCall) {
        window.existingCall.replaceStream(stream);
        return;
      }

      step2();
    }, function(err){
      $('#step1-error').show();
      console.error(err);
    });
}
function step2 () {
  $('#step1, #step3').hide();
  $('#step2').show();
  $('#callto-id').focus();
}
function step3 (call) {
  // Hang up on an existing call if present
  if (window.existingCall) {
    window.existingCall.close();
  }
  // Wait for stream on the call, then set peer video display
  call.on('stream', function(stream){
    $('#their-video').get(0).srcObject = stream;
  });
  // UI stuff
  window.existingCall = call;
  $('#their-id').text(call.remoteId);
  call.on('close', step2);
  $('#step1, #step2').hide();
  $('#step3').show();
}
