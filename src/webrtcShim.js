if(window && window.navigator && window.navigator.userAgent === "react-native") {
  // when userAgent is react native.
  import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
  } from 'react-native-webrtc';

  module.exports.RTCSessionDescription = RTCSessionDescription;
  module.exports.RTCPeerConnection     = RTCPeerConnection;
  module.exports.RTCIceCandidate       = RTCIceCandidate;
} else {
  // when userAgent is generic browser. 
  module.exports.RTCSessionDescription = window.RTCSessionDescription ||
    window.mozRTCSessionDescription;
  module.exports.RTCPeerConnection = window.RTCPeerConnection ||
    window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  module.exports.RTCIceCandidate = window.RTCIceCandidate ||
    window.mozRTCIceCandidate;
}
