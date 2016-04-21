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
  'data'
]);

const RoomMessageEvents = new Enum([
  'broadcast',
  'leave',
  'answer'
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
      console.log('Joined room ' + this.name + '.');

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

  close() {
    if (!this.open) {
      return;
    }

    const message = {
      roomName: this.name
    };
    this.emit(Room.MESSAGE_EVENTS.leave.key, message);
    this.emit(Room.EVENTS.close.key);
  }

  //
  // Handle JVB related events
  //
  handleOffer(offer) {
    // Handle JVB Offer and send Answer to Server
    console.log('RoomConnection setting offer', offer);
    let description = new RTCSessionDescription({type: 'offer', sdp: offer});
    if (this._pc) {
      this._pc.setRemoteDescription(description, () => {
        console.log('done setRemoteDescription');
        this._pc.createAnswer(answer => {
          console.log('done createAnswer');
          this._pc.setLocalDescription(answer, () => {
            console.log('done setLocalDescription');
          });
        });
      });
    } else {
      console.log('new RTCPeerConnection');
      this._pc = new RTCPeerConnection(this._options.pcConfig);

      this._setupPCListeners();

      if (this.localStream) {
        this._pc.addStream(this.localStream);
      }

      this._pc.setRemoteDescription(description, () => {
        this._pc.createAnswer(answer => {
          this._pc.setLocalDescription(answer, () => {
            // this.emit(Room.MESSAGE_EVENTS.answer.key, answer);
          });
        });
      });
    }
  }

  _setupPCListeners() {
    this._pc.onaddstream = remoteStream => {
      util.log('Received remote media stream');

      // TODO: filter out unnecessary streams (streamUpdated()?)
      // TODO: Is this id correct?
      this.remoteStreams[remoteStream.id] = remoteStream;
      this.emit('stream', remoteStream);
    };

    this._pc.onicecandidate = evt => {
      if (!evt.candidate) {
        util.log('ICE canddidates gathering complete');
        this._pc.onicecandidate = () => {};
        this.emit(Room.MESSAGE_EVENTS.answer.key, this._pc.localDescription.sdp);
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
