'use strict';

const assert           = require('power-assert');
const sinon            = require('sinon');
const sinonStubPromise = require('sinon-stub-promise');
const proxyquire       = require('proxyquireify')(require);

const Negotiator       = require('../src/negotiator');
const util             = require('../src/util');

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
    let newPcStub;
    let pcStub;
    let addStreamSpy;
    let createDCSpy;
    let negotiator;
    let handleOfferSpy;
    let createPCStub;

    beforeEach(() => {
      newPcStub = sinon.stub();
      addStreamSpy = sinon.spy();
      createDCSpy = sinon.spy();
      pcStub = {
        addStream:         addStreamSpy,
        createDataChannel: createDCSpy
      };

      newPcStub.returns(pcStub);
      const Negotiator = proxyquire('../src/negotiator', {
        '../src/webrtcShim': {
          RTCPeerConnection: newPcStub
        }
      });

      negotiator = new Negotiator();
      handleOfferSpy = sinon.spy(negotiator, 'handleOffer');
      createPCStub = sinon.stub(negotiator, '_createPeerConnection');
      createPCStub.returns(pcStub);
    });

    afterEach(() => {
      newPcStub.reset();
      addStreamSpy.reset();
      createDCSpy.reset();
      handleOfferSpy.reset();
    });

    it('should call _createPeerConnection pcConfig and set _pc to the result', () => {
      const options = {
        originator: true,
        pcConfig:   {}
      };

      negotiator.startConnection(options);

      assert.equal(createPCStub.callCount, 1);
      assert(createPCStub.calledWith, options.pcConfig);
      assert.equal(negotiator._pc, pcStub);
    });

    describe('when type is \'media\'', () => {
      describe('when originator is true', () => {
        it('should call pc.addStream', () => {
          const options = {
            type:       'media',
            stream:     {},
            originator: true,
            pcConfig:   {}
          };

          assert.equal(addStreamSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(addStreamSpy.callCount, 1);
          assert.equal(handleOfferSpy.callCount, 0);
        });
      });

      describe('when originator is false', () => {
        it('should call pc.addStream and handleOffer', () => {
          const options = {
            type:       'media',
            stream:     {},
            originator: false,
            pcConfig:   {},
            offer:      {}
          };

          assert.equal(addStreamSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(addStreamSpy.callCount, 1);
          assert.equal(handleOfferSpy.callCount, 1);
          assert(handleOfferSpy.calledWith(options.offer));
        });
      });

      describe('when originator is undefined', () => {
        it('should call pc.addStream and handleOffer', () => {
          const options = {
            type:     'media',
            stream:   {},
            pcConfig: {},
            offer:    {}
          };

          assert.equal(addStreamSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(addStreamSpy.callCount, 1);
          assert.equal(handleOfferSpy.callCount, 1);
          assert(handleOfferSpy.calledWith(options.offer));
        });
      });
    });

    describe('when type is \'data\'', () => {
      describe('when originator is true', () => {
        it('should call createDataChannel and emit \'dcCreated\'', done => {
          const options = {
            type:       'data',
            originator: true,
            pcConfig:   {}
          };

          negotiator.on(Negotiator.EVENTS.dcCreated.key, () => {
            done();
          });

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 1);
          assert.equal(handleOfferSpy.callCount, 0);
        });
      });

      describe('when originator is false', () => {
        it('should call handleOffer with options.offer', () => {
          const options = {
            type:       'data',
            originator: false,
            pcConfig:   {},
            offer:      {}
          };

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 1);
          assert(handleOfferSpy.calledWith(options.offer));
        });
      });

      describe('when originator is undefined', () => {
        it('should call handleOffer with options.offer', () => {
          const options = {
            type:       'data',
            originator: false,
            pcConfig:   {},
            offer:      {}
          };

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 1);
          assert(handleOfferSpy.calledWith(options.offer));
        });
      });
    });

    describe('when type is undefined', () => {
      describe('when originator is true', () => {
        it('shouldn\'t call createDataConnection or addStream', () => {
          const options = {
            originator: true,
            pcConfig:   {}
          };

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(addStreamSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(addStreamSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);
        });
      });

      describe('when originator is false', () => {
        it('should call handleOffer', () => {
          const options = {
            type:       'data',
            originator: false,
            pcConfig:   {}
          };

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 1);
        });
      });

      describe('when originator is undefined', () => {
        it('should call handleOffer', () => {
          const options = {
            type:     'data',
            pcConfig: {}
          };

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 0);

          negotiator.startConnection(options);

          assert.equal(createDCSpy.callCount, 0);
          assert.equal(handleOfferSpy.callCount, 1);
        });
      });
    });
  });

  describe('_createPeerConnection', () => {
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
      assert.equal(typeof pc.onaddstream, 'function');
      assert.equal(typeof pc.ondatachannel, 'function');
      assert.equal(typeof pc.onicecandidate, 'function');
      assert.equal(typeof pc.oniceconnectionstatechange, 'function');
      assert.equal(typeof pc.onnegotiationneeded, 'function');
      assert.equal(typeof pc.onremovestream, 'function');
      assert.equal(typeof pc.onsignalingstatechange, 'function');
    });

    describe('RTCPeerConnection\'s event listeners', () => {
      let negotiator;
      let pc;

      beforeEach(() => {
        negotiator = new Negotiator();
        pc = negotiator._pc = negotiator._createPeerConnection();
        negotiator._setupPCListeners(pc);
      });

      describe('onaddstream', () => {
        it('should emit \'addStream\' with remote stream', done => {
          let ev = {stream: 'stream'};
          negotiator.on(Negotiator.EVENTS.addStream.key, stream => {
            assert.equal(stream, ev.stream);
            done();
          });

          pc.onaddstream(ev);
        });
      });

      describe('ondatachannel', () => {
        it('should emit \'dcCreated\' with datachannel', done => {
          let ev = {channel: 'dc'};
          negotiator.on(Negotiator.EVENTS.dcCreated.key, dc => {
            assert(dc, ev.channel);
            done();
          });

          pc.ondatachannel(ev);
        });
      });

      describe('onicecandidate', () => {
        it('should emit \'iceCandidate\' with ice candidate', done => {
          let ev = {candidate: 'candidate'};
          negotiator.on(Negotiator.EVENTS.iceCandidate.key, candidate => {
            assert(candidate, ev.candidate);
            done();
          });

          pc.onicecandidate(ev);
        });

        it('should not emit \'iceCandidate\' when out of candidates', done => {
          let ev = {};
          negotiator.on(Negotiator.EVENTS.iceCandidate.key, () => {
            assert.fail('Should not emit iceCandidate event');
          });

          pc.onicecandidate(ev);

          // let other async events run before finishing
          setTimeout(done);
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
            negotiator.on(Negotiator.EVENTS.iceConnectionDisconnected.key, () => {
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
            assert.equal(typeof pc.onicecandidate, 'function');
          });
        });
      });

      describe('onnegotiationneeded', () => {
        it('should call _makeOfferSdp', () => {
          const spy = sinon.spy(negotiator, '_makeOfferSdp');

          assert.equal(spy.callCount, 0);
          pc.onnegotiationneeded();
          assert.equal(spy.callCount, 1);
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

      describe('onremovestream', () => {
        let logSpy;
        beforeEach(() => {
          logSpy = sinon.spy(util, 'log');
        });

        afterEach(() => {
          logSpy.restore();
        });

        it('should log the event', () => {
          pc.onremovestream();
          logSpy.calledWith('`removestream` triggered');
        });
      });
    });
  });

  describe('_makeOfferSdp', () => {
    let negotiator;
    let pc;
    let createOfferStub;

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners(pc);

      createOfferStub = sinon.stub(pc, 'createOffer');
    });

    it('should call pc.createOffer', () => {
      assert.equal(createOfferStub.callCount, 0);
      negotiator._makeOfferSdp();
      assert.equal(createOfferStub.callCount, 1);
      assert.equal(typeof createOfferStub.args[0][0], 'function');
      assert.equal(typeof createOfferStub.args[0][1], 'function');
    });

    it('should return offer when createOffer succeeds', done => {
      const fakeOffer = 'offer';
      createOfferStub.callsArgWith(0, fakeOffer);
      negotiator._makeOfferSdp()
        .then(offer => {
          assert.equal(offer, fakeOffer);
          done();
        }).catch(() => {
          assert.fail();
        });
    });

    it('should emit Error when createOffer fails', done => {
      const fakeError = 'fakeError';
      createOfferStub.callsArgWith(1, fakeError);

      negotiator.on(Negotiator.EVENTS.error.key, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        assert.equal(err.message, fakeError);
        done();
      });

      negotiator._makeOfferSdp()
        .then(() => {
          assert.fail();
        });
    });
  });

  describe('_makeAnswerSdp', () => {
    let negotiator;
    let pc;
    let createAnswerStub;
    let setLocalDescriptionStub;

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners(pc);

      createAnswerStub = sinon.stub(pc, 'createAnswer');
      setLocalDescriptionStub = sinon.stub(pc, 'setLocalDescription');
    });

    it('should call pc.createAnswer', () => {
      assert.equal(createAnswerStub.callCount, 0);
      negotiator._makeAnswerSdp();
      assert.equal(createAnswerStub.callCount, 1);
      assert.equal(typeof createAnswerStub.args[0][0], 'function');
      assert.equal(typeof createAnswerStub.args[0][1], 'function');
    });

    describe('when createAnswer succeeds', () => {
      it('should return answer when setLocalDescription succeeds', done => {
        const fakeAnswer = 'answer';
        createAnswerStub.callsArgWith(0, fakeAnswer);
        setLocalDescriptionStub.callsArg(1);

        negotiator._makeAnswerSdp()
          .then(answer => {
            assert.equal(answer, fakeAnswer);
            done();
          }).catch(() => {
            assert.fail();
          });
      });

      it('should emit Error when setLocalDescription fails', done => {
        const fakeAnswer = 'answer';
        const fakeError = 'fakeError';
        createAnswerStub.callsArgWith(0, fakeAnswer);
        setLocalDescriptionStub.callsArgWith(2, fakeError);

        negotiator.on(Negotiator.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.type, 'webrtc');
          assert.equal(err.message, fakeError);
          done();
        });

        negotiator._makeAnswerSdp()
          .then(() => {
            assert.fail();
          });
      });
    });

    it('should emit Error when createAnswer fails', done => {
      const fakeError = 'fakeError';
      createAnswerStub.callsArgWith(1, fakeError);

      negotiator.on(Negotiator.EVENTS.error.key, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        assert.equal(err.message, fakeError);
        done();
      });

      negotiator._makeAnswerSdp()
        .then(() => {
          assert.fail();
        });
    });
  });

  describe('_setRemoteDescription', () => {
    let negotiator;
    let pc;
    let setRemoteDescriptionStub;

    const sdp = {
      type: 'offer',
      sdp:  'sdp'
    };

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners();

      setRemoteDescriptionStub = sinon.stub(pc, 'setRemoteDescription');
    });

    it('should call pc.setRemoteDescription', () => {
      assert.equal(setRemoteDescriptionStub.callCount, 0);
      negotiator._setRemoteDescription(sdp);
      assert.equal(setRemoteDescriptionStub.callCount, 1);
      assert.equal(setRemoteDescriptionStub.args[0][0].type, sdp.type);
      assert.equal(setRemoteDescriptionStub.args[0][0].sdp, sdp.sdp);
      assert.equal(setRemoteDescriptionStub.args[0][0].sdp, sdp.sdp);
    });

    it('should resolve if setRemoteDescription succeeds', done => {
      setRemoteDescriptionStub.callsArg(1);

      negotiator._setRemoteDescription(sdp)
        .then(() => {
          done();
        });
    });

    it('should emit Error if setRemoteDescription fails', done => {
      const fakeError = 'fakeError';
      setRemoteDescriptionStub.callsArgWith(2, fakeError);

      negotiator.on(Negotiator.EVENTS.error.key, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        done();
      });

      negotiator._setRemoteDescription(sdp);
    });
  });

  describe('_setLocalDescription', () => {
    let negotiator;
    let pc;
    let setLocalDescriptionStub;

    beforeEach(() => {
      negotiator = new Negotiator();
      pc = negotiator._pc = negotiator._createPeerConnection();
      negotiator._setupPCListeners();

      setLocalDescriptionStub = sinon.stub(pc, 'setLocalDescription');
    });

    it('should call pc.setLocalDescription', () => {
      const offer = 'offer';

      assert.equal(setLocalDescriptionStub.callCount, 0);
      negotiator._setLocalDescription(offer);
      assert(setLocalDescriptionStub.calledWith(offer));
      assert.equal(setLocalDescriptionStub.callCount, 1);
    });

    it('should emit \'offerCreated\' if setLocalDescription succeeds', done => {
      const offer = 'offer';
      setLocalDescriptionStub.callsArgWith(1, offer);

      negotiator.on(Negotiator.EVENTS.offerCreated.key, offer => {
        assert(offer);
        done();
      });

      negotiator._setLocalDescription(offer);
    });

    it('should emit Error if setLocalDescription fails', done => {
      const offer = 'offer';
      const fakeError = 'fakeError';
      setLocalDescriptionStub.callsArgWith(2, fakeError);

      negotiator.on(Negotiator.EVENTS.error.key, err => {
        assert(err instanceof Error);
        assert.equal(err.type, 'webrtc');
        done();
      });

      negotiator._setLocalDescription(offer);
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

      assert.equal(addIceStub.callCount, 0);

      negotiator.handleCandidate(candidate);

      assert.equal(addIceStub.callCount, 1);

      const addIceArg = addIceStub.args[0][0];
      assert.equal(addIceArg.constructor.name, 'RTCIceCandidate');
      assert.equal(candidate.candidate, addIceArg.candidate);
      assert.equal(candidate.sdpMLineIndex, addIceArg.sdpMLineIndex);
      assert.equal(candidate.sdpMid, addIceArg.sdpMid);
    });
  });

  describe('handleOffer', () => {
    let negotiator;

    beforeEach(() => {
      negotiator = new Negotiator();
      negotiator._pc = negotiator._createPeerConnection();
    });

    it('should setRemoteDescription', done => {
      const setRemoteSpy = sinon.spy(negotiator._pc, 'setRemoteDescription');

      negotiator._pc.createOffer(offer => {
        const offerObject = {
          sdp:  offer.sdp,
          type: offer.type
        };

        negotiator.handleOffer(offerObject);

        // let other async events run
        setTimeout(() => {
          assert.equal(setRemoteSpy.callCount, 1);
          assert(setRemoteSpy.calledWith(offer));
          done();
        });
      }, err => {
        assert.fail(err);
      });
    });

    it('should emit answerCreated', done => {
      negotiator._pc.createOffer(offer => {
        const offerObject = {
          sdp:  offer.sdp,
          type: offer.type
        };

        negotiator.handleOffer(offerObject);

        negotiator.on(Negotiator.EVENTS.answerCreated.key, answer => {
          assert.equal(answer.type, 'answer');
          assert.equal(answer.constructor.name, 'RTCSessionDescription');
          done();
        });
      }, err => {
        assert.fail(err);
      });
    });
  });

  describe('handleAnswer', () => {
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

        assert.equal(setRemoteStub.callCount, 0);

        negotiator.handleAnswer(answerObject);

        // let other async events run
        setTimeout(() => {
          assert.equal(setRemoteStub.callCount, 1);
          assert(setRemoteStub.calledWith(
            new RTCSessionDescription(answerObject))
          );
          done();
        });
      }, err => {
        assert.fail(err);
      });
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

  describe('_emitError', () => {
    const errorMessage = 'Error message';
    const errorType = 'error-type';
    let errorStub;
    let negotiator;

    beforeEach(() => {
      errorStub = sinon.stub(util, 'error');
      negotiator = new Negotiator();
    });

    afterEach(() => {
      errorStub.restore();
    });

    describe('when error is an Error object', () => {
      let error;
      beforeEach(() => {
        error = new Error(errorMessage);
      });

      it('should log the error', () => {
        sinon.stub(negotiator, 'emit');
        negotiator._emitError(errorType, error);

        assert(errorStub.calledWith(error));
      });

      it('should emit the error in an \'error\' event', done => {
        negotiator.on(Negotiator.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.message, errorMessage);
          assert.equal(err.type, errorType);
          done();
        });

        negotiator._emitError(errorType, error);
      });
    });

    describe('when error is an string', () => {
      it('should log the error', () => {
        sinon.stub(negotiator, 'emit');
        negotiator._emitError(errorType, errorMessage);

        assert(errorStub.calledOnce);

        const loggedError = errorStub.args[0][0];
        assert.equal(loggedError.message, errorMessage);
        assert.equal(loggedError.type, errorType);
      });

      it('should emit the error in an \'error\' event', done => {
        negotiator.on(Negotiator.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.message, errorMessage);
          assert.equal(err.type, errorType);
          done();
        });

        negotiator._emitError(errorType, errorMessage);
      });
    });
  });
});
