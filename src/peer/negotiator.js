import EventEmitter from 'events';
import Enum from 'enum';

import sdpUtil from '../shared/sdpUtil';
import logger from '../shared/logger';
import util from '../shared/util';

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
    this._offerQueue = [];
    this._isExpectingAnswer = false;
    this._replaceStreamCalled = false;
    this._isNegotiationAllowed = true;
  }

  /**
   * Class that manages RTCPeerConnection and SDP exchange.
   * @param {object} [options] - Optional arguments for starting connection.
   * @param {string} [options.type] - Type of connection. One of 'media' or 'data'.
   * @param {MediaStream} [options._stream] - The MediaStream to be sent to the remote peer.
   * @param {string} [options.label] - Label to easily identify the connection on either peer.
   * @param {Object} [options.dcInit] - Options passed to createDataChannel() as a RTCDataChannelInit.
   *                  See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit
   * @param {boolean} [options.originator] - true means the peer is the originator of the connection.
   * @param {RTCSessionDescription} [options.offer]
   *        - The local description. If the peer is originator, handleOffer is called with it.
   * @param {object} [options.pcConfig] - A RTCConfiguration dictionary for the RTCPeerConnection.
   * @param {number} [options.videoBandwidth] - A max video bandwidth(kbps)
   * @param {number} [options.audioBandwidth] - A max audio bandwidth(kbps)
   * @param {string} [options.videoCodec] - A video codec like 'H264'
   * @param {string} [options.audioCodec] - A video codec like 'PCMU'
   * @param {boolean} [options.videoReceiveEnabled] - A flag to set video recvonly
   * @param {boolean} [options.audioReceiveEnabled] - A flag to set audio recvonly
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
    this._recvonlyState = this._getReceiveOnlyState(options);
    this._remoteBrowser = {};

    if (this._type === 'media') {
      if (options.stream) {
        if (this._isAddTrackAvailable && !this._isForceUseStreamMethods) {
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
        const dcInit = options.dcInit || {};
        const dc = this._pc.createDataChannel(label, dcInit);
        this.emit(Negotiator.EVENTS.dcCreated.key, dc);
      }
    } else {
      this.handleOffer(options.offer);
    }
  }

  setRemoteBrowser(browser) {
    this._remoteBrowser = browser;
  }

  /**
   * Replace the stream being sent with a new one.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   */
  replaceStream(newStream) {
    // If negotiator is null
    // or replaceStream was called but `onnegotiationneeded` event has not finished yet.
    if (!this._pc) {
      return;
    }

    this._isNegotiationAllowed = true;

    // Replace the tracks in the rtpSenders if possible.
    // This doesn't require renegotiation.
    if (this._isRtpSenderAvailable && !this._isForceUseStreamMethods) {
      this._replacePerTrack(newStream);
    } else if (!this._replaceStreamCalled) {
      // _replacePerStream is used for Chrome 64 and below. All other browsers should have track methods implemented.
      // We can delete _replacePerStream after Chrome 64 is no longer supported.
      this._replacePerStream(newStream);
    }
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

    this._isNegotiationAllowed = true;

    if (!offerSdp) {
      offerSdp = this._lastOffer;
    }

    this._lastOffer = offerSdp;

    // Enqueue and skip while signalingState is wrong state.
    // (when room is SFU and there are multiple conns in a same time, it happens)
    if (this._pc.signalingState === 'have-remote-offer') {
      this._offerQueue.push(offerSdp);
      return;
    }

    this._setRemoteDescription(offerSdp)
      .then(() => {
        return this._makeAnswerSdp();
      })
      .then(answer => {
        this.emit(Negotiator.EVENTS.answerCreated.key, answer);
      })
      .catch(err => {
        logger.error(err);
      });
  }

  /**
   * Set remote description with Answer SDP.
   * @param {object} answerSdp - An object containing Answer SDP.
   */
  handleAnswer(answerSdp) {
    this._isNegotiationAllowed = true;

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
    this._pc
      .addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => {
        logger.log('Added ICE candidate');
      })
      .catch(e => {
        logger.error('Failed to add ICE candidate', e);
      });
  }

  /**
   * Close a PeerConnection.
   */
  cleanup() {
    logger.log('Cleaning up PeerConnection');

    if (
      this._pc &&
      (this._pc.readyState !== 'closed' || this._pc.signalingState !== 'closed')
    ) {
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
    this._isAddTrackAvailable =
      typeof RTCPeerConnection.prototype.addTrack === 'function';
    this._isOnTrackAvailable = 'ontrack' in RTCPeerConnection.prototype;
    this._isRtpSenderAvailable =
      typeof RTCPeerConnection.prototype.getSenders === 'function';
    this._isAddTransceiverAvailable =
      typeof RTCPeerConnection.prototype.addTransceiver === 'function';

    // If browser is Chrome 64, we use addStream/replaceStream instead of addTrack/replaceTrack.
    // Because Chrome can't call properly to Firefox using track methods.
    const browserInfo = util.detectBrowser();
    this._isForceUseStreamMethods =
      browserInfo.name === 'chrome' && browserInfo.major <= 64;

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
    if (this._isOnTrackAvailable && !this._isForceUseStreamMethods) {
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

        this.emit(
          Negotiator.EVENTS.iceCandidatesComplete.key,
          pc.localDescription
        );
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
          logger.log(
            'iceConnectionState is disconnected, trying reconnect by browser'
          );
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

      // Don't make a new offer if it's not stable or if onnegotiationneeded is called consecutively.
      // Chrome 65 called onnegotiationneeded once per addTrack so force it to run only once.
      if (pc.signalingState === 'stable' && this._isNegotiationAllowed) {
        this._isNegotiationAllowed = false;
        // Emit negotiationNeeded event in case additional handling is needed.
        if (this._originator) {
          this._makeOfferSdp().then(offer => {
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

      // After signaling state is getting back to 'stable',
      // apply pended remote offer, which was stored when simultaneous multiple conns happened in SFU room,
      // Note that this code very rarely applies the old remote offer.
      // E.g. "Offer A -> Offer B" should be the right order but for some reason like NW unstablity,
      //      offerQueue might keep "Offer B" first and handle "Offer A" later.
      if (pc.signalingState === 'stable') {
        const offer = this._offerQueue.shift();
        if (offer) {
          this.handleOffer(offer);
        }
      }
    };
  }

  /**
   * Create Offer SDP.
   * @return {Promise} A promise that resolves with Offer SDP.
   * @private
   */
  _makeOfferSdp() {
    let createOfferPromise;

    // DataConnection
    if (this._type !== 'media') {
      createOfferPromise = this._pc.createOffer();
      // MediaConnection
    } else {
      if (this._isAddTransceiverAvailable) {
        this._recvonlyState.audio &&
          this._pc.addTransceiver('audio', { direction: 'recvonly' });
        this._recvonlyState.video &&
          this._pc.addTransceiver('video', { direction: 'recvonly' });
        createOfferPromise = this._pc.createOffer();
      } else {
        const offerOptions = {};
        // the offerToReceiveXXX options are defined in the specs as boolean but `undefined` acts differently from false
        this._recvonlyState.audio && (offerOptions.offerToReceiveAudio = true);
        this._recvonlyState.video && (offerOptions.offerToReceiveVideo = true);
        createOfferPromise = this._pc.createOffer(offerOptions);
      }
    }

    return createOfferPromise
      .then(offer => {
        logger.log('Created offer.');

        if (this._audioBandwidth) {
          offer.sdp = sdpUtil.addAudioBandwidth(
            offer.sdp,
            this._audioBandwidth
          );
        }
        if (this._videoBandwidth) {
          offer.sdp = sdpUtil.addVideoBandwidth(
            offer.sdp,
            this._videoBandwidth
          );
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
    return this._pc
      .createAnswer()
      .then(answer => {
        logger.log('Created answer.');

        if (this._audioBandwidth) {
          answer.sdp = sdpUtil.addAudioBandwidth(
            answer.sdp,
            this._audioBandwidth
          );
        }
        if (this._videoBandwidth) {
          answer.sdp = sdpUtil.addVideoBandwidth(
            answer.sdp,
            this._videoBandwidth
          );
        }
        if (this._audioCodec) {
          answer.sdp = sdpUtil.filterAudioCodec(answer.sdp, this._audioCodec);
        }
        if (this._videoCodec) {
          answer.sdp = sdpUtil.filterVideoCodec(answer.sdp, this._videoCodec);
        }

        return this._pc
          .setLocalDescription(answer)
          .then(() => {
            logger.log('Set localDescription: answer');
            logger.log(
              `Setting local description ${JSON.stringify(answer.sdp)}`
            );
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
    logger.log(`Setting local description ${JSON.stringify(offer.sdp)}`);
    return this._pc
      .setLocalDescription(offer)
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
    return this._pc
      .setRemoteDescription(new RTCSessionDescription(sdp))
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
   * Get map object describes which kinds of tracks should be marked as recvonly
   * @param {Object} options - Options of peer.call()
   * @return {Object} Map object which streamTrack will be recvonly or not
   */
  _getReceiveOnlyState(options = {}) {
    const state = {
      audio: false,
      video: false,
    };

    const hasStream = options.stream instanceof MediaStream;
    const hasAudioTrack = hasStream
      ? options.stream.getAudioTracks().length !== 0
      : false;
    const hasVideoTrack = hasStream
      ? options.stream.getVideoTracks().length !== 0
      : false;

    // force true if stream not passed(backward compatibility)
    if (
      hasStream === false &&
      options.audioReceiveEnabled === undefined &&
      options.videoReceiveEnabled === undefined
    ) {
      state.audio = true;
      state.video = true;
      return state;
    }

    // Set recvonly to true if `stream does not have track` and `option is true` case only
    if (options.audioReceiveEnabled && hasAudioTrack === false) {
      state.audio = true;
    }
    if (options.videoReceiveEnabled && hasVideoTrack === false) {
      state.video = true;
    }

    // If stream has track, ignore options, which results in setting sendrecv internally.
    if (options.audioReceiveEnabled === false && hasAudioTrack) {
      logger.warn(
        'Option audioReceiveEnabled will be treated as true, because passed stream has MediaStreamTrack(kind = audio)'
      );
    }
    if (options.videoReceiveEnabled === false && hasVideoTrack) {
      logger.warn(
        'Option videoReceiveEnabled will be treated as true, because passed stream has MediaStreamTrack(kind = video)'
      );
    }

    return state;
  }

  /**
   * Replace the stream being sent with a new one.
   * Video and audio are replaced per track by using `xxxTrack` methods.
   * We assume that there is at most 1 audio and at most 1 video in local stream.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   * @private
   */
  _replacePerTrack(newStream) {
    const _this = this;
    const vTracks = newStream.getVideoTracks();
    const aTracks = newStream.getAudioTracks();

    const senders = this._pc.getSenders();
    const vSender = senders.find(sender => sender.track.kind === 'video');
    const aSender = senders.find(sender => sender.track.kind === 'audio');

    _updateSenderWithTrack(vSender, vTracks[0], newStream);
    _updateSenderWithTrack(aSender, aTracks[0], newStream);

    /**
     * Replace a track being sent with a new one.
     * @param {RTCRtpSender} sender - The sender which type is video or audio.
     * @param {MediaStreamTrack} track - The track of new stream.
     * @param {MediaStream} stream - The stream which contains the track.
     * @private
     */
    function _updateSenderWithTrack(sender, track, stream) {
      if (track === undefined && sender === undefined) {
        return;
      }
      // remove video or audio sender if not passed
      if (track === undefined) {
        _this._pc.removeTrack(sender);
        return;
      }
      // if passed, replace track or create sender
      if (sender === undefined) {
        _this._pc.addTrack(track, stream);
        return;
      }
      // if track was not replaced, do nothing
      if (sender.track.id === track.id) {
        return;
      }
      sender.replaceTrack(track);
    }
  }

  /**
   * Replace the stream being sent with a new one.
   * Video and audio are replaced per stream by using `xxxStream` methods.
   * This method is used in some browsers which don't implement `xxxTrack` methods.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   * @private
   */
  _replacePerStream(newStream) {
    const localStreams = this._pc.getLocalStreams();

    const origOnNegotiationNeeded = this._pc.onnegotiationneeded;
    this._pc.onnegotiationneeded = () => {};

    // We assume that there is at most 1 stream in localStreams
    if (localStreams.length > 0) {
      this._pc.removeStream(localStreams[0]);
    }

    // HACK: For some reason FF59 doesn't work when Chrome 64 renegotiates after updating the stream.
    // However, simply updating the localDescription updates the remote stream if the other browser is firefox 59+.
    // Chrome 64 probably uses replaceTrack-like functions internally.
    const isRemoteBrowserNeedRenegotiation =
      this._remoteBrowser &&
      this._remoteBrowser.name === 'firefox' &&
      this._remoteBrowser.major >= 59;
    if (isRemoteBrowserNeedRenegotiation) {
      this._pc.addStream(newStream);

      // use setTimeout to trigger (and do nothing) on add/removeStream.
      setTimeout(() => {
        // update the localDescription with the new stream information (after getting to the right state)
        let promise;
        if (this._originator) {
          promise = this._makeOfferSdp()
            .then(offer => {
              return this._pc.setLocalDescription(offer);
            })
            .then(() => {
              return this._pc.setRemoteDescription(this._pc.remoteDescription);
            });
        } else {
          promise = this._pc
            .setRemoteDescription(this._pc.remoteDescription)
            .then(() => {
              return this._pc.createAnswer();
            })
            .then(answer => {
              return this._pc.setLocalDescription(answer);
            });
        }
        // restore onnegotiationneeded in case we need it later.
        promise
          .then(() => {
            this._pc.onnegotiationneeded = origOnNegotiationNeeded;
          })
          .catch(err => {
            logger.error(err);
            this._pc.onnegotiationneeded = origOnNegotiationNeeded;
          });
      });
    } else {
      // this is the normal flow where we renegotiate.
      this._replaceStreamCalled = true;

      // use setTimeout to trigger (and do nothing) on removeStream.
      setTimeout(() => {
        // onnegotiationneeded will be triggered by addStream.
        this._pc.addStream(newStream);
        this._pc.onnegotiationneeded = origOnNegotiationNeeded;
      });
    }
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
