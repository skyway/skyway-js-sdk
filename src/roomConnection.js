'use strict';

const Connection = require('./connection');
const RoomNegotiator = require('./roomNegotiator');
const util = require('./util');

class RoomConnection extends Connection {
  constructor(remoteId, options) {
    super(remoteId, options);

    this._idPrefix = 'rc_';
    this.type = 'room';
    // We need to reassign _negotiator to be a RoomNegotiator
    this._negotiator = new RoomNegotiator(this);

    this.localStream = this.options._stream;
    this._pcAvailable = false;

    if (this.localStream) {
      this._negotiator.startConnection(
        {
          type:       'room',
          _stream:    this.localStream,
          originator: true
        },
        this.options.pcConfig
      );
      this._pcAvailable = true;
    }

    // There should be no 'answer' method or queued events for a RoomConnection
    // (Every user joins of their own accord)
    answer(stream) {

      this.options._payload._stream = stream;

      this.localStream = stream;
      this._negotiator.startConnection(
        {
          type:       'media',
          _stream:    this.localStream,
          originator: false,
          offer:      this.options._payload.offer
        },
        this.options.pcConfig
      );
      this._pcAvailable = true;

      this._handleQueuedMessages();

      this.open = true;
    }

    setOffer(offer) {
      console.log("RoomConnection setting offer", offer)
      var description = new RTCSessionDescription({type:'offer', sdp:offer});
      if (!pc) {
        console.log('new RTCPeerConnection')
        let pc = new RTCPeerConnection();

        pc.onicecandidate = function(evt) {
          if (!evt.candidate) {
            pc.onicecandidate = function(){};
            socket.emit('answer', pc.localDescription.sdp);
          }
        };

        pc.oniceconnectionstatechange = function(evt) {
          console.log('ice connection state changed to: ' + pc.iceConnectionState + "===================")
        }

        pc.onsignalingstatechange = function(evt) {
          console.log('signaling state changed to: ' + pc.signalingState + "===================")
        }

        pc.onaddstream = function(evt) {
          console.log('stream added')
          console.log(evt)
          count++;
        }

        pc.addStream(localStream);
        pc.setRemoteDescription(description)
        .then(function() {
          return pc.createAnswer()
        }).then(function(answer) {
          pc.setLocalDescription(answer)
          .then(() => {
            socket.emit(answer)
          })
        }).catch(function(err) {
          console.error(err);
        });
      } else {

        pc.setRemoteDescription(description)
        .then(function() {
          console.log("done setRemoteDescription")
          return pc.createAnswer()
        }).then(function(answer) {
          console.log("done createAnswer")
          pc.setLocalDescription(answer)
          .then(() => {
            console.log("done setLocalDescription")
          })
        }).catch(function(err) {
          console.error(err);
        });
      };
    }

    this._negotiator.on(Negotiator.EVENTS.addStream.key, remoteStream => {
      util.log('Receiving stream', remoteStream);

      this.remoteStream = remoteStream;
      this.emit('stream', remoteStream);
    });
  }
}

module.exports = RoomConnection;
