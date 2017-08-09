// Compatibility shim
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// Peer object
var peer = new Peer({
  key: window.__SKY_WAY_KEY__,
  debug: 3
});
var room;
peer.on('open', function(){
  $('#my-id').text(peer.id);

  // Get things started
  step1();
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
    var roomName = $('#join-room').val();
    if (!roomName) {
      return;
    }
    room = peer.joinRoom('mesh_video_' + roomName, {stream: window.localStream});

    $('#room-id').text(roomName);
    step3(room);
  });
  $('#end-call').click(function(){
    room.close();
    step2();
  });
  // Retry if getUserMedia fails
  $('#step1-retry').click(function(){
    $('#step1-error').hide();
    step1();
  });
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

    if (room) {
      room.replaceStream(stream);
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
  $('#join-room').focus();
}
function step3 (room) {
  // Wait for stream on the call, then set peer video display
  room.on('stream', function(stream){
    const peerId = stream.peerId;

    $('#their-videos').append($(
      '<div class="video_' + peerId +'" id="video_' + peerId + '_' + stream.id.replace('{', '').replace('}', '') + '">' +
        '<label>' + stream.peerId + ':' + stream.id + '</label>' +
        '<video autoplay class="remoteVideos">' +
      '</div>'));
    $('#video_' + peerId + '_' + stream.id.replace('{', '').replace('}', '')).find("video").get(0).srcObject = stream;
  });

  room.on('removeStream', function(stream) {
    const peerId = stream.peerId;
    $('#video_' + peerId + '_' + stream.id.replace('{', '').replace('}', '')).remove();
  });

  // UI stuff
  room.on('close', step2);
  room.on('peerLeave', function(peerId){
    $('.video_' + peerId).remove();
  });
  $('#step1, #step2').hide();
  $('#step3').show();
}
