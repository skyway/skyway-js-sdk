'use strict';

const EventEmitter = require('events');
const adapter      = require('webrtc-adapter-test');

const RTCPeerConnection = adapter.RTCPeerConnection;
const RTCIceCandidate   = adapter.RTCIceCandidate;
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
  'iceCandidate'
]);

class Negotiator extends EventEmitter {
  constructor() {
    super();
    this._idPrefix = 'pc_';
  }

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
        this.emit('dataChannel', dc);
      }
    } else {
      this.handleSDP('OFFER', options.sdp);
    }
  }

  _createPeerConnection(type, pcConfig) {
    util.log('Creating RTCPeerConnection');

    const optional = {};

    if (type === 'data') {
      optional.optional = [{RtpDataChannels: true}];
    } else if (type === 'media') {
      optional.optional = [{DtlsSrtpKeyAgreement: true}];
    }

    pcConfig = pcConfig || {};
    pcConfig.iceServers = pcConfig.iceServers || util.defaultConfig.iceServers;

    return new RTCPeerConnection(pcConfig, optional);
  }

  _setupPCListeners() {
  }

  cleanup() {
  }

  handleOffer(offerSdp) {
    const sdp = new RTCSessionDescription(offerSdp);

    this._setRemoteDescription(sdp).then(() => {
      return this._makeAnswerSdp()
    }).then(answer => {
      this.emit(Negotiator.EVENTS.answerCreated.name, answer);
    });
  }

  handleAnswer(answerSdp) {
    const sdp = new RTCSessionDescription(answerSdp);

    this._setRemoteDescription(sdp);
  }

  handleCandidate(candidate) {
    this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    util.log('Added ICE candidate');
  }

  _setRemoteDescription(sdp) {
    util.log(`Setting remote description ${sdp}`);
    return this._pc.setRemoteDescription(sdp)
      .then(() => {
        util.log('Set remoteDescription:', type);
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

  static get EVENTS() {
    return NegotiatorEvents;
  }
}

module.exports = Negotiator;
