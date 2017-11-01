'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

var _sdpUtil = require('../shared/sdpUtil');

var _sdpUtil2 = _interopRequireDefault(_sdpUtil);

var _logger = require('../shared/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var NegotiatorEvents = new _enum2.default(['addStream', 'removeStream', 'dcCreated', 'offerCreated', 'answerCreated', 'iceCandidate', 'iceCandidatesComplete', 'iceConnectionFailed', 'negotiationNeeded', 'error']);

/**
 * Class that manages RTCPeerConnection and SDP exchange.
 * @extends EventEmitter
 */

var Negotiator = function (_EventEmitter) {
  _inherits(Negotiator, _EventEmitter);

  /**
   * Create a negotiator
   * @param {string} name - Room name.
   */
  function Negotiator() {
    _classCallCheck(this, Negotiator);

    var _this = _possibleConstructorReturn(this, (Negotiator.__proto__ || Object.getPrototypeOf(Negotiator)).call(this));

    _this._isExpectingAnswer = false;
    _this._replaceStreamCalled = false;
    return _this;
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


  _createClass(Negotiator, [{
    key: 'startConnection',
    value: function startConnection() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

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
            options.stream.getTracks().forEach(function (track) {
              _this2._pc.addTrack(track, options.stream);
            });
          } else {
            this._pc.addStream(options.stream);
          }
        } else if (this._originator) {
          // This means the peer wants to create offer SDP with `recvonly`
          this._makeOfferSdp().then(function (offer) {
            _this2._setLocalDescription(offer);
          });
        }
      }

      if (this._originator) {
        if (this._type === 'data') {
          var label = options.label || '';
          var dc = this._pc.createDataChannel(label);
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

  }, {
    key: 'replaceStream',
    value: function replaceStream(newStream) {
      var _this3 = this;

      if (!this._pc || this._replaceStreamCalled) {
        return;
      }

      // Replace the tracks in the rtpSenders if possible.
      // This doesn't require renegotiation.
      // Firefox 53 has both getSenders and getLocalStreams,
      // but Google Chrome 59 has only getLocalStreams.
      if (this._isRtpSenderAvailable) {
        this._pc.getSenders().forEach(function (sender) {
          var tracks = void 0;
          if (sender.track.kind === 'audio') {
            tracks = newStream.getAudioTracks();
          } else if (sender.track.kind === 'video') {
            tracks = newStream.getVideoTracks();
          }

          if (tracks && tracks[0]) {
            sender.replaceTrack(tracks[0]);
          } else {
            _this3._pc.removeTrack(sender);
          }
        });

        // We don't actually need to do renegotiation but force it in order to prevent
        // problems with the stream.id being mismatched when renegotiation happens anyways
        this._pc.onnegotiationneeded();
        return;
      }

      // Manually remove and readd the entire stream if senders aren't available.
      var negotiationNeededHandler = this._pc.onnegotiationneeded;

      /* istanbul ignore next function */
      // Unset onnegotiationneeded so that it doesn't trigger on removeStream
      this._pc.onnegotiationneeded = function () {};

      var localStreams = this._pc.getLocalStreams();
      if (localStreams && localStreams[0]) {
        this._pc.removeStream(localStreams[0]);
      }

      this._replaceStreamCalled = true;

      // Restore onnegotiationneeded and addStream asynchronously to give onnegotiationneeded
      // a chance to trigger (and do nothing) on removeStream.
      setTimeout(function () {
        _this3._pc.onnegotiationneeded = negotiationNeededHandler;
        if (_this3._isAddTrackAvailable) {
          newStream.getTracks().forEach(function (track) {
            _this3._pc.addTrack(track, newStream);
          });
        } else {
          _this3._pc.addStream(newStream);
        }
      });
    }

    /**
     * Set remote description with remote Offer SDP, then create Answer SDP and emit it.
     * @param {object} [offerSdp] - An object containing Offer SDP.
     */

  }, {
    key: 'handleOffer',
    value: function handleOffer(offerSdp) {
      var _this4 = this;

      // Avoid unnecessary processing by short circuiting the code if nothing has changed in the sdp.
      if (this._lastOffer && offerSdp && this._lastOffer.sdp === offerSdp.sdp) {
        return;
      }

      if (!offerSdp) {
        offerSdp = this._lastOffer;
      }

      this._lastOffer = offerSdp;

      this._setRemoteDescription(offerSdp).then(function () {
        return _this4._makeAnswerSdp();
      }).then(function (answer) {
        _this4.emit(Negotiator.EVENTS.answerCreated.key, answer);
      });
    }

    /**
     * Set remote description with Answer SDP.
     * @param {object} answerSdp - An object containing Answer SDP.
     */

  }, {
    key: 'handleAnswer',
    value: function handleAnswer(answerSdp) {
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

  }, {
    key: 'handleCandidate',
    value: function handleCandidate(candidate) {
      this._pc.addIceCandidate(new RTCIceCandidate(candidate)).then(function () {
        _logger2.default.log('Added ICE candidate');
      }).catch(function (e) {
        _logger2.default.error('Failed to add ICE candidate', e);
      });
    }

    /**
     * Close a PeerConnection.
     */

  }, {
    key: 'cleanup',
    value: function cleanup() {
      _logger2.default.log('Cleaning up PeerConnection');

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

  }, {
    key: '_createPeerConnection',
    value: function _createPeerConnection(pcConfig) {
      _logger2.default.log('Creating RTCPeerConnection');
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

  }, {
    key: '_setupPCListeners',
    value: function _setupPCListeners() {
      var _this5 = this;

      var pc = this._pc;
      if (this._isOnTrackAvailable) {
        pc.ontrack = function (evt) {
          _logger2.default.log('Received remote media stream');
          evt.streams.forEach(function (stream) {
            _this5.emit(Negotiator.EVENTS.addStream.key, stream);
          });
        };
      } else {
        pc.onaddstream = function (evt) {
          _logger2.default.log('Received remote media stream');
          var stream = evt.stream;
          _this5.emit(Negotiator.EVENTS.addStream.key, stream);
        };
      }

      pc.ondatachannel = function (evt) {
        _logger2.default.log('Received data channel');
        var dc = evt.channel;
        _this5.emit(Negotiator.EVENTS.dcCreated.key, dc);
      };

      pc.onicecandidate = function (evt) {
        var candidate = evt.candidate;
        if (candidate) {
          _logger2.default.log('Generated ICE candidate for:', candidate);
          _this5.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
        } else {
          _logger2.default.log('ICE candidates gathering complete');

          _this5.emit(Negotiator.EVENTS.iceCandidatesComplete.key, pc.localDescription);
        }
      };

      pc.oniceconnectionstatechange = function () {
        switch (pc.iceConnectionState) {
          case 'completed':
            _logger2.default.log('iceConnectionState is completed');
            // istanbul ignore next
            pc.onicecandidate = function () {};
            break;
          case 'disconnected':
            /**
             * Browsers(Chrome/Safari/Firefox) implement iceRestart with createOffer(),
             * but it seems buggy at 2017/08, so we don't use iceRestart to reconnect intensionally.
             * Ref: https://github.com/nttcom-webcore/ECLRTC-JS-SDK/pull/37
             */
            _logger2.default.log('iceConnectionState is disconnected, trying reconnect by browser');
            break;
          case 'failed':
            _logger2.default.log('iceConnectionState is failed, closing connection');
            _this5.emit(Negotiator.EVENTS.iceConnectionFailed.key);
            break;
          default:
            _logger2.default.log('iceConnectionState is ' + pc.iceConnectionState);
            break;
        }
      };

      pc.onnegotiationneeded = function () {
        _logger2.default.log('`negotiationneeded` triggered');

        // Don't make a new offer if it's not stable.
        if (pc.signalingState === 'stable') {
          // Emit negotiationNeeded event in case additional handling is needed.
          if (_this5._originator) {
            _this5._makeOfferSdp().then(function (offer) {
              _this5._setLocalDescription(offer);
              _this5.emit(Negotiator.EVENTS.negotiationNeeded.key);
            });
          } else if (_this5._replaceStreamCalled) {
            _this5.handleOffer();
          }

          _this5._replaceStreamCalled = false;
        }
      };

      pc.onremovestream = function (evt) {
        _logger2.default.log('`removestream` triggered');
        _this5.emit(Negotiator.EVENTS.removeStream.key, evt.stream);
      };

      pc.onsignalingstatechange = function () {
        _logger2.default.log('signalingState is ' + pc.signalingState);
      };
    }

    /**
     * Create Offer SDP.
     * @return {Promise} A promise that resolves with Offer SDP.
     * @private
     */

  }, {
    key: '_makeOfferSdp',
    value: function _makeOfferSdp() {
      var _this6 = this;

      var createOfferPromise = void 0;

      // if this peer is in recvonly mode
      var isRecvOnly = this._type === 'media' && (this._isRtpSenderAvailable && this._pc.getSenders().length === 0 || this._isRtpLocalStreamsAvailable && this._pc.getLocalStreams().length === 0);

      if (isRecvOnly) {
        if (this._isAddTransceiverAvailable) {
          this._pc.addTransceiver('audio').setDirection('recvonly');
          this._pc.addTransceiver('video').setDirection('recvonly');
          createOfferPromise = this._pc.createOffer();
        } else {
          createOfferPromise = this._pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          });
        }
      } else {
        createOfferPromise = this._pc.createOffer();
      }

      return createOfferPromise.then(function (offer) {
        _logger2.default.log('Created offer.');

        if (_this6._audioBandwidth) {
          offer.sdp = _sdpUtil2.default.addAudioBandwidth(offer.sdp, _this6._audioBandwidth);
        }
        if (_this6._videoBandwidth) {
          offer.sdp = _sdpUtil2.default.addVideoBandwidth(offer.sdp, _this6._videoBandwidth);
        }
        if (_this6._audioCodec) {
          offer.sdp = _sdpUtil2.default.filterAudioCodec(offer.sdp, _this6._audioCodec);
        }
        if (_this6._videoCodec) {
          offer.sdp = _sdpUtil2.default.filterVideoCodec(offer.sdp, _this6._videoCodec);
        }

        return Promise.resolve(offer);
      }).catch(function (error) {
        error.type = 'webrtc';
        _logger2.default.error(error);
        _this6.emit(Negotiator.EVENTS.error.key, error);

        _logger2.default.log('Failed to createOffer, ', error);

        return Promise.reject(error);
      });
    }

    /**
     * Make Answer SDP and set it as local description.
     * @return {Promise} A promise that is resolved when setting local SDP is completed.
     * @private
     */

  }, {
    key: '_makeAnswerSdp',
    value: function _makeAnswerSdp() {
      var _this7 = this;

      return this._pc.createAnswer().then(function (answer) {
        _logger2.default.log('Created answer.');

        if (_this7._audioBandwidth) {
          answer.sdp = _sdpUtil2.default.addAudioBandwidth(answer.sdp, _this7._audioBandwidth);
        }
        if (_this7._videoBandwidth) {
          answer.sdp = _sdpUtil2.default.addVideoBandwidth(answer.sdp, _this7._videoBandwidth);
        }
        if (_this7._audioCodec) {
          answer.sdp = _sdpUtil2.default.filterAudioCodec(answer.sdp, _this7._audioCodec);
        }
        if (_this7._videoCodec) {
          answer.sdp = _sdpUtil2.default.filterVideoCodec(answer.sdp, _this7._videoCodec);
        }

        return _this7._pc.setLocalDescription(answer).then(function () {
          _logger2.default.log('Set localDescription: answer');
          return Promise.resolve(answer);
        }).catch(function (error) {
          error.type = 'webrtc';
          _logger2.default.error(error);
          _this7.emit(Negotiator.EVENTS.error.key, error);

          _logger2.default.log('Failed to setLocalDescription, ', error);
          return Promise.reject(error);
        });
      }).catch(function (error) {
        error.type = 'webrtc';
        _logger2.default.error(error);
        _this7.emit(Negotiator.EVENTS.error.key, error);

        _logger2.default.log('Failed to createAnswer, ', error);

        return Promise.reject(error);
      });
    }

    /**
     * Set local description with Offer SDP and emit offerCreated event.
     * @param {RTCSessionDescription} offer - Offer SDP.
     * @return {Promise} A promise that is resolved with Offer SDP.
     * @private
     */

  }, {
    key: '_setLocalDescription',
    value: function _setLocalDescription(offer) {
      var _this8 = this;

      return this._pc.setLocalDescription(offer).then(function () {
        _logger2.default.log('Set localDescription: offer');
        _this8._isExpectingAnswer = true;
        _this8.emit(Negotiator.EVENTS.offerCreated.key, offer);
        return Promise.resolve(offer);
      }).catch(function (error) {
        error.type = 'webrtc';
        _logger2.default.error(error);
        _this8.emit(Negotiator.EVENTS.error.key, error);

        _logger2.default.log('Failed to setLocalDescription, ', error);
        return Promise.reject(error);
      });
    }

    /**
     * Set remote SDP.
     * @param {object} sdp - An object containing remote SDP.
     * @return {Promise} A promise that is resolved when setting remote SDP is completed.
     * @private
     */

  }, {
    key: '_setRemoteDescription',
    value: function _setRemoteDescription(sdp) {
      var _this9 = this;

      _logger2.default.log('Setting remote description ' + JSON.stringify(sdp));
      return this._pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function () {
        _logger2.default.log('Set remoteDescription:', sdp.type);
        return Promise.resolve();
      }).catch(function (error) {
        error.type = 'webrtc';
        _logger2.default.error(error);
        _this9.emit(Negotiator.EVENTS.error.key, error);

        _logger2.default.log('Failed to setRemoteDescription: ', error);
        return Promise.reject(error);
      });
    }

    /**
     * Events the Negotiator class can emit.
     * @type {Enum}
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
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

  }]);

  return Negotiator;
}(_events2.default);

exports.default = Negotiator;