import io from 'socket.io-client';
import EventEmitter from 'events';
import queryString from 'query-string';

import config from '../shared/config';
import logger from '../shared/logger';

import { version } from '../../package.json';

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

    this._io = null;
    this._key = key;
    this._reconnectAttempts = 0;

    if (options.host && options.port) {
      const httpProtocol = options.secure ? 'https://' : 'http://';
      this.signalingServerUrl = `${httpProtocol}${options.host}:${options.port}`;
    } else {
      const dispatcherHost = options.dispatcherHost || config.DISPATCHER_HOST;
      const dispatcherPort = options.dispatcherPort || config.DISPATCHER_PORT;
      const dispatcherSecure =
        options.dispatcherSecure || config.DISPATCHER_SECURE;

      const httpProtocol = dispatcherSecure ? 'https://' : 'http://';
      this._dispatcherUrl = `${httpProtocol}${dispatcherHost}:${dispatcherPort}/signaling`;
    }
  }

  /**
   * Whether the socket is connecting to the signalling server or not.
   * @type {boolean}
   */
  get isOpen() {
    return Boolean(this._io && this._io.connected && this._isOpen);
  }

  /**
   * Connect to the signalling server.
   * @param {string} id - Unique peerId to identify the client.
   * @param {string} token - Token to identify the session.
   * @param {object} credential - The credential used to authenticate peer.
   * @param {number} [credential.timestamp] - Current UNIX timestamp.
   + @param {number} [credential.ttl] - Time to live; The credential expires at timestamp + ttl.
   + @param {string} [credential.authToken] - Credential token calculated with HMAC.
   * @return {Promise<void>} Promise that resolves when starting is done.
   * @fires Socket#error
   */
  async start(id, token, credential) {
    let query =
      `apiKey=${this._key}&token=${token}` +
      `&platform=javascript&sdk_version=${version}`;

    if (id) {
      query += `&peerId=${id}`;
      this._isPeerIdSet = true;
    }

    if (credential) {
      const encodedCredentialStr = encodeURIComponent(
        JSON.stringify(credential)
      );
      query += `&credential=${encodedCredentialStr}`;
    }

    if (this._dispatcherUrl) {
      let serverInfo;
      try {
        serverInfo = await this._getSignalingServer();
      } catch (err) {
        this.emit('error', err);
        return;
      }
      const httpProtocol = serverInfo.secure ? 'https://' : 'http://';
      this.signalingServerUrl = `${httpProtocol}${serverInfo.host}:${serverInfo.port}`;
    }

    this._io = io(this.signalingServerUrl, {
      'force new connection': true,
      query: query,
      reconnectionAttempts: config.reconnectionAttempts,
    });

    this._io.on('reconnect_failed', () => {
      this._stopPings();
      this._connectToNewServer();
    });

    this._io.on('error', e => {
      logger.error(e);
    });

    this._setupMessageHandlers();
  }

  /**
   * Connect to "new" signaling server. Attempts up to 10 times before giving up and emitting an error on the socket.
   * @param {number} [numAttempts=0] - Current number of attempts.
   * @return {Promise<void>} A promise that resolves with new connection has done.
   * @private
   */
  async _connectToNewServer(numAttempts = 0) {
    // max number of attempts to get a new server from the dispatcher.
    const maxNumberOfAttempts = 10;
    if (
      numAttempts >= maxNumberOfAttempts ||
      this._reconnectAttempts >= config.numberServersToTry
    ) {
      this.emit('error', 'Could not connect to server.');
      return;
    }

    // Keep trying until we connect to a new server because consul can take some time to remove from the active list.
    let serverInfo;
    try {
      serverInfo = await this._getSignalingServer();
    } catch (err) {
      this.emit('error', err);
      return;
    }

    if (this.signalingServerUrl.indexOf(serverInfo.host) === -1) {
      const httpProtocol = serverInfo.secure ? 'https://' : 'http://';
      this.signalingServerUrl = `${httpProtocol}${serverInfo.host}:${serverInfo.port}`;

      this._io.io.uri = this.signalingServerUrl;
      this._io.connect();
      this._reconnectAttempts++;
    } else {
      this._connectToNewServer(++numAttempts);
    }
  }

  /**
   * Return object including signaling server info.
   * @return {Promise<Object>} A promise that resolves with signaling server info
   and rejects if there's no response or status code isn't 200.
   */
  _getSignalingServer() {
    return new Promise((resolve, reject) => {
      const http = new XMLHttpRequest();

      http.timeout = config.DISPATCHER_TIMEOUT;
      http.open('GET', this._dispatcherUrl, true);
      /* istanbul ignore next */
      http.onerror = () => {
        reject(
          new Error(
            'There was a problem with the request for the dispatcher. Check your peer options and network connections.'
          )
        );
      };

      http.onabort = () => {
        reject(new Error('The request for the dispatcher was aborted.'));
      };

      http.ontimeout = () => {
        reject(
          new Error(
            'The request for the dispatcher timed out. Check your firewall, network speed, SkyWay failure information'
          )
        );
      };
      http.onload = () => {
        if (http.status !== 200) {
          reject(
            new Error('Connection failed. Unexpected response: ' + http.status)
          );
          return;
        }
        try {
          const res = JSON.parse(http.responseText);
          if (res && res.domain) {
            resolve({ host: res.domain, port: 443, secure: true });
            return;
          }
          reject(
            new Error(
              'The dispatcher server returned an invalid JSON response. have no signaling server domain in JSON.'
            )
          );
        } catch (err) {
          reject(
            new Error(
              'The dispatcher server returned an invalid JSON response.'
            )
          );
        }
      };
      http.send(null);
    });
  }

  /**
   * Send a message to the signalling server. Queue the messages if not connected yet.
   * @param {string} type - The signalling message type. Message types are defined in config.MESSAGE_TYPES.
   * @param {string | object} message - The message to send to the server.
   */
  send(type, message) {
    if (!type) {
      this._io.emit('error', 'Invalid message');
      return;
    }

    // If we are not connected yet, queue the message
    if (!this.isOpen) {
      this._queue.push({ type: type, message: message });
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

  /**
   * Reconnect to the signaling server.
   */
  reconnect() {
    this._io.connect();
  }

  /**
   * Update Credential by sending the new credential to the signaling server.
   * Also set the new one to the Socket.io.opts's query string for reconnection.
   * @param {object} newCredential - The new credential generated by user.
   * @param {number} [newCredential.timestamp] - Current UNIX timestamp.
   + @param {number} [newCredential.ttl] - Time to live; The credential expires at timestamp + ttl.
   + @param {string} [newCredential.authToken] - Credential token calculated with HMAC.
   */
  updateCredential(newCredential) {
    // Parse the current queryString and replace the new credential with old one
    const parseQuery = queryString.parse(this._io.io.opts.query);
    if (parseQuery.credential) {
      parseQuery.credential = encodeURIComponent(JSON.stringify(newCredential));
    } else {
      // For future development; here we can tell the the developer
      // which connection(p2p/turn/sfu) should be authenticated.
      logger.warn("Adding a credential when one wasn't specified before.");
    }
    this._io.io.opts.query = queryString.stringify(parseQuery);

    this.send(config.MESSAGE_TYPES.CLIENT.UPDATE_CREDENTIAL.key, newCredential);
  }

  /**
   * Set up the signalling message handlers.
   * @private
   * @fires Socket#OPEN
   * @fires Socket#OFFER
   * @fires Socket#ANSWER
   * @fires Socket#CANDIDATE
   * @fires Socket#LEAVE
   * @fires Socket#AUTH_EXPIRES_IN
   * @fires Socket#ROOM_OFFER
   * @fires Socket#ROOM_USER_JOIN
   * @fires Socket#ROOM_USER_LEAVE
   * @fires Socket#ROOM_DATA
   * @fires Socket#FORCE_CLOSE
   */
  _setupMessageHandlers() {
    config.MESSAGE_TYPES.SERVER.enums.forEach(type => {
      if (type.key === config.MESSAGE_TYPES.SERVER.OPEN.key) {
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
    for (const data of this._queue) {
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
        this.send(config.MESSAGE_TYPES.CLIENT.PING.key);
      }, config.pingInterval);
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

  /**
   * Remote Peer requested to close a connection.
   *
   * @event Socket#FORCE_CLOSE
   * @type {object}
   * @property {string} src - Sender peerId.
   * @property {string} dst - Recipient peerId.
   * @property {string} connectionId - The connection id.
   */
}

export default Socket;
