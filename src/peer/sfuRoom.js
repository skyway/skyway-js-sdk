import Enum from 'enum';

import Room from './room';
import Negotiator from './negotiator';
import logger from '../shared/logger';
import sdpUtil from '../shared/sdpUtil';
import util from '../shared/util';

const MessageEvents = ['offerRequest', 'candidate'];

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
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
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
      roomName: this.name,
    };

    this.emit(SFURoom.MESSAGE_EVENTS.offerRequest.key, data);
  }

  /**
   * Handles Offer message from SFU server.
   * It create new RTCPeerConnection object.
   * @param {object} offerMessage - Message object containing Offer SDP.
   * @param {object} offerMessage.offer - Object containing Offer SDP text.
   */
  handleOffer(offerMessage) {
    let offer = offerMessage.offer;

    /**
     * Our SFU returns unified-plan SDP.
     * Our support browsers and sdp semantics relations are
     *
     * Chrome: unified-plan
     * Firefox: unified-plan
     * Safari 12.1~: plan-b
     * Safari 12.1~: unified-plan(if user enables)
     * Safari 12.1.1~: unified-plan
     *
     * So we need to convert server offer SDP for plan-b Safari
     * We don't need to convert the answer back to Unified Plan because the server can handle Plan B.
     */
    if (util.isPlanBSafari()) {
      offer = sdpUtil.unifiedToPlanB(offer);
    }

    // Handle SFU Offer and send Answer to Server
    if (this._connectionStarted) {
      this._negotiator.handleOffer(offer);
    } else {
      this._negotiator.startConnection({
        type: 'media',
        stream: this._localStream,
        pcConfig: this._options.pcConfig,
        offer: offer,
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

        // return if the remoteStream's peerID is my peerID
        if (remoteStream.peerId === this._peerId) {
          return;
        }

        // return if the cachedStream which we will add already exists
        const cachedStream = this.remoteStreams[remoteStream.id];
        if (cachedStream && cachedStream.id === remoteStream.id) {
          return;
        }
        this.remoteStreams[remoteStream.id] = remoteStream;
        this.emit(SFURoom.EVENTS.stream.key, remoteStream);

        logger.log(
          `Received remote media stream for ${remoteStream.peerId} in ${this.name}`
        );
      } else {
        this._unknownStreams[remoteStream.id] = remoteStream;
      }
    });

    this._negotiator.on(Negotiator.EVENTS.negotiationNeeded.key, () => {
      // Renegotiate by requesting an offer then sending an answer when one is created.
      const offerRequestMessage = {
        roomName: this.name,
      };
      this.emit(SFURoom.MESSAGE_EVENTS.offerRequest.key, offerRequestMessage);
    });

    this._negotiator.on(Negotiator.EVENTS.answerCreated.key, answer => {
      // If we use unified-plan SDP and send it to our SFU,
      // of course it must be treated as unified-plan SDP too.
      // We need to ensure it for some reason.(see its implementation)
      if (!util.isPlanBSafari()) {
        answer.sdp = sdpUtil.ensureUnifiedPlan(answer.sdp);
      }

      const answerMessage = {
        roomName: this.name,
        answer: answer,
      };
      this.emit(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage);
    });

    this._negotiator.on(Negotiator.EVENTS.iceConnectionFailed.key, () => {
      this.close();
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
      const candidateMessage = {
        roomName: this.name,
        candidate: candidate,
      };
      this.emit(SFURoom.MESSAGE_EVENTS.candidate.key, candidateMessage);
    });
  }

  /**
   * Handles Join message from SFU server.
   * It emits peerJoin event and if the message contains user's peerId, also emits open event.
   * @param {Object} joinMessage - Message object.
   * @param {string} joinMessage.src - The peerId of the peer that joined.
   * @param {string} joinMessage.roomName - The name of the joined room.
   * @param {Array} joinMessage.roomMembers - Array of peerId string.
   */
  handleJoin(joinMessage) {
    const { src, roomMembers } = joinMessage;

    if (src === this._peerId) {
      this._open = true;

      // init w/ members already in room(ignore myself)
      this.members = roomMembers.filter(peerId => peerId !== src);

      this.call(this._localStream);
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

    // Delete leaving peer's streams
    for (const msid in this.remoteStreams) {
      if (this.remoteStreams[msid].peerId === src) {
        delete this.remoteStreams[msid];
        delete this._msidMap[msid];
        delete this._unknownStreams[msid];
      }
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
      data: data,
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
      roomName: this.name,
    };
    this.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);
    this.emit(SFURoom.EVENTS.close.key);
  }

  /**
   * Replace the stream being sent with a new one.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   */
  replaceStream(newStream) {
    this._localStream = newStream;
    this._negotiator.replaceStream(newStream);
  }

  /**
   * Update the entries in the msid to peerId map.
   * @param {Object} msids - Object with msids as the key and peerIds as the values.
   */
  updateMsidMap(msids = {}) {
    this._msidMap = msids;

    for (const msid of Object.keys(this._unknownStreams)) {
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
   * @event SFURoom#offerRequest
   * @type {object}
   * @property {string} roomName - The Room name.

   */

  /**
   * Send data to all peers in the room by WebSocket.
   *
   * @event SFURoom#broadcast
   * @type {object}
   * @property {string} roomName - The Room name.
   * @property {*} data - The data to send.
   */
}

export default SFURoom;
