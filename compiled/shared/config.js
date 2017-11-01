'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DISPATCHER_HOST = 'dispatcher.webrtc.ecl.ntt.com';
var DISPATCHER_PORT = 443;
var DISPATCHER_SECURE = true;
var DISPATCHER_TIMEOUT = 3000;

var TURN_HOST = 'turn.webrtc.ecl.ntt.com';
var TURN_PORT = 443;

var MESSAGE_TYPES = {
  CLIENT: new _enum2.default(['SEND_OFFER', 'SEND_ANSWER', 'SEND_CANDIDATE', 'SEND_LEAVE', 'ROOM_JOIN', 'ROOM_LEAVE', 'ROOM_GET_LOGS', 'ROOM_GET_USERS', 'ROOM_SEND_DATA', 'SFU_GET_OFFER', 'SFU_ANSWER', 'SFU_CANDIDATE', 'PING', 'UPDATE_CREDENTIAL']),
  SERVER: new _enum2.default(['OPEN', 'ERROR', 'OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE', 'AUTH_EXPIRES_IN', 'ROOM_LOGS', 'ROOM_USERS', 'ROOM_DATA', 'ROOM_USER_JOIN', 'ROOM_USER_LEAVE', 'SFU_OFFER'])
};

// Current recommended maximum chunksize is 16KB (DataChannel spec)
// https://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-13
// The actual chunk size is adjusted in dataChannel to accomodate metaData
var maxChunkSize = 16300;

// Number of reconnection attempts to the same server before giving up
var reconnectionAttempts = 2;

// Number of times to try changing servers before giving up
var numberServersToTry = 3;

// Send loop interval in milliseconds
var sendInterval = 1;

// Ping interval in milliseconds
var pingInterval = 25000;

var defaultConfig = {
  iceServers: [{
    urls: 'stun:stun.webrtc.ecl.ntt.com:3478',
    url: 'stun:stun.webrtc.ecl.ntt.com:3478'
  }],
  iceTransportPolicy: 'all'
};

exports.default = {
  DISPATCHER_HOST: DISPATCHER_HOST,
  DISPATCHER_PORT: DISPATCHER_PORT,
  DISPATCHER_SECURE: DISPATCHER_SECURE,
  DISPATCHER_TIMEOUT: DISPATCHER_TIMEOUT,
  TURN_HOST: TURN_HOST,
  TURN_PORT: TURN_PORT,
  MESSAGE_TYPES: MESSAGE_TYPES,
  maxChunkSize: maxChunkSize,
  reconnectionAttempts: reconnectionAttempts,
  numberServersToTry: numberServersToTry,
  sendInterval: sendInterval,
  pingInterval: pingInterval,
  defaultConfig: defaultConfig
};