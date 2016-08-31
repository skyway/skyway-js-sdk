const RNWebRTC = require('react-native-webrtc');

module.exports.RTCSessionDescription = RNWebRTC.RTCSessionDescription;
module.exports.RTCPeerConnection     = RNWebRTC.RTCPeerConnection;
module.exports.RTCIceCandidate       = RNWebRTC.RTCIceCandidate;

//fixme: error happens while test.
// module.exports.RTCSessionDescription = window.RTCSessionDescription ||
//   window.mozRTCSessionDescription;
// module.exports.RTCPeerConnection = window.RTCPeerConnection ||
//   window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
// module.exports.RTCIceCandidate = window.RTCIceCandidate ||
//   window.mozRTCIceCandidate;
