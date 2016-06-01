'use strict';

const util           = require('./util');

const EventEmitter = require('events');
const Enum         = require('enum');

const shim              = require('../src/webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const RoomEvents = new Enum([
  'stream',
  'open',
  'close',
  'peerJoin',
  'peerLeave',
  'error',
  'data',
  'log'
]);

const RoomMessageEvents = new Enum([
  'broadcast',
  'leave',
  'answer',
  'getLog'
]);

class Room extends EventEmitter {
  constructor(name, options) {
    super();

    this.name = name;
    this._options = options || {};
    this._peerId = this._options.peerId;

    this.localStream = this._options._stream;
    this.remoteStreams = {};

    this._pcAvailable = false;

    this.open = false;
    this.members = [];
  }

  //
  // Handle socket.io related events
  //
  handleJoin(message) {
    const src = message.src;

    if (src === this._peerId) {
      this.open = true;
      this.emit(Room.EVENTS.open.key);

      // At this stage the Server has acknowledged us joining a room
      return;
    }

    this.members.push(src);
    this.emit(Room.EVENTS.peerJoin.key, src);
  }

  handleLeave(message) {
    if (!this.open) {
      return;
    }

    const src = message.src;

    const index = this.members.indexOf(src);
    this.members.splice(index, 1);
    this.emit(Room.EVENTS.peerLeave.key, src);
  }

  handleData(message) {
    this.emit(Room.EVENTS.data.key, message);
  }

  handleLog(message) {
    // Loop through and handle each in turn

    for (const jsonLog of message.log) {
      console.log(jsonLog);
      const log = JSON.parse(jsonLog);
      const src = log.message.src;

      if (log.messageType === util.MESSAGE_TYPES.ROOM_USER_JOIN.key) {
        this.members.push(src);

        this.emit(Room.EVENTS.peerJoin.key, src);
      } else if (log.messageType === util.MESSAGE_TYPES.ROOM_USER_LEAVE.key) {
        const index = this.members.indexOf(src);
        this.members.splice(index, 1);

        this.emit(Room.EVENTS.peerLeave.key, src);
      } else if (log.messageType === util.MESSAGE_TYPES.ROOM_DATA.key) {
        this.handleData(log.message);
      }
    }
  }

  send(data) {
    if (!this.open) {
      return;
    }

    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(Room.MESSAGE_EVENTS.broadcast.key, message);
  }

  getLog() {
    const message = {
      roomName: this.name
    };
    this.emit(Room.MESSAGE_EVENTS.getLog.key, message);
  }

  close() {
    if (!this.open) {
      return;
    }

    if (this._pc) {
      this._pc.close();
    }

    const message = {
      roomName: this.name
    };
    this.emit(Room.MESSAGE_EVENTS.leave.key, message);
    this.emit(Room.EVENTS.close.key);
  }

  handleOffer(offer) {
    // Handle SFU Offer and send Answer to Server
    let description = new RTCSessionDescription(offer);
    if (this._pc) {
      this._pc.setRemoteDescription(description, () => {
        this._pc.createAnswer(answer => {
          this._pc.setLocalDescription(answer,
            () => {},
            e => {
              util.error('Problem setting localDescription', e);
            });
        }, e => {
          util.error('Problem creating answer', e);
        });
      }, e => {
        util.error('Problem setting remote offer', e);
      });
    } else {
      this._pc = new RTCPeerConnection(this._options.pcConfig);

      this._setupPCListeners();

      if (this.localStream) {
        this._pc.addStream(this.localStream);
      }

      this._pc.setRemoteDescription(description, () => {
        this._pc.createAnswer(answer => {
          this._pc.setLocalDescription(answer,
            () => {},
            e => {
              util.error('Problem setting localDescription', e);
            });
        }, e => {
          util.error('Problem creating answer', e);
        });
      }, e => {
        util.error('Problem setting remote offer', e);
      });
    }
  }

  _setupPCListeners() {
    this._pc.onaddstream = evt => {
      util.log('Received remote media stream');
      const remoteStream = evt.stream;

      // TODO: filter out unnecessary streams (streamUpdated()?)
      this.remoteStreams[remoteStream.id] = remoteStream;
      this.emit(Room.EVENTS.stream.key, remoteStream);
    };

    this._pc.onicecandidate = evt => {
      if (!evt.candidate) {
        util.log('ICE canddidates gathering complete');
        this._pc.onicecandidate = () => {};
        const answerMessage = {
          roomName: this.name,
          answer:   this._pc.localDescription
        };
        this.emit(Room.MESSAGE_EVENTS.answer.key, answerMessage);
      }
    };

    this._pc.oniceconnectionstatechange = () => {
      switch (this._pc.iceConnectionState) {
        case 'new':
          util.log('iceConnectionState is new');
          break;
        case 'checking':
          util.log('iceConnectionState is checking');
          break;
        case 'connected':
          util.log('iceConnectionState is connected');
          break;
        case 'completed':
          util.log('iceConnectionState is completed');
          break;
        case 'failed':
          util.log('iceConnectionState is failed, closing connection');
          break;
        case 'disconnected':
          util.log('iceConnectionState is disconnected, closing connection');
          break;
        case 'closed':
          util.log('iceConnectionState is closed');
          break;
        default:
          break;
      }
    };

    this._pc.onremovestream = () => {
      util.log('`removestream` triggered');
    };

    this._pc.onsignalingstatechange = () => {
      switch (this._pc.signalingState) {
        case 'stable':
          util.log('signalingState is stable');
          break;
        case 'have-local-offer':
          util.log('signalingState is have-local-offer');
          break;
        case 'have-remote-offer':
          util.log('signalingState is have-remote-offer');
          break;
        case 'have-local-pranswer':
          util.log('signalingState is have-local-pranswer');
          break;
        case 'have-remote-pranswer':
          util.log('signalingState is have-remote-pranswer');
          break;
        case 'closed':
          util.log('signalingState is closed');
          break;
        default:
          break;
      }
    };

    return this._pc;
  }
  static get EVENTS() {
    return RoomEvents;
  }

  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }
}

module.exports = Room;
