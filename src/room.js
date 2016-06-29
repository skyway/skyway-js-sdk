'use strict';

const EventEmitter    = require('events');
const Enum            = require('enum');

const Events = [
  'stream',
  'open',
  'close',
  'peerJoin',
  'peerLeave',
  'error',
  'data',
  'log'
];

const MessageEvents = [
  'offer',
  'answer',
  'candidate',
  'leave',
  'close',
  'getLog'
];

const RoomEvents = new Enum(Events);
const RoomMessageEvents = new Enum(MessageEvents);

/** Room */
class Room extends EventEmitter {

  /**
   * Creates a Room instance.
   * @param {string} name - Room name.
   * @param {string} peerId - @@@@
   * @param {Object} options - @@@@
   */
  constructor(name, peerId, options) {
    super();

    this.name = name;
    this._options = options || {};
    this._peerId = peerId;
    this.localStream = this._options._stream;
  }

  /**
   * Handles data from other participant.
   * @param {Object} message - Data.
   */
  handleData(message) {
    this.emit(Room.EVENTS.data.key, message);
  }

  handleLog(log) {
    this.emit(Room.EVENTS.log.key, log);
  }

  getLog() {
    const message = {
      roomName: this.name
    };
    this.emit(Room.MESSAGE_EVENTS.getLog.key, message);
  }

  /**
   * EVENTS
   */
  static get Events() {
    return Events;
  }

  /**
   * EVENTS
   */
  static get EVENTS() {
    return RoomEvents;
  }

  /**
   * EVENTS
   */
  static get MessageEvents() {
    return MessageEvents;
  }

  /**
   * MESSAGE_EVENTS
   */
  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }
}

module.exports = Room;
