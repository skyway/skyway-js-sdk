'use strict';

const adapter = require('webrtc-adapter-test');
const RTCPeerConnection     = adapter.RTCPeerConnection;
const util = require('./util');

const EventEmitter = require('events');

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

  _setupPCListeners(pc) {

    pc.onaddstream = evt => {
      util.log('Received remote media stream');
      var stream = evt.stream;
      this.emit('addStream', stream);
    };

    pc.ondatachannel = evt => {
      util.log('Received data channel');
      var dc = evt.channel;
      this.emit('dcReady', dc);
    };

    pc.onicecandidate = evt => {
      const candidate = evt.candidate;
      if (!candidate) {
        util.log('ICE canddidates gathering complete');
      } else {
        util.log('Generated ICE candidate for:', candidate);
        this.emit('iceCandidate', candidate);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(pc.iceConnectionState)
      switch (pc.iceConnectionState) {
        case 'disconnected':
        case 'failed':
          util.log('iceConnectionState is disconnected, closing connection');
          this.emit('iceConnectionDisconnected');
          break;
        case 'completed':
          pc.onicecandidate = () => {};
          break;
      }
    };

    pc.onnegotiationneeded = () => {
      util.log('`negotiationneeded` triggered');
      //this._makeOffer(pc);
      this._makeOffer(pc)
      .then(this._setOffer, 
        error => {
          console.log(error)
        }
      );
    };

    pc.onremovestream = () => {
      util.log('`removestream` triggerd');
    };

    pc.onsignalingstatechange = evt => {
      util.log('`signalingstatechange` triggerd');
    };

    return pc;
  }

  _makeOffer(pc) {

    console.log("_makeOffer")

    if(!!pc.remoteDescription && !!pc.remoteDescription.type) return;

    console.log("start createOffer") 
    console.log(pc.createOffer)
    return pc.createOffer()
    .then(offer => {
      console.log("offer created", offer)
      util.log('Created offer.');
      return Promise.resolve(pc, offer);
    }, error => {
      console.log("error createOffer", error)
      this.emitError('webrtc', error);
      util.log('Failed to createOffer, ', error);
      return Promise.reject(error);
    })
  }

  _setOffer(pc, offer) {
    pc.setLocalDescription(offer).then(offer => {
      console.log("set localDescription")
      util.log('Set localDescription: offer');
      this.emit('offerCreated', offer);
    }, error => {
      console.log("error setLocalDescription")
      this.emitError('webrtc', error);
      util.log('Failed to setLocalDescription, ', error);
    });
  }

  cleanup() {
  }

  handleOffer(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  handleAnswer(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  handleCandidate(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  static get EVENTS() {
    return NegotiatorEvents;
  }
}

module.exports = Negotiator;
