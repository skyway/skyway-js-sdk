'use strict';

const assert     = require('power-assert');
const sinon      = require('sinon');
const proxyquire = require('proxyquire');

const Negotiator      = require('../src/negotiator');

describe('Negotiator', () => {
  describe('startConnection', () => {
    let pcStub;
    let addStreamSpy;
    let createDCSpy;
    let negotiator;
    let handleSDPSpy;
    let emitSpy;

    before(() => {
      pcStub = sinon.stub();
      addStreamSpy = sinon.spy();
      createDCSpy = sinon.spy();

      pcStub.returns({
        addStream:         addStreamSpy,
        createDataChannel: createDCSpy
      });
      const Negotiator = proxyquire('../src/negotiator', {
        'webrtc-adapter-test': {
          RTCPeerConnection: pcStub
        }
      });

      negotiator = new Negotiator();
      handleSDPSpy = sinon.spy(negotiator, 'handleSDP');
      emitSpy = sinon.spy(negotiator, 'emit');
    });

    afterEach(() => {
      addStreamSpy.reset();
      createDCSpy.reset();
      handleSDPSpy.reset();
      emitSpy.reset();
    });

    it('should create a _pc property of type RTCPeerConnection', () => {
      const options = {
        originator: true
      };
      const pcConfig = {};

      // not stab
      const negotiator = new Negotiator();
      negotiator.startConnection(options, pcConfig);

      assert(negotiator._pc);
      assert.equal(negotiator._pc.constructor.name, 'RTCPeerConnection');
    });

    context('when type is \'media\'', () => {
      context('when originator is true', () => {
        it('should call pc.addStream', () => {
          const options = {
            type:       'media',
            stream:     {},
            originator: true
          };
          const pcConfig = {};

          assert(addStreamSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(addStreamSpy.callCount === 1);
          assert(handleSDPSpy.callCount === 0);
        });
      });

      context('when originator is false', () => {
        it('should call pc.addStream and handleSDP', () => {
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
          const options = {
            type:       'data',
            originator: true
          };
          const pcConfig = {};

          assert(createDCSpy.callCount === 0);
          assert(handleSDPSpy.callCount === 0);
          assert(emitSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(createDCSpy.callCount === 1);
          assert(handleSDPSpy.callCount === 0);
          assert(emitSpy.callCount === 1);
          assert(emitSpy.calledWith('dataChannel') === true);
        });
      });

      context('when originator is false', () => {
        it('should call handleSDP', () => {
          const options = {
            type:       'data',
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
});
