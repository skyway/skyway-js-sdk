'use strict';

const util            = require('./util');
const EventEmitter    = require('events');
const Enum            = require('enum');
const Connection      = require('./connection');
const MediaConnection = require('./mediaConnection');

const MeshEvents = new Enum([
  'stream'
]);

const MeshMessageEvents = new Enum([
  'broadcast',
  'leave',
  'candidate',
  'offer',
  'answer',
  'close',
  'get_peers'
]);

class MeshRoom extends EventEmitter {
  constructor(name, options) {
    super();

    this.name = name;
    this._options = options || {};
    this._peerId = this._options.peerId;
    this.stream = this._options._stream;
    this._pcConfig = this._options.pcConfig;
    this.remoteStreams = {};
    this.connections = {};

    this._queuedMessages = {};
  }

  _addConnection(peerId, connection) {
    console.log('P2PConnectionManager._addConnection')
    console.log(this)
    if (!this.connections[peerId]) {
      this.connections[peerId] = [];
    }
    this.connections[peerId].push(connection);
  }

  getConnection(peerId, connectionId) {
    console.log('P2PConnectionManager.getConnection')
    console.log(this)
    if (this.connections && this.connections[peerId]) {
      for (let connection of this.connections[peerId]) {
        if (connection.id === connectionId) {
          return connection;
        }
      }
    }
    return null;
  }

  callRoom(stream, options) {
    if (!stream) {
      util.error(
        'To call a peer, you must provide ' +
        'a stream from your browser\'s `getUserMedia`.'
      );
      return null;
    }

    this.stream = stream;

    const data = {
      roomName:    this.name,
      roomOptions: this._options
    };

    this.emit(MeshRoom.MESSAGE_EVENTS.get_peers.key, data);
  }

  makeCalls(peerIds, options) {
    options = options || {};
    options._stream = this.stream;

    for(let i=0; i<peerIds.length; i++){
      let peerId = peerIds[i];
      if(this._peerId !== peerId){
        const mc = new MediaConnection(peerId, options);
        util.log('MediaConnection created in callRoom method');
        this._addConnection(peerId, mc);
        this._setupMessageHandlers(mc);
      }
    }
  }

  connectRoom(peerIds, stream, options) {

  }
  
  handleOffer(offerMessage){
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

      connection.answer(this.stream);
    } else {
      util.warn('Received malformed connection type: ', offerMessage.connectionType);
    }
  }

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

  _setupMessageHandlers(connection) {
    connection.on(Connection.EVENTS.candidate.key, candidateMessage => {
      console.log('connection on candidate')
      candidateMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.candidate.key, candidateMessage);
    });
    connection.on(Connection.EVENTS.answer.key, answerMessage => {
      console.log('connection on answer')
      answerMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.answer.key, answerMessage);
    });
    connection.on(Connection.EVENTS.offer.key, offerMessage => {
      console.log('connection on offer')
      offerMessage.roomName = this.name;
      this.emit(MeshRoom.MESSAGE_EVENTS.offer.key, offerMessage);
    });
    connection.on('stream', remoteStream => {
      this.emit('stream', remoteStream);
    });
  }

  close() {
    console.log('implement close method')
  }

  static get EVENTS() {
    return MeshEvents;
  }

  static get MESSAGE_EVENTS() {
    return MeshMessageEvents;
  }
}



module.exports = MeshRoom;