'use strict';

const adapter = require('webrtc-adapter-test');

const RTCPeerConnection     = adapter.RTCPeerConnection;

const util = require('./util');

const EventEmitter = require('events');

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

  _setupPCListeners(pc) {
    util.log('Listening for ICE candidates.');

    pc.onicecandidate = evt => {
      const candidate = evt.candidate || evt;

      if (!candidate || candidate.candidate === null) {
        util.log('ICE canddidates gathering complete');
      } else {
        util.log('Generated ICE candidate for:', candidate);
        this.emit('ice-candidate', candidate);
      }
    };
  }

  cleanup() {
  }

  handleSDP(type, sdp) {
    // TODO: Remove lint bypass
    console.log(type, sdp);
  }

  handleCandidate(ice) {
    // TODO: Remove lint bypass
    console.log(ice);
  }
}

module.exports = Negotiator;
