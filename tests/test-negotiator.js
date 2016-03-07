'use strict';

const assert           = require('power-assert');
const sinon            = require('sinon');
const sinonStubPromise = require('sinon-stub-promise');
const proxyquire       = require('proxyquire');

const Negotiator       = require('../src/negotiator');

sinonStubPromise(sinon);

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

  describe('_setupPCListeners', () => {
    it('should set up PeerConnection listeners', () => {
      const negotiator = new Negotiator();
      const pc = negotiator._createPeerConnection('media');

      negotiator._setupPCListeners(pc);
      assert(pc.onaddstream);
      assert(pc.ondatachannel);
      assert(pc.onicecandidate);
      assert(pc.oniceconnectionstatechange);
      assert(pc.onnegotiationneeded);
      assert(pc.onremovestream);
      assert(pc.onsignalingstatechange);
    });

    describe('RTCPeerConnection\'s event listeners', () => {
      let negotiator;
      let pc;
      let ev;

      before(() => {
        negotiator = new Negotiator();
        pc = negotiator._createPeerConnection('media');
        negotiator._setupPCListeners(pc);
      });

      beforeEach(() => {
        ev = {};
      });

      describe('when pc listen \'addstream\'', () => {
        it('should emit \'addStream\' with remote stream', done => {
          ev.stream = 'stream';
          negotiator.on('addStream', stream => {
            assert(stream, ev.stream);
            done();
          });

          pc.onaddstream(ev);
        });
      });

      describe('when pc listen \'datachannel\'', () => {
        it('should emit \'dcReady\' with datachannel', done => {
          ev.channel = 'dc';
          negotiator.on('dcReady', dc => {
            assert(dc, ev.channel);
            done();
          });

          pc.ondatachannel(ev);
        });
      });

      describe('when pc listen \'icecandidate\'', () => {
        it('should emit \'iceCandidate\' with ice candidate', done => {
          ev.candidate = 'candidate';
          negotiator.on('iceCandidate', candidate => {
            assert(candidate, ev.candidate);
            done();
          });

          pc.onicecandidate(ev);
        });
      });

      describe('when pc listen \'oniceconnectionstatechange\'', () => {
        let pcStub;
        let negotiator;
        let pc;

        before(() => {
          pcStub = sinon.stub();
          pcStub.returns({
            iceConnectionState: 'disconnected'
          });
          const Negotiator = proxyquire('../src/negotiator', {
            'webrtc-adapter-test': {
              RTCPeerConnection: pcStub
            }
          });
          negotiator = new Negotiator();
          pc = negotiator._createPeerConnection('media');
          negotiator._setupPCListeners(pc);
        });

        describe('when pc.iceConnectionState is \'disconnected\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on('iceConnectionDisconnected', () => {
              done();
            });
            pc.iceConnectionState = 'disconnected';

            pc.oniceconnectionstatechange();
          });
        });

        describe('when pc.iceConnectionState is \'failed\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on('iceConnectionDisconnected', () => {
              done();
            });
            pc.iceConnectionState = 'failed';

            pc.oniceconnectionstatechange();
          });
        });

        describe('when pc.iceConnectionState is \'completed\'', () => {
          it('should set pc.onicecandidate empty function', () => {
            pc.iceConnectionState = 'completed';
            pc.onicecandidate = 'string';

            pc.oniceconnectionstatechange();
            assert(typeof pc.onicecandidate === 'function');
          });
        });
      });

      describe('when pc listen \'negotiationneeded\'', () => {
        it('should call _makeOfferSdp', () => {
          const spy = sinon.spy(negotiator, '_makeOfferSdp');

          assert(spy.callCount === 0);
          pc.onnegotiationneeded();
          assert(spy.callCount === 1);
        });
      });
    });
  });

  describe('_makeOfferSdp', () => {
    let negotiator;
    let pc;
    let promiseStub;

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._createPeerConnection('media');
      negotiator._setupPCListeners(pc);
      promiseStub = sinon.stub().returnsPromise();
    });

    it('should call pc.createOffer', () => {
      const offer = 'offer';
      pc.createOffer = promiseStub.resolves(offer);

      assert(promiseStub.callCount === 0);
      negotiator._makeOfferSdp(pc);
      assert(promiseStub.callCount === 1);
    });

    it('should return offer when createOffer resolved', done => {
      negotiator._makeOfferSdp(pc)
      .then(offer => {
        assert(offer);
        assert(offer instanceof RTCSessionDescription);
        done();
      }).catch(() => {
        assert.fail();
      });
    });

    it('should emit Error when createOffer rejected', done => {
      const fakeError = 'fakeError';
      pc.createOffer = promiseStub.rejects(fakeError);

      negotiator.on(Negotiator.EVENTS.error.name, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        done();
      });

      negotiator._makeOfferSdp(pc)
      .then(() => {
        assert.fail();
      })
      .catch(error => {
        assert(error);
        assert(error, fakeError);
      });

      assert(promiseStub.callCount === 1);
    });
  });

  describe('_setLocalDescription', () => {
    let negotiator;
    let pc;
    let promiseStub;

    before(() => {
      negotiator = new Negotiator();
      pc = negotiator._createPeerConnection('media');
      negotiator._setupPCListeners(pc);
      promiseStub = sinon.stub().returnsPromise();
    });

    it('should call pc.setLocalDescription', () => {
      const offer = 'offer';
      pc.setLocalDescription = promiseStub.resolves(offer);

      assert(promiseStub.callCount === 0);
      negotiator._setLocalDescription(pc, offer);
      assert(promiseStub.callCount === 1);
    });

    describe('when setLocalDescription resolved', () => {
      it('should emit \'offerCreated\'', done => {
        const offer = 'offer';
        pc.setLocalDescription = promiseStub.resolves(offer);

        negotiator.on(Negotiator.EVENTS.offerCreated.name, offer => {
          assert(offer);
          done();
        });

        negotiator._setLocalDescription(pc, offer);
      });
    });

    describe('when setLocalDescription rejected', () => {
      it('should emit Error', done => {
        const offer = 'offer';
        const fakeError = 'fakeError';
        pc.setLocalDescription = promiseStub.rejects(fakeError);

        negotiator.on(Negotiator.EVENTS.error.name, err => {
          assert(err instanceof Error);
          assert.equal(err.type, 'webrtc');
          done();
        });

        negotiator._setLocalDescription(pc, offer);

        assert(promiseStub.callCount === 1);
      });
    });
  });
});
