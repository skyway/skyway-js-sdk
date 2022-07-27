import EventEmitter from 'events';
import Enum from 'enum';

import sdpUtil from '../shared/sdpUtil';
import logger from '../shared/logger';

const NegotiatorEvents = new Enum([
  'addStream',
  'dcCreated',
  'offerCreated',
  'answerCreated',
  'iceCandidate',
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
    this._isNegotiationAllowed = true;
    this._isExecutingHandleOffer = false;
    this.hasRemoteDescription = false;
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
   * @return {Promise<void>} Promise that resolves when starting is done.
   */
  async startConnection(options = {}) {
    this._pc = this._createPeerConnection(options.pcConfig);
    this._setupPCListeners();
    this.originator = options.originator;
    this._audioBandwidth = options.audioBandwidth;
    this._videoBandwidth = options.videoBandwidth;
    this._audioCodec = options.audioCodec;
    this._videoCodec = options.videoCodec;
    this._type = options.type;

    // Trigger negotiationneeded event
    if (this._type === 'media') {
      // video+audio or video only or audio only stream passed
      if (options.stream) {
        const vTracks = options.stream.getVideoTracks();
        const aTracks = options.stream.getAudioTracks();
        const recvonlyState = this._getReceiveOnlyState(options);

        // create m= section w/ direction sendrecv
        if (vTracks.length > 0) {
          vTracks.forEach(track => this._pc.addTrack(track, options.stream));
        }
        // create m= section w/ direction recvonly or omit whole m= section
        else {
          recvonlyState.video &&
            this._pc.addTransceiver('video', { direction: 'recvonly' });
        }

        if (aTracks.length > 0) {
          aTracks.forEach(track => this._pc.addTrack(track, options.stream));
        } else {
          recvonlyState.audio &&
            this._pc.addTransceiver('audio', { direction: 'recvonly' });
        }
      }
      // if offer side and stream not passed, make it recvonly(= backward compat)
      else if (this.originator) {
        this._pc.addTransceiver('audio', { direction: 'recvonly' });
        this._pc.addTransceiver('video', { direction: 'recvonly' });
      }
    }

    if (this.originator) {
      if (this._type === 'data') {
        const label = options.label || '';
        const dcInit = options.dcInit || {};
        const dc = this._pc.createDataChannel(label, dcInit);
        this.emit(Negotiator.EVENTS.dcCreated.key, dc);
      }
    } else {
      await this.handleOffer(options.offer);
    }
  }

  /**
   * Replace the stream being sent with a new one.
   * Video and audio tracks are updated per track by using `{add|replace|remove}Track` methods.
   * We assume that there is at most 1 audio and at most 1 video in local stream.
   * @param {MediaStream} newStream - The stream to replace the old stream with.
   * @private
   */
  replaceStream(newStream) {
    // If negotiator is null
    // or replaceStream was called but `onnegotiationneeded` event has not finished yet.
    if (!this._pc) {
      return;
    }

    this._isNegotiationAllowed = true;

    const _this = this;
    const vTracks = newStream.getVideoTracks();
    const aTracks = newStream.getAudioTracks();

    const senders = this._pc.getSenders();
    const vSender = senders.find(
      sender => sender.track && sender.track.kind === 'video'
    );
    const aSender = senders.find(
      sender => sender.track && sender.track.kind === 'audio'
    );

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
   * Set remote description with remote Offer SDP, then create Answer SDP and emit it.
   * @param {object} [offerSdp] - An object containing Offer SDP.
   * @return {Promise<void>} Promise that resolves when handling offer is done.
   */
  async handleOffer(offerSdp) {
    // Avoid unnecessary processing by short circuiting the code if nothing has changed in the sdp.
    if (this._lastOffer && offerSdp && this._lastOffer.sdp === offerSdp.sdp) {
      return;
    }

    this._isNegotiationAllowed = true;

    // Enqueue and skip while signalingState is wrong state or executing handleOffer.
    // (when room is SFU and there are multiple conns in a same time, it happens)
    if (
      this._pc.signalingState === 'have-remote-offer' ||
      this._isExecutingHandleOffer
    ) {
      this._offerQueue.push(offerSdp);
      return;
    }

    this._lastOffer = offerSdp;
    this._isExecutingHandleOffer = true;
    let answer;
    try {
      await this._setRemoteDescription(offerSdp);
      answer = await this._makeAnswerSdp().catch(err => logger.error(err));
    } finally {
      this._isExecutingHandleOffer = false;
    }

    // Apply pended remote offer which was stored when signalingState is wrong state or executing handleOffer.
    if (this._pc.signalingState === 'stable') {
      const offer = this._offerQueue.shift();
      if (offer) {
        this.handleOffer(offer);
      }
    }

    this.emit(Negotiator.EVENTS.answerCreated.key, answer);
  }

  /**
   * Set remote description with Answer SDP.
   * @param {object} answerSdp - An object containing Answer SDP.
   */
  async handleAnswer(answerSdp) {
    this._isNegotiationAllowed = true;

    if (this._isExpectingAnswer) {
      await this._setRemoteDescription(answerSdp);
      this._isExpectingAnswer = false;
    } else if (this._pc.onnegotiationneeded) {
      // manually trigger negotiation
      this._pc.onnegotiationneeded();
    }
  }

  /**
   * Set ice candidate with Candidate SDP.
   * @param {object} candidate - An object containing Candidate SDP.
   * @return {Promise<void>} Promise that resolves when handling candidate is done.
   */
  async handleCandidate(candidate) {
    if (!this._pc) {
      return;
    }

    await this._pc
      .addIceCandidate(new RTCIceCandidate(candidate))
      .then(() => logger.log('Successfully added ICE candidate'))
      .catch(err => logger.error('Failed to add ICE candidate', err));
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
  _createPeerConnection(pcConfig = {}) {
    logger.log('Creating RTCPeerConnection');
    // prevent from user passing plan-b
    pcConfig.sdpSemantics = 'unified-plan';
    return new RTCPeerConnection(pcConfig);
  }

  /**
   * Set up event handlers of RTCPeerConnection events.
   * @private
   */
  _setupPCListeners() {
    const pc = this._pc;

    pc.ontrack = evt => {
      logger.log('Received remote media stream track');
      evt.streams.forEach(stream => {
        this.emit(Negotiator.EVENTS.addStream.key, stream);
      });
    };

    pc.ondatachannel = evt => {
      logger.log('Received data channel');
      const dc = evt.channel;
      this.emit(Negotiator.EVENTS.dcCreated.key, dc);
    };

    pc.onicecandidate = evt => {
      /**
       * Signals end-of-candidates by
       *
       * Firefox 68~
       * evt = { candidate: RTCIceCandidate({ candidate: "" }) and
       * evt = { candidate: null }
       *
       * Firefox ~67, Chrome, Safari
       * evt = { candidate: null }
       */
      if (!evt.candidate || evt.candidate.candidate === '') {
        logger.log('ICE candidates gathering complete');
        return;
      }

      logger.log('Generated ICE candidate for:', evt.candidate);
      this.emit(Negotiator.EVENTS.iceCandidate.key, evt.candidate);
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
    // from M76, iceConnectionState does not go to `failed` when connection dropps.
    // See https://bugs.chromium.org/p/chromium/issues/detail?id=982793
    // we polyfill it until it is resolved w/ API only Chrome implements to keep SDK behavior.
    pc.onconnectionstatechange = () => {
      logger.log(`connectionState is ${pc.connectionState}`);
      if (
        pc.connectionState === 'failed' &&
        // this must be `disconnected`, but ensure it
        pc.iceConnectionState === 'disconnected'
      ) {
        logger.log('connectionState is failed, closing connection');
        this.emit(Negotiator.EVENTS.iceConnectionFailed.key);
      }
    };

    pc.onnegotiationneeded = async () => {
      logger.log('`negotiationneeded` triggered');

      // Don't make a new offer if it's not stable or if onnegotiationneeded is called consecutively.
      // Chrome 65+ called onnegotiationneeded once per addTrack so force it to run only once.
      if (pc.signalingState === 'stable' && this._isNegotiationAllowed) {
        this._isNegotiationAllowed = false;
        // Emit negotiationNeeded event in case additional handling is needed.
        if (this.originator) {
          const offer = await this._makeOfferSdp();
          this._setLocalDescription(offer);
          this.emit(Negotiator.EVENTS.negotiationNeeded.key);
        }
      }
    };

    pc.onsignalingstatechange = () => {
      logger.log(`signalingState is ${pc.signalingState}`);

      // After signaling state is getting back to 'stable',
      // If _isExecutingHandleOffer is false,
      // apply pended remote offer, which was stored when simultaneous multiple conns happened in SFU room,
      //
      // This event is fired the moment setLD completes.
      // Therefore, _isExecutingHandleOffer is basically considered to be True.
      // Normally, handleOffer reexecution using queued offer is performed
      // after setting _isExecutingHandleOffer to false in handleOffer.
      if (pc.signalingState === 'stable' && !this._isExecutingHandleOffer) {
        const offer = this._offerQueue.shift();
        if (offer) {
          this.handleOffer(offer);
        }
      }
    };
  }

  /**
   * Create Offer SDP.
   * @return {Promise<Object>} A promise that resolves with Offer SDP.
   * @private
   */
  async _makeOfferSdp() {
    let offer;

    try {
      offer = await this._pc.createOffer();
    } catch (err) {
      err.type = 'webrtc';
      logger.error(err);
      this.emit(Negotiator.EVENTS.error.key, err);

      logger.log('Failed to createOffer, ', err);
      throw err;
    }

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

    return offer;
  }

  /**
   * Make Answer SDP and set it as local description.
   * @return {Promise<Object>} A promise that is resolved with answer when setting local SDP is completed.
   * @private
   */
  async _makeAnswerSdp() {
    let answer;
    try {
      answer = await this._pc.createAnswer();
    } catch (err) {
      err.type = 'webrtc';
      logger.error(err);
      this.emit(Negotiator.EVENTS.error.key, err);

      logger.log('Failed to createAnswer, ', err);
      throw err;
    }

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

    try {
      await this._pc.setLocalDescription(answer);
    } catch (err) {
      err.type = 'webrtc';
      logger.error(err);
      this.emit(Negotiator.EVENTS.error.key, err);

      logger.log('Failed to setLocalDescription, ', err);
      throw err;
    }

    logger.log('Set localDescription: answer');
    logger.log(`Setting local description ${JSON.stringify(answer.sdp)}`);

    return answer;
  }

  /**
   * Set local description with Offer SDP and emit offerCreated event.
   * @param {RTCSessionDescription} offer - Offer SDP.
   * @return {Promise<void>} A promise that is resolved when setting local SDP is completed.
   * @private
   */
  async _setLocalDescription(offer) {
    logger.log(`Setting local description ${JSON.stringify(offer.sdp)}`);

    try {
      await this._pc.setLocalDescription(offer);
    } catch (err) {
      err.type = 'webrtc';
      logger.error(err);
      this.emit(Negotiator.EVENTS.error.key, err);

      logger.log('Failed to setLocalDescription, ', err);
      throw err;
    }

    logger.log('Set localDescription: offer');
    this._isExpectingAnswer = true;
    this.emit(Negotiator.EVENTS.offerCreated.key, offer);
  }

  /**
   * Set remote SDP.
   * @param {object} sdp - An object containing remote SDP.
   * @return {Promise<void>} A promise that is resolved when setting remote SDP is completed.
   * @private
   */
  async _setRemoteDescription(sdp) {
    logger.log(`Setting remote description ${JSON.stringify(sdp)}`);

    try {
      await this._pc.setRemoteDescription(new RTCSessionDescription(sdp));
      this.hasRemoteDescription = true;
    } catch (err) {
      err.type = 'webrtc';
      logger.error(err);
      this.emit(Negotiator.EVENTS.error.key, err);

      logger.log('Failed to setRemoteDescription: ', err);
      throw err;
    }

    logger.log('Set remoteDescription:', sdp.type);
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
