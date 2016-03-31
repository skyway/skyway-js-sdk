'use strict';

const assert           = require('power-assert');
const sinon            = require('sinon');
const sinonStubPromise = require('sinon-stub-promise');
const proxyquire       = require('proxyquireify')(require);

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

    beforeEach(() => {
      pcStub = sinon.stub();
      addStreamSpy = sinon.spy();
      createDCSpy = sinon.spy();

      pcStub.returns({
        addStream:         addStreamSpy,
        createDataChannel: createDCSpy
      });
      const Negotiator = proxyquire('../src/negotiator', {
        '../src/webrtcShim': {
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

      // not stub
      const negotiator = new Negotiator();
      negotiator.startConnection(options);

      assert(negotiator._pc);
      assert.equal(negotiator._pc.constructor.name, 'RTCPeerConnection');
    });

    describe('when type is \'media\'', () => {
      describe('when originator is true', () => {
        it('should call pc.addStream', () => {
          const options = {
            type:       'media',
            _stream:    {},
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
            _stream:    {},
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

          negotiator.on(Negotiator.EVENTS.dcReady.key, () => {
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
    it('should return RTCPeerConnection object', () => {
      const negotiator = new Negotiator();
      const pc = negotiator._createPeerConnection();

      assert.equal(pc.constructor.name, 'RTCPeerConnection');
    });

    it('should call RTCPeerConnection with pcConfig', () => {
      const pcStub = sinon.stub();
      const Negotiator = proxyquire('../src/negotiator', {
        '../src/webrtcShim': {
          RTCPeerConnection: pcStub
        }
      });
      const negotiator = new Negotiator();
      const pcConf = {};
      negotiator._createPeerConnection(pcConf);

      assert(pcStub.calledWith(pcConf));
    });
  });

  describe('_setupPCListeners', () => {
    it('should set up PeerConnection listeners', () => {
      const negotiator = new Negotiator();
      const pc = negotiator._pc = negotiator._createPeerConnection();

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

      beforeEach(() => {
        negotiator = new Negotiator();
        pc = negotiator._pc = negotiator._createPeerConnection();
        negotiator._setupPCListeners(pc);
      });

      beforeEach(() => {
        ev = {};
      });

      describe('onaddstream', () => {
        it('should emit \'addStream\' with remote stream', done => {
          ev.stream = 'stream';
          negotiator.on(Negotiator.EVENTS.addStream.key, stream => {
            assert.equal(stream, ev.stream);
            done();
          });

          pc.onaddstream(ev);
        });
      });

      describe('ondatachannel', () => {
        it('should emit \'dcReady\' with datachannel', done => {
          ev.channel = 'dc';
          negotiator.on(Negotiator.EVENTS.dcReady.key, dc => {
            assert(dc, ev.channel);
            done();
          });

          pc.ondatachannel(ev);
        });
      });

      describe('onicecandidate', () => {
        it('should emit \'iceCandidate\' with ice candidate', done => {
          ev.candidate = 'candidate';
          negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
            assert(candidate, ev.candidate);
            done();
          });

          pc.onicecandidate(ev);
        });
      });

      describe('oniceconnectionstatechange', () => {
        let pcStub;
        let negotiator;
        let pc;

        beforeEach(() => {
          pcStub = sinon.stub();
          pcStub.returns({
            iceConnectionState: 'disconnected'
          });
          const Negotiator = proxyquire('../src/negotiator', {
            '../src/webrtcShim': {
              RTCPeerConnection: pcStub
            }
          });
          negotiator = new Negotiator();
          pc = negotiator._pc = negotiator._createPeerConnection();
          negotiator._setupPCListeners(pc);
        });

        describe('when pc.iceConnectionState is \'disconnected\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on(Negotiator.EVENTS.iceConnectionDisconnected.key,
            () => {
              done();
            });
            pc.iceConnectionState = 'disconnected';

            pc.oniceconnectionstatechange();
          });
        });

        describe('when pc.iceConnectionState is \'failed\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on(Negotiator.EVENTS.iceConnectionDisconnected.key,
            () => {
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

      describe('onnegotiationneeded', () => {
        it('should call _makeOfferSdp', () => {
          const spy = sinon.spy(negotiator, '_makeOfferSdp');

          assert(spy.callCount === 0);
          pc.onnegotiationneeded();
          assert(spy.callCount === 1);
        });

        it('should emit \'offerCreated\'', done => {
          const offer = 'offer';
          const cbStub = sinon.stub(negotiator._pc, 'setLocalDescription');
          cbStub.callsArgWith(1, offer);

          negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
            assert(offer);
            done();
          });

          pc.onnegotiationneeded();
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
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners(pc);
      promiseStub = sinon.stub().returnsPromise();
    });

    it('should call pc.createOffer', () => {
      const offer = 'offer';
      pc.createOffer = promiseStub.resolves(offer);

      assert(promiseStub.callCount === 0);
      negotiator._makeOfferSdp();
      assert(promiseStub.callCount === 1);
    });

    it('should return offer when createOffer resolved', done => {
      negotiator._makeOfferSdp()
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
      const stub = sinon.stub(pc, 'createOffer');
      stub.callsArgWith(1, fakeError);

      negotiator.on(Negotiator.EVENTS.error.key, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        done();
      });

      negotiator._makeOfferSdp()
      .then(() => {
        assert.fail();
      })
      .catch(error => {
        assert(error);
        assert.equal(error, fakeError);
      });

      assert(stub.callCount === 1);
    });
  });

  describe('_setLocalDescription', () => {
    let negotiator;
    let pc;

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners();
    });

    it('should call pc.setLocalDescription', () => {
      const offer = 'offer';
      const promiseStub = sinon.stub().returnsPromise();
      pc.setLocalDescription = promiseStub.resolves(offer);

      assert(promiseStub.callCount === 0);
      negotiator._setLocalDescription(offer);
      assert(promiseStub.callCount === 1);
    });

    describe('when setLocalDescription resolved', () => {
      it('should emit \'offerCreated\'', done => {
        const offer = 'offer';
        const cbStub = sinon.stub(pc, 'setLocalDescription');
        cbStub.callsArgWith(1, offer);

        negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
          assert(offer);
          done();
        });

        negotiator._setLocalDescription(offer);
      });
    });

    describe('when setLocalDescription rejected', () => {
      it('should emit Error', done => {
        const offer = 'offer';
        const fakeError = 'fakeError';
        const cbStub = sinon.stub(pc, 'setLocalDescription');
        cbStub.callsArgWith(2, fakeError);

        negotiator.on(Negotiator.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.type, 'webrtc');
          done();
        });

        negotiator._setLocalDescription(offer);

        assert(cbStub.callCount === 1);
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
      negotiator.startConnection(options);

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
      negotiator._pc = negotiator._createPeerConnection();

      const setRemoteSpy = sinon.spy(negotiator._pc, 'setRemoteDescription');

      negotiator._pc.createOffer(offer => {
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
      negotiator._pc = negotiator._createPeerConnection();

      const emitSpy = sinon.spy(negotiator, 'emit');

      negotiator._pc.createOffer(offer => {
        const offerObject = {
          sdp:  offer.sdp,
          type: offer.type
        };

        assert(emitSpy.callCount === 0);

        negotiator.handleOffer(offerObject);

        setTimeout(() => {
          assert(emitSpy.callCount === 1);

          const eventName = emitSpy.args[0][0];
          const answer = emitSpy.args[0][1];

          assert(eventName, Negotiator.EVENTS.answerCreated.key);
          assert.equal(answer.type, 'answer');
          assert.equal(answer.constructor.name, 'RTCSessionDescription');

          done();
        }, waitForAsync);
      });
    });
  });

  describe('handleAnswer', () => {
    const waitForAsync = 100;
    it('should setRemoteDescription', done => {
      const negotiator = new Negotiator();
      negotiator._pc = negotiator._createPeerConnection();
      const setRemoteStub = sinon.stub(negotiator._pc, 'setRemoteDescription');

      negotiator._pc.createOffer(offer => {
        // creating an answer is complicated so just use an offer
        const answerObject = {
          sdp:  offer.sdp,
          type: 'answer'
        };

        assert(setRemoteStub.callCount === 0);

        negotiator.handleAnswer(answerObject);

        setTimeout(() => {
          assert(setRemoteStub.callCount === 1);
          assert(setRemoteStub.calledWith(
            new RTCSessionDescription(answerObject))
          );
          done();
        }, waitForAsync);
      });
    });

    describe('cleanup', () => {
      it('should close and remove PC upon cleanup()', () => {
        const negotiator = new Negotiator();
        negotiator._pc = negotiator._createPeerConnection();

        assert(negotiator._pc);
        negotiator.cleanup();
        assert.equal(negotiator._pc, null);
      });
    });
  });
});
