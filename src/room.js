'use strict';

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

    this.open = false;

    this.members = [];
  }

  handleJoin(message) {
    const src = message.src;

    if (src === this._peerId) {
      this.open = true;
      this.emit(Room.EVENTS.open.key);
      console.log('Joined room ' + this.name + '.');
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

  static get EVENTS() {
    return RoomEvents;
  }

  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }
}

module.exports = Room;
