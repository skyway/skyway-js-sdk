'use strict';

const util            = require('./util');
const EventEmitter    = require('events');
const Enum            = require('enum');
const Connection      = require('./connection');
const MediaConnection = require('./mediaConnection');

const MeshEvents = new Enum([
  'stream',
  'open',
  'close',
  'peerJoin',
  'peerLeave',
  'error',
  'data',
  'log'
]);

const MeshMessageEvents = new Enum([
  'offer',
  'answer',
  'candidate',
  'broadcastByWS',
  'broadcastByDC',
  'leave',
  'close',
  'getPeers',
  'getLog'
]);

/** Fullmesh room */
class MeshRoom extends EventEmitter {

  /**
   * Creates a MeshRoom instance.
   * @param {string} name - Room name.
   * @param {Object} options - @@@@
   */
  constructor(name, options) {
    super();

    this.name = name;
    this._options = options || {};
    this._peerId = this._options.peerId;
    this.localStream = this._options._stream;
    this._pcConfig = this._options.pcConfig;
    this.remoteStreams = {};
    this.connections = {};

    this._queuedMessages = {};
  }

  /**
   * Starts getting users list in the room.
   * @param {MediaStream} stream - A media stream.
   * @param {Object} options - @@@@.
   */
  callRoom(stream) {
    if (!stream) {
      util.error(
        'To call a peer, you must provide ' +
        'a stream from your browser\'s `getUserMedia`.'
      );
    }

    this.localStream = stream;

    const data = {
      roomName: this.name
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * Starts getting users list in the room.
   * @param {MediaStream} stream - A media stream.
   * @param {Object} options - @@@@.
   */
  connectRoom() {
    const data = {
      roomName: this.name
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.getPeers.key, data);
  }

  /**
   * Starts video call to all users in the room.
   * @param {Array} peerIds - A list of PeerIDs.
   * @param {Object} options - @@@@
   */
  makeCalls(peerIds, options) {
    options = options || {};
    options._stream = this.localStream;

    for (let i = 0; i < peerIds.length; i++) {
      let peerId = peerIds[i];
      if (this._peerId !== peerId) {
        const mc = new MediaConnection(peerId, options);
        util.log('MediaConnection created in callRoom method');
        this._addConnection(peerId, mc);
        this._setupMessageHandlers(mc);
      }
    }
  }

  _addConnection(peerId, connection) {
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);
  }

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
    connection.on('stream', remoteStream => {
      this.emit('stream', remoteStream);
    });
  }

  /**
   * Returns a connection according to given peerId and connectionId.
   * @param {string} peerId - peerID.
   * @param {string} connectionId - connectionID.
   * @return {Connection} A MediaConnection or DataConnection.
   */
  getConnection(peerId, connectionId) {
    if (this.connections && this.connections[peerId]) {
      for (let connection of this.connections[peerId]) {
        if (connection.id === connectionId) {
          return connection;
        }
      }
    }
    return null;
  }

  /**
   * Handles Join message.
   * @param {Object} message - Message.
   */
  handleJoin(message) {
    const src = message.src;

    if (src === this._peerId) {
      this.open = true;
      this.emit(MeshRoom.EVENTS.open.key);

      // At this stage the Server has acknowledged us joining a room
      return;
    }

    this.emit(MeshRoom.EVENTS.peerJoin.key, src);
  }

  /**
   * Handles Leave message from other participant.
   * @param {Object} message - Message.
   */
  handleLeave(message) {
    const src = message.src;
    this.emit(MeshRoom.EVENTS.peerLeave.key, src);
  }

  /**
   * Handles data from other participant.
   * @param {Object} message - Data.
   */
  handleData(message) {
    this.emit(MeshRoom.EVENTS.data.key, message);
  }

  handleLog(log) {
    this.emit(MeshRoom.EVENTS.log.key, log);
  }

  /**
   * Handles Offer message from remote peer and create new Media Connection.
   * @param {Object} offerMessage - Offer message.
   * @param {string} offerMessage.src - Sender's peerID.
   * @param {string} [offerMessage.dst] - Reciever's peerID.
   * @param {Object} offerMessage.offer - Offer SDP.
   * @param {string} [offerMessage.connctionType] - 'media' or 'data'.
   * @param {string} offerMessage.connctionId - connectionID.
   * @param {string} [offerMessage.roomName] - Room name.
   * @param {string} [offerMessage.metadata] - metadata.
   */
  handleOffer(offerMessage) {
    const connectionId = offerMessage.connectionId;
    let connection = this.getConnection(offerMessage.src, connectionId);

    if (connection) {
      util.warn('Offer received for existing Connection ID:', connectionId);
      return;
    }

    if (offerMessage.connectionType === 'media') {
      connection = new MediaConnection(
        offerMessage.src,
        {
          connectionId:    connectionId,
          _payload:        offerMessage,
          metadata:        offerMessage.metadata,
          _queuedMessages: this._queuedMessages[connectionId],
          pcConfig:        this._pcConfig
        }
      );
      util.log('MediaConnection created in OFFER');
      this._addConnection(offerMessage.src, connection);
      this._setupMessageHandlers(connection);

      connection.answer(this.localStream);
    } else {
      util.warn('Received malformed connection type: ', offerMessage.connectionType);
    }
  }

  /**
   * Handles Answer message from remote peer.
   * @param {Object} answerMessage - Answer message.
   */
  handleAnswer(answerMessage) {
    const connection = this.getConnection(
                          answerMessage.src,
                          answerMessage.connectionId
                        );

    if (connection) {
      connection.handleAnswer(answerMessage);
    } else {
      this._storeMessage(util.MESSAGE_TYPES.ANSWER.key, answerMessage);
    }
  }

  /**
   * Handles Candidate message from remote peer.
   * @param {Object} candidateMessage - Offer message.
   */
  handleCandidate(candidateMessage) {
    const connection = this.getConnection(
                          candidateMessage.src,
                          candidateMessage.connectionId
                        );

    if (connection) {
      connection.handleCandidate(candidateMessage);
    } else {
      this._storeMessage(util.MESSAGE_TYPES.CANDIDATE.key, candidateMessage);
    }
  }

  _storeMessage(type, message) {
    if (!this._queuedMessages[message.connectionId]) {
      this._queuedMessages[message.connectionId] = [];
    }
    this._queuedMessages[message.connectionId]
      .push({type: type, payload: message});
  }

  /**
   * Sends data to all participants in the Room with WebSocket.
   * @param {Object} data - Data to send.
   */
  sendByWS(data) {
    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.broadcastByWS.key, message);
  }

  /**
   * Sends data to all participants in the Room with DataChannel.
   * @param {Object} data - Data to send.
   */
  sendByDC(data) {
    const message = {
      roomName: this.name,
      data:     data
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.broadcastByDC.key, message);
  }

  getLog() {
    const message = {
      roomName: this.name
    };
    this.emit(MeshRoom.MESSAGE_EVENTS.getLog.key, message);
  }

  /**
   * EVENTS
   */
  static get EVENTS() {
    return MeshEvents;
  }

  /**
   * MESSAGE_EVENTS
   */
  static get MESSAGE_EVENTS() {
    return MeshMessageEvents;
  }
}

module.exports = MeshRoom;
