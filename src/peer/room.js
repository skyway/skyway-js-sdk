import EventEmitter from 'events';
import Enum from 'enum';
import parser from 'socket.io-parser';
import hasBin from 'has-binary2';
import config from '../shared/config';

const Events = [
  'stream',
  'open',
  'close',
  'peerJoin',
  'peerLeave',
  'error',
  'data',
  'log',
];

const MessageEvents = [
  'offer',
  'answer',
  'candidate',
  'leave',
  'close',
  'getLog',
  'broadcast',
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
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
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
    this._localStream = this._options.stream;

    this._pcConfig = this._options.pcConfig;

    this.lastSent = 0;
    this.messageQueue = [];
    this.sendIntervalID = null;
  }

  /**
   * Validate whether the size of data to send is over the limits or not.
   * @param {object} data - The data to Validate.
   */
  validateSendDataSize(data) {
    const isBin = hasBin([data]);
    const packet = {
      type: isBin ? parser.BINARY_EVENT : parser.EVENT,
      data: [data],
    };
    const encoder = new parser.Encoder();
    let dataSize;
    encoder.encode(packet, encodedPackets => {
      dataSize = isBin
        ? encodedPackets[1].byteLength
        : encodedPackets[0].length;
    });
    const maxDataSize = config.maxDataSize;
    if (dataSize > maxDataSize) {
      throw new Error('The size of data to send must be less than 20 MB');
    }
    return true;
  }

  /**
   * Send a message to the room with a delay so that the transmission interval does not exceed the limit.
   * @param {object} msg - The data to send to this room.
   * @param {string} key - The key of broadcast event.
   */
  _sendData(msg, key) {
    const sendInterval = config.minBroadcastIntervalMs;

    const now = Date.now();
    const diff = now - this.lastsend;

    // When no queued message and last message is enough old
    if (this.messageQueue.length == 0 && diff >= sendInterval) {
      // Update last send time and send message without queueing.
      this.lastsend = now;
      this.emit(key, msg);
      return;
    }

    // Send a message to the room with a delay because the transmission interval exceeds the limit.

    // Push this message into a queue.
    this.messageQueue.push({ msg, key });

    // Return if setInterval is already set.
    if (this.sendIntervalID !== null) {
      return;
    }
    this.sendIntervalID = setInterval(() => {
      // If all message are sent, remove this interval ID.
      if (this.messageQueue.length === 0) {
        clearInterval(this.sendIntervalID);
        this.sendIntervalID = null;
        return;
      }
      // Update last send time send message.
      const message = this.messageQueue.shift();
      this.lastsend = Date.now();
      this.emit(message.key, message.msg);
    }, sendInterval);
  }

  /**
   * Handle received data message from other paricipants in the room.
   * It emits data event.
   * @param {object} dataMessage - The data message to handle.
   * @param {ArrayBuffer} dataMessage.data - The data that a peer sent in the room.
   * @param {string} dataMessage.src -  The peerId of the peer who sent the data.
   * @param {string} [dataMessage.roomName] -  The name of the room user is joining.
   */
  handleData(dataMessage) {
    const message = {
      data: dataMessage.data,
      src: dataMessage.src,
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
      roomName: this.name,
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
   * MediaStream received from peer in the room.
   *
   * @event Room#stream
   * @type {MediaStream}
   */

  /**
   * Room is ready.
   *
   * @event Room#open
   */

  /**
   * All connections in the room has closed.
   *
   * @event Room#close
   */

  /**
   * New peer has joined.
   *
   * @event Room#peerJoin
   * @type {string}
   */

  /**
   * A peer has left.
   *
   * @event Room#peerLeave
   * @type {string}
   */

  /**
   * Error occured
   *
   * @event Room#error
   */

  /**
   * Data received from peer.
   *
   * @event Room#data
   * @type {object}
   * @property {string} src - The peerId of the peer who sent the data.
   * @property {*} data - The data that a peer sent in the room.
   */

  /**
   * Room's log received.
   *
   * @event Room#log
   * @type {Array}
   */

  /**
   * Connection closed event.
   *
   * @event Connection#close
   */

  /**
   * Events the Room class can emit.
   * @type {Enum}
   */
  static get MESSAGE_EVENTS() {
    return RoomMessageEvents;
  }

  /**
   * Offer created event.
   *
   * @event Room#offer
   * @type {object}
   * @property {RTCSessionDescription} offer - The local offer to send to the peer.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   * @property {object} metadata - Any extra data to send with the connection.
   */

  /**
   * Answer created event.
   *
   * @event Room#answer
   * @type {object}
   * @property {RTCSessionDescription} answer - The local answer to send to the peer.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   */

  /**
   * ICE candidate created event.
   *
   * @event Room#candidate
   * @type {object}
   * @property {RTCIceCandidate} candidate - The ice candidate.
   * @property {string} dst - Destination peerId
   * @property {string} connectionId - This connection's id.
   * @property {string} connectionType - This connection's type.
   */

  /**
   * Left the room.
   *
   * @event Room#peerLeave
   * @type {object}
   * @property {string} roomName - The room name.
   */

  /**
   * Get room log from SkyWay server.
   *
   * @event Room#log
   * @type {object}
   * @property {string} roomName - The room name.
   */
}

export default Room;
