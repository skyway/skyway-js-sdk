'use strict';

// depends on platform, you have to change the setting of object 'io'.
const io           = require('socket.io-client');  // for generic browser
// const io           = require('socket.io-client/socket.io');  // for react-native

const util         = require('./util');
const EventEmitter = require('events');

/**
 * Class to handle WS/HTTP communication with the signalling server
 * @extends EventEmitter
 */
class Socket extends EventEmitter {
  /**
   * Creates an instance of Socket.
   * @param {string} key - The apiKey to connect using.
   * @param {Object} options - Socket connection options.
   * @param {boolean} options.secure - True if signalling server supports HTTPS/WSS.
   * @param {string} options.host - The signalling server host.
   * @param {number | string} options.port - The port the signalling server is listening to.
   * @param {boolean} options.dispatcherSecure - True if dispatcher server supports HTTPS/WSS.
   * @param {string} options.dispatcherHost - The signalling server host.
   * @param {number | string} options.dispatcherPort - The port the signalling server is listening to.
   */
  constructor(key, options) {
    super();

    this._isOpen = false;
    this._isPeerIdSet = false;
    this._queue = [];

    this._io  = null;
    this._key = key;
    this._reconnectAttempts = 0;

    if (options.host && options.port) {
      let httpProtocol = options.secure ? 'https://' : 'http://';
      this.signalingServerUrl = `${httpProtocol}${options.host}:${options.port}`;
    } else {
      const dispatcherHost = options.dispatcherHost || util.DISPATCHER_HOST;
      const dispatcherPort = options.dispatcherPort || util.DISPATCHER_PORT;
      const dispatcherSecure = options.dispatcherSecure || util.DISPATCHER_SECURE;

      let httpProtocol = dispatcherSecure ? 'https://' : 'http://';
      this._dispatcherUrl = `${httpProtocol}${dispatcherHost}:${dispatcherPort}/signaling`;
    }
  }

  /**
   * Whether the socket is connecting to the signalling server or not.
   * @type {boolean}
   */
  get isOpen() {
    return Boolean((this._io && this._io.connected) && this._isOpen);
  }

  /**
   * Connect to the signalling server.
   * @param {string} id - Unique peerId to identify the client.
   * @param {string} token - Token to identify the session.
   * @return {Promise} Promise that resolves when starting is done.
   * @fires Socket#error
   */
  start(id, token) {
    let query = `apiKey=${this._key}&token=${token}`;
    if (id) {
      query += `&peerId=${id}`;
      this._isPeerIdSet = true;
    }

    // depends on runtime platform, transports has to be changed.
    // case react-native, only websocket can be used.
    let transports;
    if (window.navigator.userAgent === 'react-native') {
      // case react-native, restricted to websocket transport only
      transports = ['websocket'];
    } else {
      // In most cases, keep it as default ( default is ['polling', 'websocket'] )
      transports = undefined;
    }

    return new Promise(resolve => {
      if (this._dispatcherUrl) {
        this._getSignalingServer().then(serverInfo => {
          let httpProtocol = serverInfo.secure ? 'https://' : 'http://';
          this.signalingServerUrl = `${httpProtocol}${serverInfo.host}:${serverInfo.port}`;
          resolve();
        });
      } else {
        resolve();
      }
    }).then(() => {
      this._io = io(this.signalingServerUrl, {
        'force new connection': true,
        'query':                query,
        'reconnectionAttempts': util.reconnectionAttempts,
        'transports':           transports
      });

      this._io.on('reconnect_failed', () => {
        this._stopPings();
        this._connectToNewServer();
      });

      this._io.on('error', e => {
        util.error(e);
      });

      this._setupMessageHandlers();
    });
  }

  _connectToNewServer(numAttempts = 0) {
    // max number of attempts to get a new server from the dispatcher.
    const maxNumberOfAttempts = 10;
    if (numAttempts >= maxNumberOfAttempts || this._reconnectAttempts >= util.numberServersToTry) {
      this.emit('error', 'Could not connect to server.');
      return;
    }

    // Keep trying until we connect to a new server because consul can take some time to remove from the active list.
    this._getSignalingServer().then(serverInfo => {
      if (this.signalingServerUrl.indexOf(serverInfo.host) === -1) {
        let httpProtocol = serverInfo.secure ? 'https://' : 'http://';
        this.signalingServerUrl = `${httpProtocol}${serverInfo.host}:${serverInfo.port}`;
        this._io.io.uri = this.signalingServerUrl;
        this._io.connect();
        this._reconnectAttempts++;
      } else {
        this._connectToNewServer(++numAttempts);
      }
    });
  }

  /**
   * Return object including signaling server info.
   * @return {Promise} A promise that resolves with signaling server info
   and rejects if there's no response or status code isn't 200.
   */
  _getSignalingServer() {
    return new Promise((resolve, reject) => {
      const http = new XMLHttpRequest();

      http.timeout = util.DISPATCHER_TIMEOUT;
      http.open('GET', this._dispatcherUrl, true);

      /* istanbul ignore next */
      http.onerror = function() {
        reject(new Error('There was a problem with the dispatcher.'));
      };

      http.ontimeout = () => {
        reject(new Error('The request for the dispather timed out.'));
      };

      http.onreadystatechange = () => {
        if (http.readyState !== 4) {
          return;
        }

        const res = JSON.parse(http.responseText);
        if (http.status === 200) {
          if (res && res.domain) {
            resolve({host: res.domain, port: 443, secure: true});
            return;
          }
        }

        if (res.error && res.error.message) {
          const message = res.error.message;
          reject(new Error(message));
        } else {
          reject(new Error('There was a problem with the dispatcher.'));
        }
      };

      http.send(null);
    });
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
    if (!this.isOpen) {
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
    if (this.isOpen) {
      this._stopPings();
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
          if (!this._isPeerIdSet) {
            // set peerId for when reconnecting to the server
            this._io.io.opts.query += `&peerId=${openMessage.peerId}`;
            this._isPeerIdSet = true;
          }
          this._reconnectAttempts = 0;

          this._startPings();
          this._sendQueuedMessages();

          if (!this._isOpen) {
            this._isOpen = true;

            // To inform the peer that the socket successfully connected
            this.emit(type.key, openMessage);
          }
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
   * Start sending ping messages if they aren't already
   * @private
   */
  _startPings() {
    if (!this._pingIntervalId) {
      this._pingIntervalId = setInterval(() => {
        this.send(util.MESSAGE_TYPES.CLIENT.PING.key);
      }, util.pingInterval);
    }
  }

  /**
   * Stop sending ping messages
   * @private
   */
  _stopPings() {
    clearInterval(this._pingIntervalId);
    this._pingIntervalId = undefined;
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
