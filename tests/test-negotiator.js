'use strict';

const assert     = require('power-assert');

const Negotiator      = require('../src/negotiator');
const sinon      = require('sinon');

describe('Negotiator', () => {
  describe('Constructor', () => {
    it('should create a Negotiator object', () => {
      const negotiator = new Negotiator();

      assert(negotiator);
      assert(negotiator instanceof Negotiator);
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

      beforeEach(() => {
        negotiator = new Negotiator();
        pc = negotiator._createPeerConnection('media');
        negotiator._setupPCListeners(pc);
        ev = {};
      })

      context('when pc listen \'addstream\'', () => {
        it('should emit \'addStream\' with remote stream', done => {
          ev.stream = 'stream';
          negotiator.on('addStream', stream => {
            assert(stream, ev.stream);
            done();
          });

          pc.onaddstream(ev);
        })
      })
      context('when pc listen \'datachannel\'', () => {
        it('should emit \'dcReady\' with datachannel', done => {
          ev.channel = 'dc';
          negotiator.on('dcReady', dc => {
            assert(dc, ev.channel);
            done();
          });
          pc.ondatachannel(ev);
        })
      })
      context('when pc listen \'icecandidate\'', () => {
        it('should emit \'iceCandidate\' with ice candidate', done => {
          ev.candidate = 'candidate';
          negotiator.on('iceCandidate', candidate => {
            assert(candidate, ev.candidate);
            done();
          });

          pc.onicecandidate(ev);
        })
      })

      context('when pc listen \'oniceconnectionstatechange\'', () => {
        context('when pc.iceConnectionState is \'disconnected\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on('iceConnectionDisconnected', () => {
              done();
            });
            pc.iceConnectionState = 'disconnected';
            pc.oniceconnectionstatechange();
          })
        })
        context('when pc.iceConnectionState is \'failed\'', () => {
          it('should emit \'iceConnectionDisconnected\'', done => {
            negotiator.on('iceConnectionDisconnected', () => {
              done();
            });
            pc.iceConnectionState = 'failed';
            pc.oniceconnectionstatechange();
          })
        })
        context('when pc.iceConnectionState is \'completed\'', () => {
          it('should set pc.onicecandidate noop', () => {
            pc.iceConnectionState = 'completed';
            pc.oniceconnectionstatechange();
            const noop = () => {};
            console.log(pc.onicecandidate)
            console.log(noop)
            assert(pc.onicecandidate == () => {});
          })
        })
      })

      context('when pc listen \'negotiationneeded\'', () => {
        it('should call pc.createOffer', () => {
          console.log(pc)
          const spy = sinon.spy(pc, 'createOffer');
          pc.onnegotiationneeded();

          assert(spy.calledOnce, true);
        });
        it('should call pc.setLocalDescription', () => {
          const spy = sinon.spy(pc, 'setLocalDescription');
          pc.onnegotiationneeded();

          assert(spy.calledOnce, true);
        })
      })

      describe('pc.onremovestream', () => {
        it('do nothing', () => {
        })
      })

      describe('pc.onsignalingstatechange', () => {
        it('do nothing', () => {
        })
      })
    })

  });
});
