'use strict';

const EventEmitter = require('events');
const adapter      = require('webrtc-adapter-test');

const RTCPeerConnection = adapter.RTCPeerConnection;
const RTCIceCandidate   = adapter.RTCIceCandidate;

const util = require('./util');

// Log ENUM setup. 'enumify' is only used with `import`, not 'require'.
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

  handleSDP(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  handleCandidate(candidate) {
    this._pc.addIceCandidate(new RTCIceCandidate(candidate));
    util.log('Added ICE candidate');
  }

  static get EVENTS() {
    return NegotiatorEvents;
  }
}

module.exports = Negotiator;
