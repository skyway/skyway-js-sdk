'use strict';

const util           = require('./util');

const EventEmitter = require('events');
const Enum         = require('enum');

const shim              = require('../src/webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const SFURoomEvents = new Enum([
  'stream',
  'open',
  'close',
  'peerJoin',
  'peerLeave',
  'error',
  'data'
]);

const SFURoomMessageEvents = new Enum([
  'offer_request',
  'broadcast',
  'leave',
  'answer'
]);

/** Class to handle SFU related operations.  */
class SFURoom extends EventEmitter {
  /**
   * Create a SFURoom. Should not be called by the user.
   * @param {string} name - Room name.
   * @param {Object} options - @@@.
   */
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

  /**
   * Send Offer request message to SFU server.
   * @param {MediaStream} stream - A media stream.
   * @param {Object} options - @@@@.
   */
  callRoom(stream, options) {
    if (!stream) {
      util.error(
        'To call a peer, you must provide ' +
        'a stream from your browser\'s `getUserMedia`.'
      );
      return null;
    }

    this.localStream = stream;

    const data = {
      roomName:    this.name,
      roomOptions: this._options
    };

    this.emit(SFURoom.MESSAGE_EVENTS.offer_request.key, data);
  }

  /**
   * Handles Offer message from SFU server.
   * @param {Object} offer - Offer SDP from SFU server.
   */
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

  /**
   * Handles Join message from SFU server.
   * @param {Object} message - Message from SFU server.
   */
  handleJoin(message) {
    const src = message.src;

    if (src === this._peerId) {
      this.open = true;
      this.emit(SFURoom.EVENTS.open.key);

      // At this stage the Server has acknowledged us joining a room
      return;
    }

    this.members.push(src);
    this.emit(SFURoom.EVENTS.peerJoin.key, src);
  }

  /**
   * Handles Leave message from SFU server.
   * @param {Object} message - Message from SFU server.
   */
  handleLeave(message) {
    if (!this.open) {
      return;
    }

    const src = message.src;

    const index = this.members.indexOf(src);
    this.members.splice(index, 1);
    this.emit(SFURoom.EVENTS.peerLeave.key, src);
  }

  /**
   * Handles Leave message from SFU server.
   * @param {Object} message - Message from SFU server.
   */
  handleData(message) {
    this.emit(SFURoom.EVENTS.data.key, message);
  }

  /**
   * Sends data to all participants in the Room.
   * @param {Object} data - Data to send.
   */
  send(data) {
    if (!this.open) {
      return;
    }

    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(SFURoom.MESSAGE_EVENTS.broadcast.key, message);
  }

  /**
   * Close
   */
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
    this.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);
    this.emit(SFURoom.EVENTS.close.key);
  }

  _setupPCListeners() {
    this._pc.onaddstream = evt => {
      util.log('Received remote media stream');
      const remoteStream = evt.stream;

      // TODO: filter out unnecessary streams (streamUpdated()?)
      this.remoteStreams[remoteStream.id] = remoteStream;
      this.emit(SFURoom.EVENTS.stream.key, remoteStream);
    };

    this._pc.onicecandidate = evt => {
      if (!evt.candidate) {
        util.log('ICE canddidates gathering complete');
        this._pc.onicecandidate = () => {};
        const answerMessage = {
          roomName: this.name,
          answer:   this._pc.localDescription
        };
        this.emit(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage);
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
  
  /**
   * EVENTS
   */
  static get EVENTS() {
    return SFURoomEvents;
  }

  /**
   * MESSAGE_EVENTS
   */
  static get MESSAGE_EVENTS() {
    return SFURoomMessageEvents;
  }
}

module.exports = SFURoom;
