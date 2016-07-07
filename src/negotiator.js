'use strict';

const EventEmitter = require('events');
const Enum         = require('enum');

const shim         = require('../src/webrtcShim');

const RTCPeerConnection     = shim.RTCPeerConnection;
const RTCIceCandidate       = shim.RTCIceCandidate;
const RTCSessionDescription = shim.RTCSessionDescription;

const util = require('./util');

const NegotiatorEvents = new Enum([
  'addStream',
  'dcReady',
  'offerCreated',
  'answerCreated',
  'iceCandidate',
  'iceConnectionDisconnected',
  'error'
]);

/**
 * Class that manages RTCPeerConnection and SDP exchange.
 * @extends EventEmitter
 */
class Negotiator extends EventEmitter {

  /**
   * Class that manages RTCPeerConnection and SDP exchange.
   * @param {object} [options] - Optional arguments for starting connection.
   * @param {string} [options.type] - Type of connection. One of 'media' or 'data'.
   * @param {MediaStream} [options._stream] - The MediaStream to be sent to the remote peer.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {boolean} [options.originator] - true means the peer is the originator of the connection.
   * @param {RTCSessionDescription} [options.offer] - The local description. If the peer is originator, handleOffer is callled with it.
   * @param {object} [pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   */
  startConnection(options, pcConfig) {
    this._pc = this._createPeerConnection(pcConfig);
    this._setupPCListeners();

    if (options.type === 'media' && options.stream) {
      this._pc.addStream(options.stream);
    }

    if (options.originator) {
      if (options.type === 'data') {
        const label = options.label || '';
        const dc = this._pc.createDataChannel(label);
        this.emit(Negotiator.EVENTS.dcReady.key, dc);
      }
    } else {
      this.handleOffer(options.offer);
    }
  }

  /**
   * Create new RTCPeerConnection.
   * @param {object} pcConfig - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @return {RTCPeerConnection} An instance of RTCPeerConnection.
   * @private
   */
  _createPeerConnection(pcConfig) {
    util.log('Creating RTCPeerConnection');

    // Calling RTCPeerConnection with an empty object causes an error
    // Either give it a proper pcConfig or undefined
    return new RTCPeerConnection(pcConfig);
  }

  /**
   * Set up event handlers of RTCPeerConnection events.
   * @private
   */
  _setupPCListeners() {
    this._pc.onaddstream = evt => {
      util.log('Received remote media stream');
      const stream = evt.stream;
      this.emit(Negotiator.EVENTS.addStream.key, stream);
    };

    this._pc.ondatachannel = evt => {
      util.log('Received data channel');
      const dc = evt.channel;
      this.emit(Negotiator.EVENTS.dcReady.key, dc);
    };

    this._pc.onicecandidate = evt => {
      const candidate = evt.candidate;
      if (candidate) {
        util.log('Generated ICE candidate for:', candidate);
        this.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
      } else {
        util.log('ICE canddidates gathering complete');
      }
    };

    this._pc.oniceconnectionstatechange = () => {
      switch (this._pc.iceConnectionState) {
        case 'new':
          util.log('iceConnectionState is new');
          break;
        case 'checking':
          util.log('iceConnectionState is checking');
          break;
        case 'connected':
          util.log('iceConnectionState is connected');
          break;
        case 'completed':
          util.log('iceConnectionState is completed');
          this._pc.onicecandidate = () => {};
          break;
        case 'failed':
          util.log('iceConnectionState is failed, closing connection');
          this.emit(Negotiator.EVENTS.iceConnectionDisconnected.key);
          break;
        case 'disconnected':
          util.log('iceConnectionState is disconnected, closing connection');
          this.emit(Negotiator.EVENTS.iceConnectionDisconnected.key);
          break;
        case 'closed':
          util.log('iceConnectionState is closed');
          break;
        default:
          break;
      }
    };

    this._pc.onnegotiationneeded = () => {
      util.log('`negotiationneeded` triggered');

      // don't make a new offer if it's not stable
      if (this._pc.signalingState === 'stable') {
        this._makeOfferSdp()
          .then(offer => {
            this._setLocalDescription(offer);
          });
      }
    };

    this._pc.onremovestream = () => {
      util.log('`removestream` triggered');
    };

    this._pc.onsignalingstatechange = () => {
      switch (this._pc.signalingState) {
        case 'stable':
          util.log('signalingState is stable');
          break;
        case 'have-local-offer':
          util.log('signalingState is have-local-offer');
          break;
        case 'have-remote-offer':
          util.log('signalingState is have-remote-offer');
          break;
        case 'have-local-pranswer':
          util.log('signalingState is have-local-pranswer');
          break;
        case 'have-remote-pranswer':
          util.log('signalingState is have-remote-pranswer');
          break;
        case 'closed':
          util.log('signalingState is closed');
          break;
        default:
          break;
      }
    };
  }

