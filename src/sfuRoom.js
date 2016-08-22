'use strict';

const Room       = require('./room');
const Negotiator = require('./negotiator');
const util       = require('./util');

const Enum = require('enum');

const MessageEvents = [
  'offerRequest'
];

const SFUEvents = new Enum([]);
SFUEvents.extend(Room.EVENTS.enums);
const SFUMessageEvents = new Enum(MessageEvents);
SFUMessageEvents.extend(Room.MESSAGE_EVENTS.enums);

/**
 * Class that manages SFU type room.
 * @extends Room
 */
class SFURoom extends Room {
  /**
   * Creates a SFU type room.
   * @param {string} name - Room name.
   * @param {string} peerId - peerId - User's peerId.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {MediaStream} [options.stream] - The MediaStream to send to the remote peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   */
  constructor(name, peerId, options) {
    super(name, peerId, options);

    this.remoteStreams = {};
    this.members = [];

    this._open = false;
    this._msidMap = {};
    this._unknownStreams = {};

    this._negotiator = new Negotiator();
  }

  /**
   * Send Offer request message to SFU server.
   * @param {MediaStream} [stream] - A media stream to send.
   */
  call(stream) {
    if (stream) {
      this._localStream = stream;
    }

    const data = {
      roomName: this.name
    };

    this.emit(SFURoom.MESSAGE_EVENTS.offerRequest.key, data);
  }

  /**
   * Handles Offer message from SFU server.
   * It create new RTCPeerConnection object.
   * @param {Object} offer - Offer SDP from SFU server.
   */
  handleOffer(offer) {
    // Handle SFU Offer and send Answer to Server
    if (this._connectionStarted) {
      this._negotiator.handleOffer(offer);
    } else {
      this._negotiator.startConnection({
        type:     'media',
        stream:   this._localStream,
        pcConfig: this._options.pcConfig,
        offer:    offer
      });
      this._setupNegotiatorMessageHandlers();
      this._connectionStarted = true;
    }
  }

  /**
   * Handle messages from the negotiator.
   * @private
   */
  _setupNegotiatorMessageHandlers() {
    this._negotiator.on(Negotiator.EVENTS.addStream.key, stream => {
      const remoteStream = stream;

      if (this._msidMap[remoteStream.id]) {
        remoteStream.peerId = this._msidMap[remoteStream.id];

        if (remoteStream.peerId === this._peerId) {
          return;
        }
        this.remoteStreams[remoteStream.id] = remoteStream;
        this.emit(SFURoom.EVENTS.stream.key, remoteStream);

        util.log(`Received remote media stream for ${remoteStream.peerId} in ${this.name}`);
      } else {
        this._unknownStreams[remoteStream.id] = remoteStream;
      }
    });

    this._negotiator.on(Negotiator.EVENTS.removeStream.key, stream => {
      delete this.remoteStreams[stream.id];
      delete this._msidMap[stream.id];
      delete this._unknownStreams[stream.id];

      this.emit(SFURoom.EVENTS.removeStream.key, stream);
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidatesComplete.key, answer => {
      const answerMessage = {
        roomName: this.name,
        answer:   answer
      };
      this.emit(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage);
    });

    this._negotiator.on(Negotiator.EVENTS.iceConnectionDisconnected.key, () => {
      this.close();
    });
  }

  /**
   * Handles Join message from SFU server.
   * It emits peerJoin event and if the message contains user's peerId, also emits open event.
   * @param {Object} joinMessage - Message object.
   * @param {string} joinMessage.src - The peerId of the peer that joined.
   * @param {string} joinMessage.roomName - The name of the joined room.
   */
  handleJoin(joinMessage) {
    const src = joinMessage.src;

    if (src === this._peerId) {
      this._open = true;
      this.emit(SFURoom.EVENTS.open.key);

      // At this stage the Server has acknowledged us joining a room
      return;
    }

    this.members.push(src);
    this.emit(SFURoom.EVENTS.peerJoin.key, src);
  }

  /**
   * Handles Leave message from SFU server.
   * It emits peerLeave message.
   * @param {Object} leaveMessage - Message from SFU server.
   */
  handleLeave(leaveMessage) {
    if (!this._open) {
      return;
    }

    const src = leaveMessage.src;

    const index = this.members.indexOf(src);
    if (index >= 0) {
      this.members.splice(index, 1);
    }

    this.emit(SFURoom.EVENTS.peerLeave.key, src);
  }

  /**
   * Send data to all participants in the room with WebSocket.
   * It emits broadcast event.
   * @param {*} data - The data to send.
   */
  send(data) {
    if (!this._open) {
      return;
    }

    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(SFURoom.MESSAGE_EVENTS.broadcast.key, message);
  }

  /**
   * Close PeerConnection and emit leave and close event.
   */
  close() {
    if (!this._open) {
      return;
    }

    if (this._negotiator) {
      this._negotiator.cleanup();
    }

    this._open = false;

    const message = {
      roomName: this.name
    };
    this.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);
    this.emit(SFURoom.EVENTS.close.key);
  }

  /**
   * Update the entries in the msid to peerId map.
   * @param {Object} msids - Object with msids as the key and peerIds as the values.
   */
  updateMsidMap(msids = {}) {
    this._msidMap = msids;

    for (let msid of Object.keys(this._unknownStreams)) {
      if (this._msidMap[msid]) {
        const remoteStream = this._unknownStreams[msid];
        remoteStream.peerId = this._msidMap[remoteStream.id];

        delete this._unknownStreams[msid];

        if (remoteStream.peerId === this._peerId) {
          return;
        }

        this.remoteStreams[remoteStream.id] = remoteStream;
        this.emit(SFURoom.EVENTS.stream.key, remoteStream);
      }
    }
  }

  /**
   * Events the SFURoom class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return SFUEvents;
  }

  /**
   * Message events the MeshRoom class can emit.
   * @type {Enum}
   */
  static get MESSAGE_EVENTS() {
    return SFUMessageEvents;
  }

  /**
   * Send offer request to SkyWay server.
   *
   * @event MeshRoom#offerRequest
   * @type {object}
   * @property {string} roomName - The Room name.

   */

  /**
   * Send data to all peers in the room by WebSocket.
   *
   * @event MeshRoom#broadcast
   * @type {object}
   * @property {string} roomName - The Room name.
   * @property {*} data - The data to send.
   */
}

module.exports = SFURoom;
