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

/**
 * Class to manage rooms where one or more users can participate
 * @extends EventEmitter
 */
class Room extends EventEmitter {

  /**
   * Creates a Room instance.
   * @param {string} name - Room name.
   * @param {string} peerId - User's peerId.
   * @param {object} [options] - Optional arguments for the connection.
   * @param {object} [options.stream] - User's medias stream to send other participants.
   */
  constructor(name, peerId, options = {}) {
    super();

    // Abstract class
    if (this.constructor === Room) {
      throw new TypeError('Cannot construct Room instances directly');
    }

    this.name = name;
    this._options = options;
    this._peerId = peerId;
    this.localStream = this._options.stream;
  }

  /**
   * Handle received data message from other paricipants in the room.
   * It emits data event.
   * @param {object} dataMessage - The data message to handle.
   * @param {ArrayBuffer} dataMessage.data - The data that received by all of participant.
   * @param {string} dataMessage.src -  The peerId of the peer who sent the data.
   * @param {string} [dataMessage.roomName] -  The name of the room user is joining.
   */
  handleData(dataMessage) {
    const message = {
      data: dataMessage.data,
      src:  dataMessage.src
    };
    this.emit(Room.EVENTS.data.key, message);
  }

  /**
   * Handle received log message.
   * It emits log event with room's logs.
   * @param {Array} logs - An array containing JSON text.
   */
  handleLog(logs) {
    this.emit(Room.EVENTS.log.key, logs);
  }

  /**
   * Start getting room's logs from SkyWay server.
   */
  getLog() {
    const message = {
      roomName: this.name
    };
    this.emit(Room.MESSAGE_EVENTS.getLog.key, message);
  }

  /**
   * Events the Room class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return RoomEvents;
  }

  /**
   * Events the Room class can emit.
   * @type {Enum}
   */
  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }
}

module.exports = Room;
