'use strict';

const RoomNegotiator = require('./roomNegotiator');

const EventEmitter = require('events');
const Enum         = require('enum');

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
  'leave'
]);

class Room extends EventEmitter {
  constructor(name, options) {
    super();
    this.name = name;
    this._options = options || {};
    this._peerId = this._options.peerId;

    // Room acts as RoomConnection
    this._negotiator = new RoomNegotiator(this);

    this.localStream = this.options._stream;
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'room',
          _stream:    this.localStream
        },
        this.options.pcConfig
      );
      this._pcAvailable = true;
    }

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      util.log('Receiving room stream', remoteStream);

      this.remoteStream = remoteStream;
      this.emit('stream', remoteStream);
    });

    this.open = false;
    this.members = [];
  }

  // Handle socket.io related events
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

  // Handle JVB related events
  handleAnswer(answerMessage) {
    if (this._pcAvailable) {
      this._negotiator.handleAnswer(answerMessage.answer);
      this.open = true;
    } else {
      util.log(`Queuing ANSWER message in ${this.id} from ${this.remoteId}`);
      this._queuedMessages.push({type: util.MESSAGE_TYPES.ANSWER.key, payload: answerMessage});
    }
  }

  handleCandidate(candidateMessage) {
    if (this._pcAvailable) {
      this._negotiator.handleCandidate(candidateMessage.candidate);
    } else {
      util.log(`Queuing CANDIDATE message in ${this.id} from ${this.remoteId}`);
      this._queuedMessages.push({type: util.MESSAGE_TYPES.CANDIDATE.key, payload: candidateMessage});
    }
  }

  handleOffer(offerMessage) {
    // Handle JVB Offer and send Answer to Server


  }

  sendAnswer() {
    // This should be an emit (probably)
  }



  //
  // Event Handlers
  //
  _setupNegotiatorMessageHandlers() {
    this._negotiator.on(Negotiator.EVENTS.answerCreated.key, answer => {
      const connectionAnswer = {
        answer:         answer,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.answer.key, connectionAnswer);
    });

    this._negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
      const connectionOffer = {
        offer:          offer,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type,
        metadata:       this.metadata
      };
      if (this.serialization) {
        connectionOffer.serialization = this.serialization;
      }
      if (this.label) {
        connectionOffer.label = this.label;
      }
      this.emit(Connection.EVENTS.offer.key, connectionOffer);
    });

    this._negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
      const connectionCandidate = {
        candidate:      candidate,
        dst:            this.remoteId,
        connectionId:   this.id,
        connectionType: this.type
      };
      this.emit(Connection.EVENTS.candidate.key, connectionCandidate);
    });
  }

  //
  // Other methods
  //
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

  static get EVENTS() {
    return RoomEvents;
  }

  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }
}

module.exports = Room;
