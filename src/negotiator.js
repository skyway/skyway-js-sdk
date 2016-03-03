'use strict';

const util = require('./util');

const EventEmitter = require('events');

class Negotiator extends EventEmitter {
  constructor() {
    super();

    this._idPrefix = 'pc_';
  }

  startConnection(options) {
    // TODO: Remove lint bypass
    console.log(options);
  }

  _createPeerConnection(type) {
    return {};
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
      console.log(candidate)
      if (!candidate) {
        util.log('ICE canddidates gathering complete');
      } else {
        util.log('Generated ICE candidate for:', candidate);
        this.emit('iceCandidate', candidate);
      }
    };

    pc.oniceconnectionstatechange = () => {
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
      this._makeOffer();
    };

    pc.onremovestream = () => {
      util.log('`removestream` triggerd');
    };

    pc.onsignalingstatechange = evt => {
      util.log('`signalingstatechange` triggerd');
    };

    return pc;
  }

  _makeOffer() {
    var pc = this._pc;

    if(!!pc.remoteDescription && !!pc.remoteDescription.type) return;

    pc.createOffer(option)
    .then(offer => {
      util.log('Created offer.');
      console.log(offer)
      return pc.setLocalDescription(offer);
    }, error => {
      this.emitError('webrtc', err);
      util.log('Failed to createOffer, ', err);
    }).then(offer => {
      console.log("set localDescription")
      util.log('Set localDescription: offer');
      this.emit('offerCreated', offer);
    }, error => {
      this.emitError('webrtc', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }

  cleanup() {
  }

  handleAnswer(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }

  handleCandidate(message) {
    // TODO: Remove lint bypass
    console.log(message);
  }
}

module.exports = Negotiator;
