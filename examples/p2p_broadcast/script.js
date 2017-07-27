// Compatibility shim
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
// Peer object
var peer = new Peer({
  key: window.__SKY_WAY_KEY__,
  debug: 3
});

peer.on('open', function(){
  $('#my-id').text(peer.id);
});

// Receiving a call
peer.on('call', function(call){
  // Answer the call automatically (instead of prompting user) for demo purposes
  call.answer(window.localStream);
});

peer.on('error', function(err){
  alert(err.message);
});

// Click handlers setup
$(function(){
  $('#broadcast').submit(function(e){
    e.preventDefault();
    navigator.getUserMedia({audio: true, video: true}, function(stream){
      // Set your video displays. Don't use srcObject because it can sometimes corrupt the mediaStream in Chrome 56+.
      $('#my-video').get(0).src = URL.createObjectURL(stream);
      window.localStream = stream;
    }, function(){ $('#step1-error').show(); });
  });
  $('#watch').submit(function(e){
    e.preventDefault();
    // Initiate a call!
    console.log($('#callto-id').val());
    var call = peer.call($('#callto-id').val());
    showBroadcast(call);
  });
});

function showBroadcast (call) {
  // Wait for stream on the call, then set peer video display
  call.on('stream', function(stream){
    $('#video').get(0).srcObject = stream;
  });
  call.on('close', function() {
    console.log('connection closed');
  });
}
