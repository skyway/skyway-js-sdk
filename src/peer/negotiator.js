import EventEmitter from 'events';
import Enum         from 'enum';

import sdpUtil from '../shared/sdpUtil';
import logger  from '../shared/logger';

const NegotiatorEvents = new Enum([
  'addStream',
  'removeStream',
  'dcCreated',
  'offerCreated',
  'answerCreated',
  'iceCandidate',
  'iceCandidatesComplete',
  'iceConnectionFailed',
  'negotiationNeeded',
  'error',
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
    this._replaceStreamCalled = false;
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
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   */
  startConnection(options = {}) {
    this._pc = this._createPeerConnection(options.pcConfig);
    this._setupPCListeners();
    this._originator = options.originator;
    this._audioBandwidth = options.audioBandwidth;
    this._videoBandwidth = options.videoBandwidth;
    this._audioCodec = options.audioCodec;
    this._videoCodec = options.videoCodec;
    this._type = options.type;

    if (this._type === 'media') {
      if (options.stream) {
        if (this._isAddTrackAvailable) {
          options.stream.getTracks().forEach(track => {
            this._pc.addTrack(track, options.stream);
          });
        } else {
          this._pc.addStream(options.stream);
        }
      } else if (this._originator) {
        // This means the peer wants to create offer SDP with `recvonly`
        this._makeOfferSdp().then(offer => {
          this._setLocalDescription(offer);
        });
      }
    }

    if (this._originator) {
      if (this._type === 'data') {
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
    if (!this._pc || this._replaceStreamCalled) {
      return;
    }

    // Replace the tracks in the rtpSenders if possible.
    // This doesn't require renegotiation.
    // Firefox 53 has both getSenders and getLocalStreams,
    // but Google Chrome 59 has only getLocalStreams.
    if (this._isRtpSenderAvailable) {
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

      // We don't actually need to do renegotiation but force it in order to prevent
      // problems with the stream.id being mismatched when renegotiation happens anyways
      this._pc.onnegotiationneeded();
      return;
    }

    // Manually remove and readd the entire stream if senders aren't available.
    const negotiationNeededHandler = this._pc.onnegotiationneeded;

    /* istanbul ignore next function */
    // Unset onnegotiationneeded so that it doesn't trigger on removeStream
    this._pc.onnegotiationneeded = () => {};

    const localStreams = this._pc.getLocalStreams();
    if (localStreams && localStreams[0]) {
      this._pc.removeStream(localStreams[0]);
    }

    this._replaceStreamCalled = true;

    // Restore onnegotiationneeded and addStream asynchronously to give onnegotiationneeded
    // a chance to trigger (and do nothing) on removeStream.
    setTimeout(() => {
      this._pc.onnegotiationneeded = negotiationNeededHandler;
      if (this._isAddTrackAvailable) {
        newStream.getTracks().forEach(track => {
          this._pc.addTrack(track, newStream);
        });
      } else {
        this._pc.addStream(newStream);
      }
    });
  }

  /**
   * Set remote description with remote Offer SDP, then create Answer SDP and emit it.
   * @param {object} [offerSdp] - An object containing Offer SDP.
   */
  handleOffer(offerSdp) {
    // Avoid unnecessary processing by short circuiting the code if nothing has changed in the sdp.
    if (this._lastOffer && offerSdp && this._lastOffer.sdp === offerSdp.sdp) {
      return;
    }

    if (!offerSdp) {
      offerSdp = this._lastOffer;
    }

    this._lastOffer = offerSdp;

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
      logger.log('Added ICE candidate');
    }).catch(e => {
      logger.error('Failed to add ICE candidate', e);
    });
  }

  /**
   * Close a PeerConnection.
   */
  cleanup() {
    logger.log('Cleaning up PeerConnection');

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
    logger.log('Creating RTCPeerConnection');
    this._isAddTrackAvailable = typeof RTCPeerConnection.prototype.addTrack === 'function';
    this._isOnTrackAvailable = 'ontrack' in RTCPeerConnection.prototype;
    this._isRtpSenderAvailable = typeof RTCPeerConnection.prototype.getSenders === 'function';
    this._isRtpLocalStreamsAvailable = typeof RTCPeerConnection.prototype.getLocalStreams === 'function';
    this._isAddTransceiverAvailable = typeof RTCPeerConnection.prototype.addTransceiver === 'function';

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
    if (this._isOnTrackAvailable) {
      pc.ontrack = evt => {
        logger.log('Received remote media stream');
        evt.streams.forEach(stream => {
          this.emit(Negotiator.EVENTS.addStream.key, stream);
        });
      };
    } else {
      pc.onaddstream = evt => {
        logger.log('Received remote media stream');
        const stream = evt.stream;
        this.emit(Negotiator.EVENTS.addStream.key, stream);
      };
    }

    pc.ondatachannel = evt => {
      logger.log('Received data channel');
      const dc = evt.channel;
      this.emit(Negotiator.EVENTS.dcCreated.key, dc);
    };

    pc.onicecandidate = evt => {
      const candidate = evt.candidate;
      if (candidate) {
        logger.log('Generated ICE candidate for:', candidate);
        this.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
      } else {
        logger.log('ICE candidates gathering complete');

        this.emit(Negotiator.EVENTS.iceCandidatesComplete.key, pc.localDescription);
      }
    };

    pc.oniceconnectionstatechange = () => {
      switch (pc.iceConnectionState) {
        case 'completed':
          logger.log('iceConnectionState is completed');
          // istanbul ignore next
          pc.onicecandidate = () => {};
          break;
        case 'disconnected':
          /**
           * Browsers(Chrome/Safari/Firefox) implement iceRestart with createOffer(),
           * but it seems buggy at 2017/08, so we don't use iceRestart to reconnect intensionally.
           * Ref: https://github.com/nttcom-webcore/ECLRTC-JS-SDK/pull/37
           */
          logger.log('iceConnectionState is disconnected, trying reconnect by browser');
          break;
        case 'failed':
          logger.log('iceConnectionState is failed, closing connection');
          this.emit(Negotiator.EVENTS.iceConnectionFailed.key);
          break;
        default:
          logger.log(`iceConnectionState is ${pc.iceConnectionState}`);
          break;
      }
    };

    pc.onnegotiationneeded = () => {
      logger.log('`negotiationneeded` triggered');

      // Don't make a new offer if it's not stable.
      if (pc.signalingState === 'stable') {
        // Emit negotiationNeeded event in case additional handling is needed.
        if (this._originator) {
          this._makeOfferSdp()
            .then(offer => {
              this._setLocalDescription(offer);
              this.emit(Negotiator.EVENTS.negotiationNeeded.key);
            });
        } else if (this._replaceStreamCalled) {
          this.handleOffer();
        }

        this._replaceStreamCalled = false;
      }
    };

    pc.onremovestream = evt => {
      logger.log('`removestream` triggered');
      this.emit(Negotiator.EVENTS.removeStream.key, evt.stream);
    };

    pc.onsignalingstatechange = () => {
      logger.log(`signalingState is ${pc.signalingState}`);
    };
  }

  /**
   * Create Offer SDP.
   * @return {Promise} A promise that resolves with Offer SDP.
   * @private
   */
  _makeOfferSdp() {
    let createOfferPromise;

    // if this peer is in recvonly mode
    const isRecvOnly = this._type === 'media' &&
      ((this._isRtpSenderAvailable && this._pc.getSenders().length === 0) ||
      (this._isRtpLocalStreamsAvailable && this._pc.getLocalStreams().length === 0));

    if (isRecvOnly) {
      if (this._isAddTransceiverAvailable) {
        this._pc.addTransceiver('audio').setDirection('recvonly');
        this._pc.addTransceiver('video').setDirection('recvonly');
        createOfferPromise = this._pc.createOffer();
      } else {
        createOfferPromise = this._pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
      }
    } else {
      createOfferPromise = this._pc.createOffer();
    }

    return createOfferPromise
      .then(offer => {
      logger.log('Created offer.');

      if (this._audioBandwidth) {
        offer.sdp = sdpUtil.addAudioBandwidth(offer.sdp, this._audioBandwidth);
      }
      if (this._videoBandwidth) {
        offer.sdp = sdpUtil.addVideoBandwidth(offer.sdp, this._videoBandwidth);
      }
      if (this._audioCodec) {
        offer.sdp = sdpUtil.filterAudioCodec(offer.sdp, this._audioCodec);
      }
      if (this._videoCodec) {
        offer.sdp = sdpUtil.filterVideoCodec(offer.sdp, this._videoCodec);
      }

      return Promise.resolve(offer);
    })
    .catch(error => {
      error.type = 'webrtc';
      logger.error(error);
      this.emit(Negotiator.EVENTS.error.key, error);

      logger.log('Failed to createOffer, ', error);

      return Promise.reject(error);
    });
  }

  /**
   * Make Answer SDP and set it as local description.
   * @return {Promise} A promise that is resolved when setting local SDP is completed.
   * @private
   */
  _makeAnswerSdp() {
    return this._pc.createAnswer()
      .then(answer => {
        logger.log('Created answer.');

        if (this._audioBandwidth) {
          answer.sdp = sdpUtil.addAudioBandwidth(answer.sdp, this._audioBandwidth);
        }
        if (this._videoBandwidth) {
          answer.sdp = sdpUtil.addVideoBandwidth(answer.sdp, this._videoBandwidth);
        }
        if (this._audioCodec) {
          answer.sdp = sdpUtil.filterAudioCodec(answer.sdp, this._audioCodec);
        }
        if (this._videoCodec) {
          answer.sdp = sdpUtil.filterVideoCodec(answer.sdp, this._videoCodec);
        }

        return this._pc.setLocalDescription(answer)
          .then(() => {
            logger.log('Set localDescription: answer');
            return Promise.resolve(answer);
          })
          .catch(error => {
            error.type = 'webrtc';
            logger.error(error);
            this.emit(Negotiator.EVENTS.error.key, error);

            logger.log('Failed to setLocalDescription, ', error);
            return Promise.reject(error);
          });
      })
      .catch(error => {
        error.type = 'webrtc';
        logger.error(error);
        this.emit(Negotiator.EVENTS.error.key, error);

        logger.log('Failed to createAnswer, ', error);

        return Promise.reject(error);
      });
  }

  /**
   * Set local description with Offer SDP and emit offerCreated event.
   * @param {RTCSessionDescription} offer - Offer SDP.
   * @return {Promise} A promise that is resolved with Offer SDP.
   * @private
   */
  _setLocalDescription(offer) {
    return this._pc.setLocalDescription(offer)
      .then(() => {
        logger.log('Set localDescription: offer');
        this._isExpectingAnswer = true;
        this.emit(Negotiator.EVENTS.offerCreated.key, offer);
        return Promise.resolve(offer);
      })
      .catch(error => {
        error.type = 'webrtc';
        logger.error(error);
        this.emit(Negotiator.EVENTS.error.key, error);

        logger.log('Failed to setLocalDescription, ', error);
        return Promise.reject(error);
      });
  }

  /**
   * Set remote SDP.
   * @param {object} sdp - An object containing remote SDP.
   * @return {Promise} A promise that is resolved when setting remote SDP is completed.
   * @private
   */
  _setRemoteDescription(sdp) {
    logger.log(`Setting remote description ${JSON.stringify(sdp)}`);
    return this._pc.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => {
        logger.log('Set remoteDescription:', sdp.type);
        return Promise.resolve();
      })
      .catch(error => {
        error.type = 'webrtc';
        logger.error(error);
        this.emit(Negotiator.EVENTS.error.key, error);

        logger.log('Failed to setRemoteDescription: ', error);
        return Promise.reject(error);
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
   * @event Negotiator#iceCandidatesComplete
   * @type {RTCSessionDescription}
   */

  /**
   * Ice connection failed.
   *
   * @event Negotiator#iceConnectionFailed
   */

  /**
   * Session needs negotiation.
   *
   * @event Negotiator#negotiationNeeded
   */

  /**
   * Error occurred.
   *
   * @event Negotiator#error
   * @type {Error}
   */
}

export default Negotiator;
