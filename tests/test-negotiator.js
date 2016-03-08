'use strict';

const assert     = require('power-assert');
const sinon      = require('sinon');
const proxyquire = require('proxyquire');

const Negotiator = require('../src/negotiator');

describe('Negotiator', () => {
  describe('Constructor', () => {
    it('should create a Negotiator object', () => {
      const negotiator = new Negotiator();

      assert(negotiator);
      assert(negotiator instanceof Negotiator);
    });
  });

  describe('startConnection', () => {
    let pcStub;
    let addStreamSpy;
    let createDCSpy;
    let negotiator;
    let handleOfferSpy;

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
      handleOfferSpy = sinon.spy();
      negotiator.handleOffer = handleOfferSpy;
    });

    afterEach(() => {
      addStreamSpy.reset();
      createDCSpy.reset();
      handleOfferSpy.reset();
    });

    it('should create a _pc property of type RTCPeerConnection', () => {
      const options = {
        originator: true
      };
      const pcConfig = {};

      // not stub
      const negotiator = new Negotiator();
      negotiator.startConnection(options, pcConfig);

      assert(negotiator._pc);
      assert.equal(negotiator._pc.constructor.name, 'RTCPeerConnection');
    });

    describe('when type is \'media\'', () => {
      describe('when originator is true', () => {
        it('should call pc.addStream', () => {
          const options = {
            type:       'media',
            stream:     {},
            originator: true
          };
          const pcConfig = {};

          assert(addStreamSpy.callCount === 0);
          assert(handleOfferSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(addStreamSpy.callCount === 1);
          assert(handleOfferSpy.callCount === 0);
        });
      });

      describe('when originator is false', () => {
        it('should call pc.addStream and handleOffer', () => {
          const options = {
            type:       'media',
            stream:     {},
            originator: false
          };
          const pcConfig = {};

          assert(addStreamSpy.callCount === 0);
          assert(handleOfferSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(addStreamSpy.callCount === 1);
          assert(handleOfferSpy.callCount === 1);
        });
      });
    });

    describe('when type is \'data\'', () => {
      describe('when originator is true', () => {
        it('should call createDataChannel and emit \'dataChannel\'', done => {
          const options = {
            type:       'data',
            originator: true
          };
          const pcConfig = {};

          negotiator.on(Negotiator.EVENTS.dcReady.name, () => {
            done();
          });

          assert(createDCSpy.callCount === 0);
          assert(handleOfferSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(createDCSpy.callCount === 1);
          assert(handleOfferSpy.callCount === 0);
        });
      });

      describe('when originator is false', () => {
        it('should call handleOffer', () => {
          const options = {
            type:       'data',
            originator: false
          };
          const pcConfig = {};

          assert(createDCSpy.callCount === 0);
          assert(handleOfferSpy.callCount === 0);

          negotiator.startConnection(options, pcConfig);

          assert(createDCSpy.callCount === 0);
          assert(handleOfferSpy.callCount === 1);
        });
      });
    });
  });

  describe('_createPeerConnection', () => {
    describe('when type is \'media\'', () => {
      it('should return RTCPeerConnection object', () => {
        const negotiator = new Negotiator();
        const pc = negotiator._createPeerConnection('media');

        assert.equal(pc.constructor.name, 'RTCPeerConnection');
      });
    });

    describe('when type is \'data\'', () => {
      it('should return RTCPeerConnection object', () => {
        const negotiator = new Negotiator();
        const pc = negotiator._createPeerConnection('data');

        assert.equal(pc.constructor.name, 'RTCPeerConnection');
      });
    });
  });

  describe('handleCandidate', () => {
    it('should call _pc.addIceCandidate with an RTCIceCandidate', () => {
      const negotiator = new Negotiator();
      const options = {
        type:       'data',
        originator: false
      };
      const pcConfig = {};
      negotiator.startConnection(options, pcConfig);

      const candidate = {
        candidate:     'candidate:678703848 1 udp 2122260223 192.168.100.1 61209 typ host generation 0',
        sdpMLineIndex: 0,
        sdpMid:        'data'
      };

      const addIceStub = sinon.stub(negotiator._pc, 'addIceCandidate');

      assert(addIceStub.callCount === 0);

      negotiator.handleCandidate(candidate);

      assert(addIceStub.callCount === 1);

      const addIceArg = addIceStub.args[0][0];
      assert(addIceArg.constructor.name === 'RTCIceCandidate');
      assert(candidate.candidate === addIceArg.candidate);
      assert(candidate.sdpMLineIndex === addIceArg.sdpMLineIndex);
      assert(candidate.sdpMid === addIceArg.sdpMid);
    });
  });

  describe('handleOffer', () => {
    const waitForAsync = 100;
    it('should setRemoteDescription', done => {
      const negotiator = new Negotiator();
      negotiator._pc = negotiator._createPeerConnection('data', {});

      const setRemoteSpy = sinon.spy(negotiator._pc, 'setRemoteDescription');

      negotiator._pc.createOffer()
        .then(offer => {
          const offerObject = {
            sdp:  offer.sdp,
            type: offer.type
          };

          negotiator.handleOffer(offerObject);

          setTimeout(() => {
            assert(setRemoteSpy.callCount === 1);
            assert(setRemoteSpy.calledWith(offer));
            done();
          }, waitForAsync);
        });
    });

    it('should emit answerCreated', done => {
      const negotiator = new Negotiator();
      negotiator._pc = negotiator._createPeerConnection('data', {});

      const emitSpy = sinon.spy(negotiator, 'emit');

      negotiator._pc.createOffer()
        .then(offer => {
          const offerObject = {
            sdp:  offer.sdp,
            type: offer.type
          };

          assert(emitSpy.callCount === 0);

          negotiator.handleOffer(offerObject);

          setTimeout(() => {
            assert(emitSpy.callCount === 1);
            assert(emitSpy.calledWith(Negotiator.EVENTS.answerCreated.name));
            done();
          }, waitForAsync);
        });
    });

    describe('handleAnswer', () => {
      const waitForAsync = 100;
      it('should setRemoteDescription', done => {
        const negotiator = new Negotiator();
        negotiator._pc = negotiator._createPeerConnection('data', {});
        const setRemoteSpy = sinon.spy(negotiator._pc, 'setRemoteDescription');
        negotiator._pc.createOffer()
          .then(offer => {
            // creating an answer is complicated so just use an offer
            const answerObject = {
              sdp:  offer.sdp,
              type: 'answer'
            };

            assert(setRemoteSpy.callCount === 0);

            negotiator.handleAnswer(answerObject);

            setTimeout(() => {
              assert(setRemoteSpy.callCount === 1);
              assert(setRemoteSpy.calledWith(
                new RTCSessionDescription(answerObject))
              );
              done();
            }, waitForAsync);
          });
      });
    });
  });
});
