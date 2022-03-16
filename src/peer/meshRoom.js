import Enum from 'enum';

import Room from './room';
import Connection from './connection';
import MediaConnection from './mediaConnection';
import DataConnection from './dataConnection';
import logger from '../shared/logger';
import config from '../shared/config';

const MessageEvents = ['broadcastByDC', 'getPeers'];

const MeshEvents = new Enum([]);
MeshEvents.extend(Room.EVENTS.enums);
const MeshMessageEvents = new Enum(MessageEvents);
MeshMessageEvents.extend(Room.MESSAGE_EVENTS.enums);

/**
 * Class that manages fullmesh type room.
 * @extends Room
 */
class MeshRoom extends Room {
  /**
   * Create a fullmesh room.
   * @param {string} name - Room name.
   * @param {string} peerId - User's peerId.
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

    this.connections = {};

    // messages(candidates) received before connection is ready
    this._queuedMessages = {};
  }

  /**
   * Called by client app to create MediaConnections.
   * It emit getPeers event for getting peerIds of all of room participant.
   * After getting peerIds, makeMCs is called.
   * @param {MediaStream} [stream] - The MediaStream to send to the remote peer.
   */
  call(stream) {
    if (stream) {
      this._localStream = stream;
    }

    const data = {
      roomName: this.name,
      type: 'media',
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * Called by client app to create DataConnections.
   * It emit getPeers event for getting peerIds of all of room participant.
   * After getting peerIds, makeDCs is called.
   */
  connect() {
    const data = {
      roomName: this.name,
      type: 'data',
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * Start video call to all participants in the room.
   * @param {Array} peerIds - Array of peerIds you are calling to.
   */
  makeMediaConnections(peerIds) {
    const options = {
      stream: this._localStream,
      pcConfig: this._pcConfig,
      originator: true,
      videoBandwidth: this._options.videoBandwidth,
      audioBandwidth: this._options.audioBandwidth,
      videoCodec: this._options.videoCodec,
      audioCodec: this._options.audioCodec,
      videoReceiveEnabled: this._options.videoReceiveEnabled,
      audioReceiveEnabled: this._options.audioReceiveEnabled,
    };

    this._makeConnections(peerIds, 'media', options);
  }

  /**
   * Start data connection to all participants in the room.
   * @param {Array} peerIds - Array of peerIds you are connecting to.
   */
  makeDataConnections(peerIds) {
    const options = {
      pcConfig: this._pcConfig,
    };

    this._makeConnections(peerIds, 'data', options);
  }

  /**
   * Handle join message from new participant in the room.
   * It emits peerJoin event and if the message contains user's peerId, also emits open event.
   * @param {Object} joinMessage - Message object.
   * @param {string} joinMessage.src - The peerId of the peer that joined.
   * @param {string} joinMessage.roomName - The name of the joined room.
   */
  handleJoin(joinMessage) {
    const src = joinMessage.src;
    if (src === this._peerId) {
      this.call(this._localStream);
      this.emit(MeshRoom.EVENTS.open.key);

      // At this stage the Server has acknowledged us joining a room
      return;
    }

    this.emit(MeshRoom.EVENTS.peerJoin.key, src);
  }

  /**
   * Handle leave message from other participant in the room.
   * It deletes connection from room's connections property and emits peerLeave event.
   * @param {Object} leaveMessage - Message object.
   * @param {string} leaveMessage.src - The peerId of the peer that left.
   * @param {string} leaveMessage.roomName - The name of the left room.
   */
  handleLeave(leaveMessage) {
    const src = leaveMessage.src;
    this._deleteConnections(src);
    this.emit(MeshRoom.EVENTS.peerLeave.key, src);
  }

  /**
   * Handle Offer message from new participant and create a Connection instance.
   * @param {object} offerMessage - Message object containing Offer SDP.
   * @param {object} offerMessage.offer - Object containing Offer SDP text.
   * @param {string} offerMessage.connectionId - An ID to uniquely identify the connection.
   * @param {string} offerMessage.connectionType - One of 'media' or 'data'.
   * @param {string} offerMessage.dst - The peerId of the peer who receiving the Offer.
   * @param {string} offerMessage.roomName - The name of the room user is joining.
   * @param {string} offerMessage.src - The peerId of the peer who sent the Offer.
   */
  handleOffer(offerMessage) {
    const connectionId = offerMessage.connectionId;
    let connection = this._getConnection(offerMessage.src, connectionId);

    if (connection) {
      connection.updateOffer(offerMessage);
      return;
    }

    if (offerMessage.connectionType === 'media') {
      if (this._hasConnection(offerMessage.src)) {
        // When two or more users join at the same time, they send each other an offer.
        // In order to prevent two connections between peerA and peerB, only the one with a small ID will be processed.
        if (this._peerId > offerMessage.src) return;
      }
      connection = new MediaConnection(offerMessage.src, {
        connectionId: connectionId,
        payload: offerMessage,
        metadata: offerMessage.metadata,
        queuedMessages: this._queuedMessages[connectionId],
        pcConfig: this._pcConfig,
      });
      connection.startConnection();

      logger.log('MediaConnection created in OFFER');
      this._addConnection(offerMessage.src, connection);
      this._setupMessageHandlers(connection);

      connection.answer(this._localStream, {
        videoBandwidth: this._options.videoBandwidth,
        audioBandwidth: this._options.audioBandwidth,
        videoCodec: this._options.videoCodec,
        audioCodec: this._options.audioCodec,
        videoReceiveEnabled: this._options.videoReceiveEnabled,
        audioReceiveEnabled: this._options.audioReceiveEnabled,
      });
    } else {
      logger.warn(
        `Received malformed connection type: ${offerMessage.connectionType}`
      );
    }
  }

  /**
   * Handle Answer message from participant in the room.
   * @param {object} answerMessage - Message object containing Answer SDP.
   * @param {object} answerMessage.answer - Object containing Answer SDP text.
   * @param {string} answerMessage.connectionId - An ID to uniquely identify the connection.
   * @param {string} answerMessage.connectionType - One of 'media' or 'data'.
   * @param {string} answerMessage.dst - The peerId of the peer who receiving the Answer.
   * @param {string} answerMessage.roomName - The name of the room user is joining.
   * @param {string} answerMessage.src - The peerId of the peer who sent the Answer.
   */
  handleAnswer(answerMessage) {
    const connection = this._getConnection(
      answerMessage.src,
      answerMessage.connectionId
    );

    if (connection) {
      connection.handleAnswer(answerMessage);
    }
  }

  /**
   * Handles Candidate message from participant in the room.
   * @param {object} candidateMessage - Message object containing Candidate SDP.
   * @param {object} candidateMessage.candidate - Object containing Candidate SDP text.
   * @param {string} candidateMessage.connectionId - An ID to uniquely identify the connection.
   * @param {string} candidateMessage.connectionType - One of 'media' or 'data'.
   * @param {string} candidateMessage.dst - The peerId of the peer who receiving the Candidate.
   * @param {string} candidateMessage.roomName - The name of the room user is joining.
   * @param {string} candidateMessage.src - The peerId of the peer who sent the Candidate.
   */
  handleCandidate(candidateMessage) {
    const connection = this._getConnection(
      candidateMessage.src,
      candidateMessage.connectionId
    );

    if (connection) {
      connection.handleCandidate(candidateMessage);
    } else {
      // Looks like PeerConnection hasn't completed setRemoteDescription
      if (this._queuedMessages[candidateMessage.connectionId] === undefined) {
        this._queuedMessages[candidateMessage.connectionId] = [];
      }
      this._queuedMessages[candidateMessage.connectionId].push({
        type: config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
        payload: candidateMessage,
      });
    }
  }

  /**
   * Send data to all participants in the room with WebSocket.
   * It emits broadcast event.
   * @param {*} data - The data to send.
   */
  send(data) {
    if (!this.validateSendDataSize(data)) {
      return;
    }
    const message = {
      roomName: this.name,
      data: data,
    };
    this._sendData(message, MeshRoom.MESSAGE_EVENTS.broadcast.key);
  }

  /**
   * Close all connections in the room.
   */
  close() {
    for (const peerId in this.connections) {
      if (this.connections.hasOwnProperty(peerId)) {
        this.connections[peerId].forEach(connection => {
          connection.close(false);
        });
      }
    }
    const message = {
      roomName: this.name,
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.leave.key, message);
    this.emit(MeshRoom.EVENTS.close.key);
  }

  /**
   * Replace the stream being sent on all MediaConnections   with a new one.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   */
  replaceStream(newStream) {
    this._localStream = newStream;
    for (const peerId in this.connections) {
      if (this.connections.hasOwnProperty(peerId)) {
        this.connections[peerId].forEach(connection => {
          if (connection.type === 'media') {
            connection.replaceStream(newStream);
          }
        });
      }
    }
  }

  /**
   * Get all of each peer's RTCPeerConnection.
   */
  getPeerConnections() {
    const peerConnections = {};
    for (const [peerId, [connection]] of Object.entries(this.connections)) {
      const pc = connection.getPeerConnection();
      if (pc) {
        peerConnections[peerId] = pc;
      }
    }
    return peerConnections;
  }

  /**
   * Append a connection to peer's array of connections, stored in room.connections.
   * @param {string} peerId - User's peerID.
   * @param {MediaConnection|DataConnection} connection - An instance of MediaConnection or DataConnection.
   * @private
   */
  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);
  }

  /**
   * Start connections and add handlers.
   * @param {Array} peerIds - Array of peerIds you are creating connections for.
   * @param {string} type - Either 'data' or 'media'.
   * @param {Object} options - Options to pass to the connection constructor.
   * @private
   */
  _makeConnections(peerIds, type, options) {
    peerIds
      .filter(peerId => {
        return peerId !== this._peerId;
      })
      .filter(peerId => {
        return !this._hasConnection(peerId);
      })
      .forEach(peerId => {
        let connection;

        switch (type) {
          case 'data':
            connection = new DataConnection(peerId, options);
            break;
          case 'media':
            connection = new MediaConnection(peerId, options);
            break;
          default:
            return;
        }

        connection.startConnection();
        this._addConnection(peerId, connection);
        this._setupMessageHandlers(connection);

        logger.log(`${type} connection to ${peerId} created in ${this.name}`);
      });
  }

  /**
   * Delete a connection according to given peerId.
   * @param {string} peerId - The id of the peer that will be deleted.
   * @private
   */
  _deleteConnections(peerId) {
    if (this.connections[peerId]) {
      this.connections[peerId].forEach(connection => {
        connection.close(false);
      });
      delete this.connections[peerId];
    }
  }

  /**
   * Return a connection according to given peerId and connectionId.
   * @param {string} peerId - User's PeerId.
   * @param {string} connectionId - An ID to uniquely identify the connection.
   * @return {Connection} A connection according to given peerId and connectionId.
   * @private
   */
  _getConnection(peerId, connectionId) {
    if (this.connections && this.connections[peerId]) {
      const conn = this.connections[peerId].filter(connection => {
        return connection.id === connectionId;
      });
      return conn[0];
    }
    return null;
  }

  /**
   * Return whether peer has already made a connection to 'peerId' or not
   * @param {string} peerId - User's PeerId.
   * @return {boolean} - Whether peer has already made a connection to 'peerId' or not
   * @private
   */
  _hasConnection(peerId) {
    return this.connections[peerId] && this.connections[peerId].length > 0;
  }

  /**
   * Set up connection event and message handlers.
   * @param {MediaConnection|DataConnection} connection - An instance of MediaConnection or DataConnection.
   * @private
   */
  _setupMessageHandlers(connection) {
    connection.on(Connection.EVENTS.offer.key, offerMessage => {
      offerMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage);
    });

    connection.on(Connection.EVENTS.answer.key, answerMessage => {
      answerMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage);
    });

    connection.on(Connection.EVENTS.candidate.key, candidateMessage => {
      candidateMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage);
    });

    if (connection.type === 'media') {
      connection.on(MediaConnection.EVENTS.stream.key, remoteStream => {
        remoteStream.peerId = connection.remoteId;
        this.emit(MeshRoom.EVENTS.stream.key, remoteStream);
      });
    }
  }

  /**
   * Events the MeshRoom class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return MeshEvents;
  }

  /**
   * Message events the MeshRoom class can emit.
   * @type {Enum}
   */
  static get MESSAGE_EVENTS() {
    return MeshMessageEvents;
  }

  /**
   * Get all peer's peerId joining in the room.
   * @event MeshRoom#getPeers
   * @type {object}
   * @property {string} roomName - The Room name.
   * @property {string} type - One of 'media' or 'data'.

   */

  /**
   * Send data to all peers in the room by WebSocket.
   *
   * @event MeshRoom#broadcastByWS
   * @type {object}
   * @property {string} roomName - The Room name.
   * @property {*} data - The data to send.
   */

  /**
   * Send data to all peers in the room by DataChannel.
   *
   * @event MeshRoom#broadcastByDC
   * @type {object}
   * @property {string} roomName - The Room name.
   * @property {*} data - The data to send.
   */
}

export default MeshRoom;
