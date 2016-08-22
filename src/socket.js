'use strict';

const io           = require('socket.io-client');
const util         = require('./util');

const EventEmitter = require('events');

/**
 * Class to handle WS/HTTP communication with the signalling server
 * @extends EventEmitter
 */
class Socket extends EventEmitter {
  /**
   * Creates an instance of Socket.
   * @param {boolean} secure - True if signalling server supports HTTPS/WSS.
   * @param {string} host - The signalling server host.
   * @param {number | string} port - The port the signalling server is listening to.
   * @param {string} key - The apiKey to connect using.
   */
  constructor(secure, host, port, key) {
    super();

    this._isOpen = false;
    this._isPeerIdSet = false;
    this._queue = [];

    this._io  = null;
    this._key = key;

    let httpProtocol = secure ? 'https://' : 'http://';
    this._httpUrl = `${httpProtocol}${host}:${port}`;
  }

  /**
   * Whether the client is disconnected from the signalling server or not.
   * @type {boolean}
   */
  get disconnected() {
    return !((this._io && this._io.connected) && this._isOpen);
  }

  /**
   * Connect to the signalling server.
   * @param {string} id - Unique peerId to identify the client.
   * @param {string} token - Token to identify the session.
   * @fires Socket#error
   */
  start(id, token) {
    let query;
    if (id) {
      query = `apiKey=${this._key}&token=${token}&peerId=${id}`;
      this._isPeerIdSet = true;
    } else {
      query = `apiKey=${this._key}&token=${token}`;
    }

    this._io = io(this._httpUrl, {
      'force new connection': true,
      'query':                query,
      'reconnectionAttempts': util.reconnectionAttempts
    });

    this._io.on('reconnect_failed', () => {
      this.emit('error', 'Could not connect to server.');
    });

    this._setupMessageHandlers();
  }

  /**
   * Send a message to the signalling server. Queue the messages if not connected yet.
   * @param {string} type - The signalling message type. Message types are defined in util.MESSAGE_TYPES.
   * @param {string | object} message - The message to send to the server.
   */
  send(type, message) {
    if (!type) {
      this._io.emit('error', 'Invalid message');
      return;
    }

    // If we are not connected yet, queue the message
    if (this.disconnected) {
      this._queue.push({type: type, message: message});
      return;
    }

    if (this._io.connected === true) {
      this._io.emit(type, message);
    }
  }

  /**
   * Disconnect from the signalling server.
   */
  close() {
    if (!this.disconnected) {
      this._io.disconnect();
      this._isOpen = false;
    }
  }

  reconnect() {
    this._io.connect();
  }

  /**
   * Set up the signalling message handlers.
   * @private
   * @fires Socket#OPEN
   * @fires Socket#OFFER
   * @fires Socket#ANSWER
   * @fires Socket#CANDIDATE
   * @fires Socket#LEAVE
   * @fires Socket#ROOM_OFFER
   * @fires Socket#ROOM_USER_JOIN
   * @fires Socket#ROOM_USER_LEAVE
   * @fires Socket#ROOM_DATA
   */
  _setupMessageHandlers() {
    util.MESSAGE_TYPES.SERVER.enums.forEach(type => {
      if (type.key === util.MESSAGE_TYPES.SERVER.OPEN.key) {
        this._io.on(type.key, openMessage => {
          if (!openMessage || !openMessage.peerId) {
            return;
          }

          this._isOpen = true;
          if (!this._isPeerIdSet) {
            // set peerId for when reconnecting to the server
            this._io.io.opts.query += `&peerId=${openMessage.peerId}`;
            this._isPeerIdSet = true;
          }

          this._sendQueuedMessages();

          // To inform the peer that the socket successfully connected
          this.emit(type.key, openMessage);
        });
      } else {
        this._io.on(type.key, message => {
          this.emit(type.key, message);
        });
      }
    });
  }

  /**
   * Send messages that were queued when the client wasn't connected to the signalling server yet.
   * @private
   */
  _sendQueuedMessages() {
    for (let data of this._queue) {
      this.send(data.type, data.message);
    }
    this._queue = [];
  }

  /**
   * Error occurred.
   *
   * @event Connection#error
   * @type {Error}
   */

  /**
   * Socket opened.
   *
   * @event Socket#OPEN
   * @type {object}
   * @property {string} peerId - The peerId of the client.
   * @property {string} [turnCredential] - The turn credentials for this client.
   */

  /**
   * Signalling server error.
   *
   * @event Socket#ERROR
   * @type {string}
   */

  /**
   * ICE candidate received from peer.
   *
   * @event Socket#CANDIDATE
   * @type {object}
   * @property {RTCIceCandidate} candidate - The ice candidate.
   * @property {string} src - Sender peerId.
   * @property {string} dst - Recipient peerId.
   * @property {string} connectionId - The connection id.
   * @property {string} connectionType - The connection type.
   */

  /**
   * Offer received from peer.
   *
   * @event Socket#OFFER
   * @type {object}
   * @property {RTCSessionDescription} offer - The remote peer's offer.
   * @property {string} src - Sender peerId.
   * @property {string} dst - Recipient peerId.
   * @property {string} connectionId - The connection id.
   * @property {string} connectionType - The connection type.
   * @property {object} metadata - Any extra data sent with the connection.
   */

  /**
   * Answer received from peer.
   *
   * @event Socket#ANSWER
   * @type {object}
   * @property {RTCSessionDescription} answer - The remote peer's answer.
   * @property {string} src - Sender peerId.
   * @property {string} dst - Recipient peerId.
   * @property {string} connectionId - The connection id.
   * @property {string} connectionType - The connection type.
   */

  /**
   * Peer has left.
   *
   * @event Socket#LEAVE
   * @type {string}
   */

  /**
   * Message sent to peer has failed.
   *
   * @event Socket#EXPIRE
   * @type {string}
   */

  /**
   * Room offer sdp received.
   *
   * @event Socket#ROOM_OFFER
   * @type {object}
   * @property {string} roomName - The name of the room the offer is for.
   * @property {RTCSessionDescription} offer - The offer object.
   */

  /**
   * User has joined the room.
   *
   * @event Socket#ROOM_USER_JOIN
   * @type {object}
   * @property {string} src - The peerId of the user who joined the room.
   * @property {string} roomName - The name of the room joined.
   */

  /**
   * User has left the room.
   *
   * @event Socket#ROOM_USER_LEAVE
   * @type {object}
   * @property {string} src - The peerId of the user who left the room.
   * @property {string} roomName - The name of the room left.
   */

  /**
   * Received a data message from a user in a room.
   *
   * @event Socket#ROOM_DATA
   * @type {object}
   * @property {string} src - The peerId of the user who sent the message.
   * @property {string} roomName - The name of the room left.
   * @property {*} data - The data that was sent.
   */
}

module.exports = Socket;
