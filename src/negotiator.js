'use strict';

const adapter = require('webrtc-adapter-test');
const RTCPeerConnection     = adapter.RTCPeerConnection;
const RTCSessionDescription = adapter.RTCSessionDescription;
const RTCIceCandidate       = adapter.RTCIceCandidate;

const util = require('./util');

class Negotiator {
  constructor(socket, connection) {
    this._socket = socket;
    this._connection = connection;
    this._idPrefix = 'pc_';
  }

  startConnection(options, pcConfig) {
    const pc = this._startPeerConnection(pcConfig);

    if (this._connection.type === 'media' && options._stream) {
      pc.addStream(options._stream);
    }

    if (options.originator) {
      if (this._connection.type === 'data') {
        const dc = pc.createDataChannel(this._connection.label);
        this._connection.initialize(dc);
      }
    } else {
      this.handleSDP('OFFER', options.sdp);
    }
  }

  cleanup() {
    util.log('Cleaning up PeerConnection to ', this._connection.peer);

    if (!!this._pc && (this._pc.readyState !== 'closed' || this._pc.signalingState !== 'closed')) {
      this._pc.close();
      this._pc = null;
    }
  }

  handleSDP(type, receivedSdp) {
    const sdp = new RTCSessionDescription({
      type: receivedSdp.type,
      sdp: receivedSdp.sdp
    });

    util.log('Setting remote description', sdp);
    this._pc.setRemoteDescription(sdp)
      .then(() => {
        util.log('Set remoteDescription:', type, 'for:', this._connection.peer);

        if(type === 'OFFER') {
          this._makeAnswer();
        }
      }).catch(err => {
        this.emitError('webrtc', err);
        util.log('Failed to setRemoteDescription: ', err);
      });
  }

  handleCandidate(ice) {
    if(!ice) {
      return;
    }

    const candidate = ice.candidate;
    const sdpMLineIndex = ice.sdpMLineIndex;

    this._pc.addIceCandidate(new RTCIceCandidate({
      sdpMLineIndex: sdpMLineIndex,
      candidate: candidate
    }));
    util.log('Added ICE candidate for:', this._connection.peer);
  }

  _startPeerConnection(pcConfig) {
    util.log('Creating RTCPeerConnection');

    const optional = {};

    if (this._connection.type === 'data') {
      optional.optional = [{RtpDataChannels: true}];
    } else if (this._connection.type === 'media') {
      optional.optional = [{DtlsSrtpKeyAgreement: true}];
    }

    this._pc = new RTCPeerConnection(pcConfig, optional);
    this._setupListeners();
  }

  _setupListeners() {
    const peerId = this._connection.peer;
    const connectionId = this._connection.id;

    util.log('Listening for ICE candidates.');

    this._pc.onicecandidate = evt => {
      const candidate = evt.candidate || evt;

      if(!candidate || candidate.candidate === null) {
        util.log('ICE canddidates gathering complete for:', peerId);
      } else {
        util.log('Generated ICE candidate for:', peerId, candidate);
        this._socket.send({
          type: 'CANDIDATE',
          payload: {
            candidate: {
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
              candidate: candidate.candidate
            },
            type: this._connection.type,
            connectionId: connectionId
          },
          dst: peerId
        });
      }
    };

    this._pc.oniceconnectionstatechange = function() {
      switch (this._pc.iceConnectionState) {
        case 'disconnected':
        case 'failed':
          util.log('iceConnectionState is disconnected, closing connections to ' + peerId);
          this._connection.close();
          break;
        case 'completed':
          this._pc.onicecandidate = util.noop;
          break;
      }
    };

    this._pc.onnegotiationneeded = function() {
      util.log('"negotiationneeded" triggered');
      if (this._pc.signalingState === 'stable') {
        this._makeOffer();
      } else {
        util.log('onnegotiationneeded triggered when not stable. Is another connection being established?');
      }
    };

    this._pc.ondatachannel = function(evt) {
      util.log('Received data channel');
      const dc = evt.channel || evt;
      this._connection.initialize(dc);
    };

    this._pc.onaddstream = function(evt) {
      util.log('Received remote stream');
      const stream = evt.stream || evt;
      if (this._connection.type === 'media') {
        this._connection.addStream(stream);
      }
    }
  }

  _makeOffer() {
    if (!!this._pc.remoteDescription && !!this._pc.remoteDescription.type) {
      return;
    }

    this._pc.createOffer(this.connection.options.constraints)
      .then(offer => {
        util.log('Created offer');
        return this._pc.setLocalDescription(offer);
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to createOffer, ', err);
      }).then(offer => {
        this._socket.send({
          type: 'OFFER',
          payload: {
            sdp: {
              type: offer.type,
              sdp: offer.sdp
            },
            type: this._connection.type,
            label: this._connection.label,
            connectionId: this._connection.id,
            reliable: this._connection.reliable,
            serialization: this._connection.serialization,
            metadata: this._connection.metadata,
            browser: util.browser
          },
          dst: this._connection.peer
        })
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to setLocalDescription, ', err);
      }).catch(err => {
        this.emitError('webrtc', err);
      });
  }

  _makeAnswer() {
    this._pc.createAnswer()
      .then(answer => {
        util.log('Created answer.');

        return this._pc.setLocalDescription(answer);
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to createAnswer, ', err);
      }).then(answer => {
        util.log('Set localDescription: answer', 'for:', this._connection.peer);
        this._socket.send({
          type: 'ANSWER',
          payload: {
            sdp: {
              type: answer.type,
              sdp: answer.sdp
            },
            type: this._connection.type,
            connectionId: this._connection.id,
            browser: util.browser
          },
          dst: this._connection.peer
        });
      }, err => {
        this.emitError('webrtc', err);
        util.log('Failed to setLocalDescription, ', err);
      });
  }
}

module.exports = Negotiator;
