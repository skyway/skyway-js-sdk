import Enum from 'enum';

const DISPATCHER_HOST = 'dispatcher.webrtc.ecl.ntt.com';
const DISPATCHER_PORT = 443;
const DISPATCHER_SECURE = true;
const DISPATCHER_TIMEOUT = 10000;

const TURN_HOST = 'turn.webrtc.ecl.ntt.com';
const TURN_PORT = 443;

const MESSAGE_TYPES = {
  CLIENT: new Enum([
    'SEND_OFFER',
    'SEND_ANSWER',
    'SEND_CANDIDATE',
    'SEND_LEAVE',
    'ROOM_JOIN',
    'ROOM_LEAVE',
    'ROOM_GET_LOGS',
    'ROOM_GET_USERS',
    'ROOM_SEND_DATA',
    'SFU_GET_OFFER',
    'SFU_ANSWER',
    'SFU_CANDIDATE',
    'PING',
    'UPDATE_CREDENTIAL',
  ]),
  SERVER: new Enum([
    'OPEN',
    'ERROR',
    'OFFER',
    'ANSWER',
    'CANDIDATE',
    'LEAVE',
    'AUTH_EXPIRES_IN',
    'ROOM_LOGS',
    'ROOM_USERS',
    'ROOM_DATA',
    'ROOM_USER_JOIN',
    'ROOM_USER_LEAVE',
    'SFU_OFFER',
  ]),
};

// Current recommended maximum chunksize is 16KB (DataChannel spec)
// https://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-13
// The actual chunk size is adjusted in dataChannel to accomodate metaData
const maxChunkSize = 16300;

// Number of reconnection attempts to the same server before giving up
const reconnectionAttempts = 2;

// Number of times to try changing servers before giving up
const numberServersToTry = 3;

// Send loop interval in milliseconds
const sendInterval = 1;

// Ping interval in milliseconds
const pingInterval = 25000;

const defaultConfig = {
  iceServers: [
    {
      urls: 'stun:stun.webrtc.ecl.ntt.com:3478',
      url: 'stun:stun.webrtc.ecl.ntt.com:3478',
    },
  ],
  iceTransportPolicy: 'all',
};

export default {
  DISPATCHER_HOST,
  DISPATCHER_PORT,
  DISPATCHER_SECURE,
  DISPATCHER_TIMEOUT,
  TURN_HOST,
  TURN_PORT,
  MESSAGE_TYPES,
  maxChunkSize,
  reconnectionAttempts,
  numberServersToTry,
  sendInterval,
  pingInterval,
  defaultConfig,
};