  /**
   * Create Offer SDP.
   * @return {Promise} A promise that resolves with Offer SDP.
   * @private
   */
  _makeOfferSdp() {
    return new Promise((resolve, reject) => {
      this._pc.createOffer(offer => {
        util.log('Created offer.');
        resolve(offer);
      }, error => {
        this.emitError('webrtc', error);
        util.log('Failed to createOffer, ', error);
        reject(error);
      });
    });
  }

  /**
   * Set local description with Offer SDP and emit offerCreated event.
   * @param {RTCSessionDescription} offer - Offer SDP.
   * @return {Promise} A promise that is resolved with Offer SDP.
   * @private
   */
  _setLocalDescription(offer) {
    return new Promise((resolve, reject) => {
      this._pc.setLocalDescription(offer, () => {
        util.log('Set localDescription: offer');
        this.emit(Negotiator.EVENTS.offerCreated.key, offer);
        resolve(offer);
      }, error => {
        this.emitError('webrtc', error);
        util.log('Failed to setLocalDescription, ', error);
        reject(error);
      });
    });
  }

  /**
   * Close a PeerConnection.
   */
  cleanup() {
    util.log('Cleaning up PeerConnection');

    if (this._pc && (this._pc.readyState !== 'closed' || this._pc.signalingState !== 'closed')) {
      this._pc.close();
      this._pc = null;
    }
  }

  /**
   * Set remote description with remote Offer SDP, then create Answer SDP and emit it.
   * @param {object} offerSdp - An object containing Offer SDP.
   */
  handleOffer(offerSdp) {
    this._setRemoteDescription(offerSdp)
      .then(() => {
        return this._makeAnswerSdp();
      }).then(answer => {
        this.emit(Negotiator.EVENTS.answerCreated.key, answer);
      });
  }

  /**
   * Set remote description with Answer SDP.
   * @param {object} answerSdp - An object containing Answer SDP.
   */
  handleAnswer(answerSdp) {
    this._setRemoteDescription(answerSdp);
  }

  /**
   * Set ice candidate with Candidate SDP.
   * @param {object} candidate - An object containing Candidate SDP.
   */
  handleCandidate(candidate) {
    this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    util.log('Added ICE candidate');
  }

  /**
   * Set remote SDP.
   * @param {object} sdp - An object containing remote SDP.
   * @return {Promise} A promise that is resolved when setting remote SDP is completed.
   * @private
   */
  _setRemoteDescription(sdp) {
    util.log(`Setting remote description ${JSON.stringify(sdp)}`);
    return new Promise(resolve => {
      this._pc.setRemoteDescription(new RTCSessionDescription(sdp), () => {
        util.log('Set remoteDescription:', sdp.type);
        resolve();
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to setRemoteDescription: ', err);
      });
    });
  }

  /**
   * Make Answer SDP and set it as local description.
   * @return {Promise} A promise that is resolved when setting local SDP is completed.
   * @private
   */
  _makeAnswerSdp() {
    return new Promise(resolve => {
      this._pc.createAnswer(answer => {
        util.log('Created answer.');

        this._pc.setLocalDescription(answer, () => {
          util.log('Set localDescription: answer');
          resolve(answer);
        }, err => {
          this.emitError('webrtc', err);
          util.log('Failed to setLocalDescription, ', err);
        });
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to createAnswer, ', err);
      });
    });
  }

  /**
   * Emit Error.
   * @param {string} type - The type of error.
   * @param {Error} err - An Error instance.
   * @private
   */
  emitError(type, err) {
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit(Negotiator.EVENTS.error.key, err);
  }

  /**
   * Events the Negotiator class can emit.
   * @type {Enum}
   */
  static get EVENTS() {
    return NegotiatorEvents;
  }

  /**
   * Remote media stream received.
   *
   * @event Negotiator#addStream
   * @type {MediaStream}
   */

  /**
   * DataConnection is ready.
   *
   * @event Negotiator#dcReady
   * @type {DataConnection}
   */

  /**
   * Offer SDP created.
   *
   * @event Negotiator#offerCreated
   * @type {RTCSessionDescription}
   */

  /**
   * Answer SDP created.
   *
   * @event Negotiator#answerCreated
   * @type {RTCSessionDescription}
   */

  /**
   * Ice Candieate received from peer.
   *
   * @event Negotiator#iceCandidate
   * @type {RTCIceCandidate}
   */

  /**
   * Ice connection disconnected.
   *
   * @event Negotiator#iceConnectionDisconnected
   */

  /**
   * Error occurred.
   *
   * @event Negotiator#error
   * @type {Error}
   */

}

module.exports = Negotiator;
