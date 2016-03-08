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
  'error'
]);

class Negotiator extends EventEmitter {
  startConnection(options, pcConfig) {
    this._pc = this._createPeerConnection(options.type, pcConfig);
    this._setupPCListeners(this._pc);

    if (options.type === 'media' && options.stream) {
      this._pc.addStream(options.stream);
    }

    if (options.originator) {
      if (options.type === 'data') {
        const label = options.label || '';
        const dc = this._pc.createDataChannel(label);
        this.emit(Negotiator.EVENTS.dcReady.name, dc);
      }
    } else {
      this.handleOffer(options.sdp);
    }
  }

  _createPeerConnection(type, pcConfig) {
    util.log('Creating RTCPeerConnection');

    pcConfig = pcConfig || {};
    pcConfig.iceServers = pcConfig.iceServers || util.defaultConfig.iceServers;

    return new RTCPeerConnection(pcConfig);
  }

  _setupPCListeners() {
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
    util.log(`Setting remote description ${sdp}`);
    return this._pc.setRemoteDescription(new RTCSessionDescription(sdp))
      .then(() => {
        util.log('Set remoteDescription:', sdp.type);
      }).catch(err => {
        this.emitError('webrtc', err);
        util.log('Failed to setRemoteDescription: ', err);
      });
  }

  _makeAnswerSdp() {
    return this._pc.createAnswer()
      .then(answer => {
        util.log('Created answer.');

        return this._pc.setLocalDescription(answer);
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to createAnswer, ', err);
      }).catch(err => {
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
