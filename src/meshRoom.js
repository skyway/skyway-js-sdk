'use strict';

const util            = require('./util');
const Enum            = require('enum');
const Room            = require('./room');
const Connection      = require('./connection');
const MediaConnection = require('./mediaConnection');

const Events = [
  'call'
];

const MessageEvents = [
  'broadcastByWS',
  'broadcastByDC',
  'getPeers'
];

Array.prototype.push.apply(Events, Room.Events);
const MeshEvents = new Enum(Events);
Array.prototype.push.apply(MessageEvents, Room.MessageEvents);
const MeshMessageEvents = new Enum(MessageEvents);

/**
 * Class that manages fullmesh type room.
 * @extends EventEmitter
 */
class MeshRoom extends Room {

  /**
   * Creates a fullmesh room.
   * @param {string} name - Room name.
   * @param {string} peerId - Room name.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {MediaStream} [options.localStream] - The MediaStream to send to the remote peer.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   */
  constructor(name, peerId, options) {
    super(name, peerId, options);

    this._pcConfig = this._options.pcConfig;
    this.remoteStreams = {};
    this.connections = {};
  }

  /**
   * This functions is called by client app.
   * It emit getPeers event for getting peerIds of all of room participant.
   * After getting peerIds, makeMCs is called.
   * @param {MediaStream} stream - The MediaStream to send to the remote peer.
   */
  call(stream) {
    if (!stream) {
      util.error(
        'To call a peer, you must provide ' +
        'a stream from your browser\'s `getUserMedia`.'
      );
    }

    this.localStream = stream;

    const data = {
      roomName: this.name,
      type:     'media'
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * This functions is called by client app.
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
  makeMCs(peerIds, options) {
    options = options || {};
    options.stream = this.localStream;
    options.localStream = this.localStream;

    peerIds.forEach(peerId => {
      if (this._peerId !== peerId) {
        const mc = new MediaConnection(peerId, options);
        util.log('MediaConnection to ${peerId} created in call method');
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
  makeDCs(peerIds, options) {
    options = options || {};
    options._stream = this.localStream;

    for (let i = 0; i < peerIds.length; i++) {
      let peerId = peerIds[i];
      if (this._peerId !== peerId) {
        const mc = new MediaConnection(peerId, options);
        util.log('MediaConnection created in call method');
        this._addConnection(peerId, mc);
        this._setupMessageHandlers(mc);
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
      this.emit(MediaConnection.EVENTS.stream.key, remoteStream);
    });
  }

  /**
   * Returns a connection according to given peerId and connectionId.
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
   * It emits peerJoin event.
   * If the message contain user's peerId, it also emits open event.
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
   * It emits peerLeave event.
   * @param {Object} leaveMessage - Message object.
   */
  handleLeave(leaveMessage) {
    const src = leaveMessage.src;
    this.emit(MeshRoom.EVENTS.peerLeave.key, src);
    // delete connection
  }

  /**
   * Handle data message from other paricipants in the room.
   * It emits data event.
   * @param {object} dataMessage - The data message to handle.
   */
  handleData(dataMessage) {
    this.emit(MeshRoom.EVENTS.data.key, dataMessage);
  }

  /**
   * Handle log message.
   * It emits log event.
   * @param {object} logMessage - The room's logs.
   */
  handleLog(logMessage) {
    this.emit(MeshRoom.EVENTS.log.key, logMessage);
  }

  /**
   * Handle offer message from new participant and create a Connection instance.
   * @param {object} offerMessage - Message object containing sdp offer.
   * @param {object} offerMessage.offer - Object containing sdp answer.
   * @param {string} offerMessage.connectionId - Object containing sdp answer.
   * @param {string} offerMessage.connectionType - Object containing sdp answer.
   * @param {string} offerMessage.dst - Object containing sdp answer.
   * @param {string} offerMessage.roomName - Object containing sdp answer.
   * @param {string} offerMessage.src - Object containing sdp answer.
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
   * Handle snswer message from participant in the room.
   * @param {object} answerMessage - Message object containing sdp answer.
   * @param {object} answerMessage.answer - Object containing sdp answer.
   * @param {string} answerMessage.connectionId - Object containing sdp answer.
   * @param {string} answerMessage.connectionType - Object containing sdp answer.
   * @param {string} answerMessage.dst - Object containing sdp answer.
   * @param {string} answerMessage.roomName - Object containing sdp answer.
   * @param {string} answerMessage.src - Object containing sdp answer.
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
   * Handles Answer message from participant in the room.
   * @param {object} candidateMessage - Message object containing sdp candidate.
   * @param {object} candidateMessage.candidate - Object containing sdp answer.
   * @param {string} candidateMessage.connectionId - Object containing sdp answer.
   * @param {string} candidateMessage.connectionType - Object containing sdp answer.
   * @param {string} candidateMessage.dst - Object containing sdp answer.
   * @param {string} candidateMessage.roomName - Object containing sdp answer.
   * @param {string} candidateMessage.src - Object containing sdp answer.
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

  /**
   * Send data to all participants in the room with WebSocket.
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
   * Start getting room's logs from SkyWay server.
   */
  getLog() {
    const message = {
      roomName: this.name
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.getLog.key, message);
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
}

module.exports = MeshRoom;
