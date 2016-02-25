'use strict';

const assert     = require('power-assert');
const sinon      = require('sinon');
const proxyquire = require('proxyquire');

const Negotiator      = require('../src/negotiator');
const DataConnection  = require('../src/dataConnection');

describe('Negotiator', () => {
  describe('startConnection', () => {
    it('should create a _pc property of type RTCPeerConnection', () => {
      const negotiator = new Negotiator();
      const options = {
        originator: true
      };
      const pcConfig = {};

      negotiator.startConnection(options, pcConfig);

      assert(negotiator._pc);
      assert.equal(negotiator._pc.constructor.name, 'RTCPeerConnection');
    });

    context('when type is \'media\'', () => {
      context('when originator is true', () => {
        it('should call pc.addStream', () => {
          const pcStub = sinon.stub();
          const addStreamSpy = sinon.spy();
          pcStub.returns({
            addStream: addStreamSpy
          });
          const Negotiator = proxyquire('../src/negotiator', {
            'webrtc-adapter-test': {
              RTCPeerConnection: pcStub
            }
          });

          const negotiator = new Negotiator();
          const handleSDPSpy = sinon.spy(negotiator, 'handleSDP');

          const pcConfig = {};
          const options = {
            type:       'media',
            stream:     {},
            originator: true
          };
          assert(addStreamSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);
          negotiator.startConnection(options, pcConfig);
          assert(addStreamSpy.callCount === 1);
          assert(handleSDPSpy.callCount === 0);
        });
      });

      context('when originator is false', () => {
        it('should call pc.addStream and handleSDP', () => {
          const pcStub = sinon.stub();
          const addStreamSpy = sinon.spy();
          pcStub.returns({
            addStream: addStreamSpy
          });
          const Negotiator = proxyquire('../src/negotiator', {
            'webrtc-adapter-test': {
              RTCPeerConnection: pcStub
            }
          });

          const negotiator = new Negotiator();
          const handleSDPSpy = sinon.spy(negotiator, 'handleSDP');

          const options = {
            type:       'media',
            stream:     {},
            originator: false
          };
          const pcConfig = {};

          assert(addStreamSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);
          negotiator.startConnection(options, pcConfig);
          assert(addStreamSpy.callCount === 1);
          assert(handleSDPSpy.callCount === 1);
        });
      });
    });

    context('when type is \'data\'', () => {
      context('when originator is true', () => {
        it('should call createDataChannel and emit \'dataChannel\'', () => {
          const pcStub = sinon.stub();
          const createDCSpy = sinon.spy();
          pcStub.returns({
            createDataChannel: createDCSpy
          });
          const Negotiator = proxyquire('../src/negotiator', {
            'webrtc-adapter-test': {
              RTCPeerConnection: pcStub
            }
          });

          const dc = new DataConnection();
          const negotiator = new Negotiator();
          const handleSDPSpy = sinon.spy(negotiator, 'handleSDP');
          const emitSpy = sinon.spy(negotiator, 'emit');

          const options = {
            type:       'data',
            lavel:      dc.lavel,
            originator: true
          };
          const pcConfig = {};

          assert(createDCSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(createDCSpy.callCount === 1);
          assert(handleSDPSpy.callCount === 0);

          assert(emitSpy.calledOnce);
          assert(emitSpy.calledWith('dataChannel') === true);
        });
      });

      context('when originator is false', () => {
        it('should call handleSDP', () => {
          const pcStub = sinon.stub();
          const createDCSpy = sinon.spy();
          pcStub.returns({
            createDataChannel: createDCSpy
          });
          const Negotiator = proxyquire('../src/negotiator', {
            'webrtc-adapter-test': {
              RTCPeerConnection: pcStub
            }
          });

          const dc = new DataConnection();
          const negotiator = new Negotiator();
          const handleSDPSpy = sinon.spy(negotiator, 'handleSDP');

          const options = {
            type:       'data',
            lavel:      dc.lavel,
            originator: false
          };
          const pcConfig = {};

          assert(createDCSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);
          negotiator.startConnection(options, pcConfig);
          assert(createDCSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 1);
        });
      });
    });
  });

  describe('_createPeerConnection', () => {
    context('when type is \'media\'', () => {
      it('should return RTCPeerConnection object', () => {
        const negotiator = new Negotiator();
        const pc = negotiator._createPeerConnection('media');

        assert.equal(pc.constructor.name, 'RTCPeerConnection');
      });
    });

    context('when type is \'data\'', () => {
      it('should return RTCPeerConnection object', () => {
        const negotiator = new Negotiator();
        const pc = negotiator._createPeerConnection('data');

        assert.equal(pc.constructor.name, 'RTCPeerConnection');
      });
    });
  });

  describe('_setupPCListeners', () => {
    it('should set up PeerConnection listeners', () => {
      const negotiator = new Negotiator();
      const pc = negotiator._createPeerConnection('media');

      assert(pc.onicecandidate === null);
      negotiator._setupPCListeners(pc);
      assert(pc.onicecandidate);
    });
  });
});
