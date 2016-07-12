'use strict';

const util            = require('./util');
const Enum            = require('enum');
const Room            = require('./room');
const Connection      = require('./connection');
const MediaConnection = require('./mediaConnection');
const DataConnection = require('./dataConnection');

const Events = [
  'call'
];

const MessageEvents = [
  'broadcastByWS',
  'broadcastByDC',
  'getPeers'
];

const MeshEvents = new Enum(Events);
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
   */
  constructor(name, peerId, options) {
    super(name, peerId, options);

    this._pcConfig = this._options.pcConfig;

    this.connections = {};
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
      type:     'media'
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
      type:     'data'
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * Start video call to all participants in the room.
   * @param {Array} peerIds - Array of peerIds you are calling to.
   * @param {Object} [options] - Optional arguments for the MediaConnection.
   */
  makeMCs(peerIds, options = {}) {
    options.stream = this._localStream;

    peerIds.forEach(peerId => {
      if (this._peerId !== peerId) {
        const mc = new MediaConnection(peerId, options);
        util.log('MediaConnection to ${peerId} created in makeMCs method');
        this._addConnection(peerId, mc);
        this._setupMessageHandlers(mc);
      }
    });
  }

  /**
   * Start data connection to all participants in the room.
   * @param {Array} peerIds - Array of peerIds you are calling to.
   * @param {Object} [options] - Optional arguments for the DataConnection.
   */
  makeDCs(peerIds, options = {}) {
    for (let i = 0; i < peerIds.length; i++) {
      let peerId = peerIds[i];
      if (this._peerId !== peerId) {
        const dc = new DataConnection(peerId, options);
        util.log('DataConnection created in makeDCs method');
        this._addConnection(peerId, dc);
        this._setupMessageHandlers(dc);
      }
    }
  }

  /**
   * Add a connection to room's connections property.
   * @param {string} peerId - User's peerID.
   * @param {MediaConnection|DataConnection} connection - An instance of MediaConneciton or DataConnection.
   * @private
   */
  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);
  }

  /**
   * Delete a connections according to given peerId.
   * @param {string} peerId - An id of the peer that will be deleted.
   * @private
   */
  _deleteConnections(peerId) {
    if (this.connections[peerId]) {
      delete this.connections[peerId];
    }
  }

  /**
   * Set up connection event and message handlers.
   * @param {MediaConnection|DataConnection} connection - An instance of MediaConneciton or DataConnection.
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
    connection.on(MediaConnection.EVENTS.stream.key, remoteStream => {
      remoteStream.peerId = this._msidMap[remoteStream.id];
      this.emit(Room.EVENTS.stream.key, remoteStream);
    });
  }

  /**
   * Return a connection according to given peerId and connectionId.
   * @param {string} peerId - User's PeerId.
   * @param {string} connectionId - An ID to uniquely identify the connection.
   * @return  {Connection} A connection according to given peerId and connectionId.
   * @private
   */
  _getConnection(peerId, connectionId) {
    if (this.connections && this.connections[peerId]) {
      let conn = this.connections[peerId].filter(connection => {
        return connection.id === connectionId;
      });
      return conn[0];
    }
    return null;
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
      this.emit(MeshRoom.EVENTS.open.key);
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
      util.warn('Offer received for existing Connection ID:', connectionId);
      return;
    }

    if (offerMessage.connectionType === 'media') {
      connection = new MediaConnection(
        offerMessage.src,
        {
          connectionId: connectionId,
          payload:      offerMessage,
          metadata:     offerMessage.metadata,
          pcConfig:     this._pcConfig
        }
      );
      util.log('MediaConnection created in OFFER');
      this._addConnection(offerMessage.src, connection);
      this._setupMessageHandlers(connection);

      this.emit(MeshRoom.EVENTS.call.key, connection);
    } else {
      util.warn('Received malformed connection type: ', offerMessage.connectionType);
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
    }
  }

  updateMsidMap(peerId, sdp) {
    if (sdp) {
      const msid = sdp.split(/WMS /)[1].split('m=')[0].replace(/[\n\r]+$/g, '');
      this._msidMap[msid] = peerId;
    }
  }

  /**
   * Send data to all participants in the room with WebSocket.
   * It emits broadcastByWS event.
   * @param {*} data - The data to send.
   */
  sendByWS(data) {
    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.broadcastByWS.key, message);
  }

  /**
   * Send data to all participants in the room with DataChannel.
   * It emits broadcastByDC event.
   * @param {*} data - The data to send.
   */
  sendByDC(data) {
    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.broadcastByDC.key, message);
  }

  /**
   * Close all connections in the room.
   */
  close() {
    for (let peerId in this.connections) {
      if (this.connections.hasOwnProperty(peerId)) {
        this.connections[peerId].forEach(connection => {
          connection.close();
        });
      }
    }
    const message = {
      roomName: this.name
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.leave.key, message);
    this.emit(MeshRoom.EVENTS.close.key);
  }

  /**
   * Events the MeshRoom class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return MeshEvents;
  }

  /**
   * Offer SDP received and MediaConnection instance created event.
   *
   * @event MeshRoom#call
   * @type {MediaConnection}
   */

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

module.exports = MeshRoom;
