'use strict';

const EventEmitter = require('events');
const adapter      = require('webrtc-adapter-test');

const RTCPeerConnection     = adapter.RTCPeerConnection;
const RTCIceCandidate       = adapter.RTCIceCandidate;
const RTCSessionDescription = adapter.RTCSessionDescription;

const util = require('./util');

// Negotiator ENUM setup. 'enumify' is only used with `import`, not 'require'.
import {Enum} from 'enumify';
class NegotiatorEvents extends Enum {}
NegotiatorEvents.initEnum([
  'addStream',
  'dcReady',
  'offerCreated',
  'answerCreated',
  'iceCandidate',
  'iceConnectionDisconnected',
  'error'
]);

class Negotiator extends EventEmitter {
  startConnection(options, pcConfig) {
    this._pc = this._createPeerConnection(options.type, pcConfig);
    this._setupPCListeners();

    if (options.type === 'media' && options._stream) {
      this._pc.addStream(options._stream);
    }

    if (options.originator) {
      if (options.type === 'data') {
        const label = options.label || '';
        const dc = this._pc.createDataChannel(label);
        this.emit(Negotiator.EVENTS.dcReady.name, dc);
      }
    } else {
      this.handleOffer(options.offer);
    }
  }

  _createPeerConnection(type, pcConfig) {
    util.log('Creating RTCPeerConnection');

    pcConfig = pcConfig || {};
    pcConfig.iceServers = pcConfig.iceServers || util.defaultConfig.iceServers;

    return new RTCPeerConnection(pcConfig);
  }

  _setupPCListeners() {
    this._pc.onaddstream = evt => {
      util.log('Received remote media stream');
      const stream = evt.stream;
      this.emit(Negotiator.EVENTS.addStream.name, stream);
    };

    this._pc.ondatachannel = evt => {
      util.log('Received data channel');
      const dc = evt.channel;
      this.emit(Negotiator.EVENTS.dcReady.name, dc);
    };

    this._pc.onicecandidate = evt => {
      const candidate = evt.candidate;
      if (candidate) {
        util.log('Generated ICE candidate for:', candidate);
        this.emit(Negotiator.EVENTS.iceCandidate.name, candidate);
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
          this.emit(Negotiator.EVENTS.iceConnectionDisconnected.name);
          break;
        case 'disconnected':
          util.log('iceConnectionState is disconnected, closing connection');
          this.emit(Negotiator.EVENTS.iceConnectionDisconnected.name);
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

    return this._pc;
  }

  _makeOfferSdp() {
    return this._pc.createOffer()
      .then(offer => {
        util.log('Created offer.');
        return Promise.resolve(offer);
      }, error => {
        this.emitError('webrtc', error);
        util.log('Failed to createOffer, ', error);
        return Promise.reject(error);
      });
  }

  _setLocalDescription(offer) {
    return this._pc.setLocalDescription(offer)
      .then(() => {
        util.log('Set localDescription: offer');
        this.emit(Negotiator.EVENTS.offerCreated.name, offer);
      }, error => {
        this.emitError('webrtc', error);
        util.log('Failed to setLocalDescription, ', error);
      });
  }

  cleanup() {
    util.log('Cleaning up PeerConnection');

    if (this._pc && (this._pc.readyState !== 'closed' || this._pc.signalingState !== 'closed')) {
      this._pc.close();
      this._pc = null;
    }
  }

  handleOffer(offerSdp) {
    this._setRemoteDescription(offerSdp)
      .then(() => {
        return this._makeAnswerSdp();
      }).then(answer => {
        this.emit(Negotiator.EVENTS.answerCreated.name, answer);
      });
  }

  handleAnswer(answerSdp) {
    this._setRemoteDescription(answerSdp);
  }

  handleCandidate(candidate) {
    this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    util.log('Added ICE candidate');
  }

  _setRemoteDescription(sdp) {
    util.log(`Setting remote description ${JSON.stringify(sdp)}`);
    return this._pc.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => {
        util.log('Set remoteDescription:', sdp.type);
      }).catch(err => {
        this.emitError('webrtc', err);
        util.log('Failed to setRemoteDescription: ', err);
      });
  }

  _makeAnswerSdp() {
    let answerSdp;
    return this._pc.createAnswer()
      .then(answer => {
        util.log('Created answer.');

        answerSdp = answer;
        return this._pc.setLocalDescription(answer);
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to createAnswer, ', err);
      }).then(() => {
        util.log('Set localDescription: answer');
        return answerSdp;
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to setLocalDescription, ', err);
      });
  }

  emitError(type, err) {
    util.error('Error:', err);
    if (typeof err === 'string') {
      err = new Error(err);
    }

    err.type = type;
    this.emit(Negotiator.EVENTS.error.name, err);
  }

  static get EVENTS() {
    return NegotiatorEvents;
  }
}

module.exports = Negotiator;
