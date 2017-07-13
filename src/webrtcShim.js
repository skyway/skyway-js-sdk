// depends on platform, you have to change the setting of object 'RNWebRTC'.

const RNWebRTC = {}; // for generic browser
//  const RNWebRTC = require('react-native-webrtc');   // for react-native

module.exports.RTCSessionDescription = window.RTCSessionDescription ||
  window.mozRTCSessionDescription || RNWebRTC.RTCSessionDescription;

module.exports.RTCPeerConnection = window.RTCPeerConnection ||
  window.mozRTCPeerConnection || window.webkitRTCPeerConnection ||
  RNWebRTC.RTCPeerConnection;

module.exports.RTCIceCandidate = window.RTCIceCandidate ||
  window.mozRTCIceCandidate || RNWebRTC.RTCIceCandidate;
