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
  'removeStream',
  'dcCreated',
  'offerCreated',
  'answerCreated',
  'iceCandidate',
  'iceCandidatesComplete',
  'iceConnectionDisconnected',
  'error'
]);

/**
 * Class that manages RTCPeerConnection and SDP exchange.
 * @extends EventEmitter
 */
class Negotiator extends EventEmitter {
  /**
   * Create a negotiator
   * @param {string} name - Room name.
   */
  constructor() {
    super();
    this._isExpectingAnswer = false;
  }

  /**
   * Class that manages RTCPeerConnection and SDP exchange.
   * @param {object} [options] - Optional arguments for starting connection.
   * @param {string} [options.type] - Type of connection. One of 'media' or 'data'.
   * @param {MediaStream} [options._stream] - The MediaStream to be sent to the remote peer.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {boolean} [options.originator] - true means the peer is the originator of the connection.
   * @param {RTCSessionDescription} [options.offer]
   *        - The local description. If the peer is originator, handleOffer is called with it.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   */
  startConnection(options = {}) {
    this._pc = this._createPeerConnection(options.pcConfig);
    this._setupPCListeners();
    this._originator = options.originator;

    if (options.type === 'media' && options.stream) {
      // `addStream` will trigger onnegotiationneeded event.
      this._pc.addStream(options.stream);
    } else if (options.type === 'media') {
      // This means the peer wants to create offer SDP with `recvonly`
      this._makeOfferSdp().then(offer => {
        this._setLocalDescription(offer);
      });
    }

    if (this._originator) {
      if (options.type === 'data') {
        const label = options.label || '';
        const dc = this._pc.createDataChannel(label);
        this.emit(Negotiator.EVENTS.dcCreated.key, dc);
      }
    } else {
      this.handleOffer(options.offer);
    }
  }

  /**
   * Replace the stream being sent with a new one.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   */
  replaceStream(newStream) {
    // Replace the tracks in the rtpSenders if possible.
    // This doesn't require renegotiation.
    if (this._pc.getSenders) {
      this._pc.getSenders().forEach(sender => {
        let tracks;
        if (sender.track.kind === 'audio') {
          tracks = newStream.getAudioTracks();
        } else if (sender.track.kind === 'video') {
          tracks = newStream.getVideoTracks();
        }

        if (tracks && tracks[0]) {
          sender.replaceTrack(tracks[0]);
        } else {
          this._pc.removeTrack(sender);
        }
      });
      return;
    }

    // Manually remove and readd the entire stream if senders aren't available.
    // Save and unset onnegotiationneeded so that it doesn't trigger twice.
    const negotiationNeededHandler = this._pc.onnegotiationneeded;

    // Run async to give onnegotiationneeded a chance to trigger (and do nothing) on removeStream.
    // Set the timeout before calling removeStream just in case there's
    // an error so we can restore the onnegotiationneeded handler.
    setTimeout(() => {
      this._pc.onnegotiationneeded = negotiationNeededHandler;
      this._pc.addStream(newStream);
    }, 0);

    /* istanbul ignore next function */
    this._pc.onnegotiationneeded = () => {};

    const localStreams = this._pc.getLocalStreams();
    if (localStreams && localStreams[0]) {
      this._pc.removeStream(localStreams[0]);
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
    if (this._isExpectingAnswer) {
      this._setRemoteDescription(answerSdp);
      this._isExpectingAnswer = false;
    } else if (this._pc.onnegotiationneeded) {
      // manually trigger negotiation
      this._pc.onnegotiationneeded();
    }
  }

  /**
   * Set ice candidate with Candidate SDP.
   * @param {object} candidate - An object containing Candidate SDP.
   */
  handleCandidate(candidate) {
    this._pc.addIceCandidate(new RTCIceCandidate(candidate)).then(() => {
      util.log('Added ICE candidate');
    }).catch(e => {
      util.error('Failed to add ICE candidate', e);
    });
  }

  /**
   * Close a PeerConnection.
   */
  cleanup() {
    util.log('Cleaning up PeerConnection');

    if (this._pc && (this._pc.readyState !== 'closed' || this._pc.signalingState !== 'closed')) {
      this._pc.close();
    }
    this._pc = null;
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
    const pc = this._pc;
    pc.onaddstream = evt => {
      util.log('Received remote media stream');
      const stream = evt.stream;
      this.emit(Negotiator.EVENTS.addStream.key, stream);
    };

    pc.ondatachannel = evt => {
      util.log('Received data channel');
      const dc = evt.channel;
      this.emit(Negotiator.EVENTS.dcCreated.key, dc);
    };

    pc.onicecandidate = evt => {
      const candidate = evt.candidate;
      if (candidate) {
        util.log('Generated ICE candidate for:', candidate);
        this.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
      } else {
        util.log('ICE candidates gathering complete');
        this.emit(Negotiator.EVENTS.iceCandidatesComplete.key, pc.localDescription);
      }
    };

    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'completed':
          util.log('iceConnectionState is completed');
          // istanbul ignore next
          pc.onicecandidate = () => {};
          break;
        case 'failed':
        case 'disconnected':
          util.log(`iceConnectionState is ${pc.iceConnectionState}, closing connection`);
          this.emit(Negotiator.EVENTS.iceConnectionDisconnected.key);
          break;
        default:
          util.log(`iceConnectionState is ${pc.iceConnectionState}`);
          break;
      }
    };

    pc.onnegotiationneeded = () => {
      util.log('`negotiationneeded` triggered');

      // don't make a new offer if it's not stable
      if (pc.signalingState === 'stable') {
        if (this._originator) {
          this._makeOfferSdp()
            .then(offer => {
              this._setLocalDescription(offer);
            });
        } else {
          this.handleOffer(this._pc.remoteDescription);
        }
      }
    };

    pc.onremovestream = evt => {
      util.log('`removestream` triggered');
      this.emit(Negotiator.EVENTS.removeStream.key, evt.stream);
    };

    pc.onsignalingstatechange = () => {
      util.log(`signalingState is ${pc.signalingState}`);
    };
  }

  /**
   * Create Offer SDP.
   * @return {Promise} A promise that resolves with Offer SDP.
   * @private
   */
  _makeOfferSdp() {
    let options;
    if (this._pc.getLocalStreams().length === 0) {
      options = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      };
    } else {
      options = undefined;
    }

    return new Promise(resolve => {
      this._pc.createOffer(offer => {
        util.log('Created offer.');
        resolve(offer);
      }, error => {
        util.emitError.call(this, 'webrtc', error);
        util.log('Failed to createOffer, ', error);
      }, options);
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
          util.emitError.call(this, 'webrtc', err);
          util.log('Failed to setLocalDescription, ', err);
        });
      }, err => {
        util.emitError.call(this, 'webrtc', err);
        util.log('Failed to createAnswer, ', err);
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
        this._isExpectingAnswer = true;
        this.emit(Negotiator.EVENTS.offerCreated.key, offer);
        resolve(offer);
      }, error => {
        util.emitError.call(this, 'webrtc', error);
        util.log('Failed to setLocalDescription, ', error);
        reject(error);
      });
    });
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
        util.emitError.call(this, 'webrtc', err);
        util.log('Failed to setRemoteDescription: ', err);
      });
    });
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
   * @event Negotiator#dcCreated
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
   * Ice Candidate created.
   *
   * @event Negotiator#iceCandidate
   * @type {RTCIceCandidate}
   */

  /**
   * Ice Candidate collection finished. Emits localDescription.
   *
   * @event Negotiator#iceCandidate
   * @type {RTCSessionDescription}
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
