import assert from 'power-assert';
import sinon from 'sinon';

import config from '../../src/shared/config';
import Negotiator from '../../src/peer/negotiator';

import connectionInjector from 'inject-loader!../../src/peer/connection';
import mediaConnectionInjector from 'inject-loader!../../src/peer/mediaConnection';

let Connection;
let MediaConnection;

describe('MediaConnection', () => {
  let stub;
  let startSpy;
  let cleanupSpy;
  let answerSpy;
  let candidateSpy;
  let replaceSpy;

  beforeEach(() => {
    stub = sinon.stub();
    startSpy = sinon.spy();
    cleanupSpy = sinon.spy();
    answerSpy = sinon.spy();
    candidateSpy = sinon.spy();
    replaceSpy = sinon.spy();

    stub.returns({
      on: function(event, callback) {
        this[event] = callback;
      },
      emit: function(event, arg) {
        this[event](arg);
      },
      startConnection: startSpy,
      cleanup: cleanupSpy,
      handleAnswer: answerSpy,
      handleCandidate: candidateSpy,
      replaceStream: replaceSpy,
      setRemoteBrowser: sinon.spy(),
    });
    // hoist statics
    stub.EVENTS = Negotiator.EVENTS;

    Connection = connectionInjector({ './negotiator': stub }).default;
    MediaConnection = mediaConnectionInjector({ './connection': Connection })
      .default;
  });

  afterEach(() => {
    startSpy.resetHistory();
    cleanupSpy.resetHistory();
    answerSpy.resetHistory();
    candidateSpy.resetHistory();
    replaceSpy.resetHistory();
  });

  describe('Constructor', () => {
    it('should store any messages passed in when created', () => {
      const mc = new MediaConnection('remoteId', {
        stream: {},
        queuedMessages: ['message'],
      });
      assert.deepEqual(mc._options.queuedMessages, ['message']);
    });

    it('should set properties from arguments properly', () => {
      const id = 'remoteId';
      const metadata = 'meta';
      const stream = Symbol();
      const options = {
        stream: stream,
        metadata: metadata,
      };

      const mc = new MediaConnection(id, options);
      assert.equal(mc.type, 'media');
      assert.equal(mc.remoteId, id);
      assert.equal(mc.peer, id);
      assert.equal(mc.localStream, stream);
      assert.equal(mc.metadata, metadata);
      assert.equal(mc._options, options);
    });
  });

  describe('startConnection', () => {
    it("should call negotiator's startConnection method when created and originator", async () => {
      const mc = new MediaConnection('remoteId', {
        stream: {},
        originator: true,
      });
      await mc.startConnection();

      assert(mc);
      assert(startSpy.calledOnce);
    });
    it("should not call negotiator's startConnection method when created and not originator", async () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      await mc.startConnection();

      assert(mc);
      assert(startSpy.notCalled);
    });
  });

  describe('_setupNegotiatorMessageHandlers', () => {
    let mc;
    beforeEach(() => {
      mc = new MediaConnection('remoteId', {});
    });

    it("should emit 'candidate' on negotiator 'iceCandidate' event", done => {
      const candidate = Symbol();
      mc.on(Connection.EVENTS.candidate.key, connectionCandidate => {
        assert(connectionCandidate);
        assert.equal(connectionCandidate.candidate, candidate);
        assert.equal(connectionCandidate.dst, mc.remoteId);
        assert.equal(connectionCandidate.connectionId, mc.id);
        assert.equal(connectionCandidate.connectionType, mc.type);
        done();
      });

      mc._negotiator.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
    });

    it("should emit 'answer' on negotiator 'answerCreated' event", done => {
      const answer = Symbol();
      mc.on(Connection.EVENTS.answer.key, connectionCandidate => {
        assert(connectionCandidate);
        assert.equal(connectionCandidate.answer, answer);
        assert.equal(connectionCandidate.dst, mc.remoteId);
        assert.equal(connectionCandidate.connectionId, mc.id);
        assert.equal(connectionCandidate.connectionType, mc.type);
        done();
      });

      mc._negotiator.emit(Negotiator.EVENTS.answerCreated.key, answer);
    });

    it("should emit 'offer' on negotiator 'offerCreated' event", done => {
      const offer = Symbol();
      mc.on(Connection.EVENTS.offer.key, connectionOffer => {
        assert(connectionOffer);
        assert.equal(connectionOffer.offer, offer);
        assert.equal(connectionOffer.dst, mc.remoteId);
        assert.equal(connectionOffer.connectionId, mc.id);
        assert.equal(connectionOffer.connectionType, mc.type);
        assert.equal(connectionOffer.metadata, mc.metadata);
        done();
      });

      mc._negotiator.emit(Negotiator.EVENTS.offerCreated.key, offer);
    });

    it("should cleanup the connection on negotiator 'iceConnectionDisconnected' event", () => {
      mc.open = true;
      const spy = sinon.spy(mc, 'close');

      mc._negotiator.emit(Negotiator.EVENTS.iceConnectionFailed.key);

      assert(spy.calledOnce);
      assert.equal(mc.open, false);
    });

    it("should set remoteStream on 'addStream' being emitted", () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      mc._negotiator.emit(Negotiator.EVENTS.addStream.key, 'fakeStream');

      assert.equal(mc.remoteStream, 'fakeStream');
    });

    it("should emit a 'stream' event upon 'addStream' being emitted", () => {
      const mc = new MediaConnection('remoteId', { stream: {} });

      const spy = sinon.spy(mc, 'emit');

      mc._negotiator.emit(Negotiator.EVENTS.addStream.key, 'fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert(
        spy.calledWith(MediaConnection.EVENTS.stream.key, 'fakeStream') === true
      );

      spy.restore();
    });
  });

  describe('replaceStream', () => {
    it('should call negotiator.replaceStream', () => {
      const mc = new MediaConnection('remoteId', {});
      const newStream = {};

      mc.replaceStream(newStream);

      assert(replaceSpy.calledOnce);
      assert(replaceSpy.calledWith(newStream));
    });

    it('should change localStream property with newStream', () => {
      const mc = new MediaConnection('remoteId', {});
      const newStream = {};

      mc.replaceStream(newStream);

      assert.equal(mc.localStream, newStream);
    });
  });

  describe('Handling messages', () => {
    it("should call negotiator's handleAnswer with an answer", () => {
      const answer = 'message';

      const mc = new MediaConnection('remoteId', { stream: {} });
      mc._pcAvailable = true;

      assert(answerSpy.called === false);

      mc.handleAnswer(answer);
      assert(answerSpy.calledOnce === true);
    });

    it("should call negotiator's handleCandidate with a candidate", () => {
      const candidate = 'message';

      const mc = new MediaConnection('remoteId', { stream: {} });
      mc._pcAvailable = true;

      assert(candidateSpy.called === false);

      mc.handleCandidate(candidate);
      assert(candidateSpy.calledOnce === true);
    });
  });

  describe('Answering', () => {
    it('should set the localStream upon answering', () => {
      // Callee, so no stream option provided at first
      const mc = new MediaConnection('remoteId', { payload: {} });
      assert.equal(mc.localStream, undefined);
      mc.answer('foobar');
      assert.equal(mc.localStream, 'foobar');
      assert.equal(mc.open, true);
    });

    it('should not set the localStream if already set', () => {
      // Caller, so stream option is initially provided
      const mc = new MediaConnection('remoteId', {
        stream: 'exists',
        payload: {},
      });
      assert.equal(mc.localStream, 'exists');
      mc.answer('foobar');
      assert.equal(mc.localStream, 'exists');
      assert.equal(mc.open, false);
    });

    it("should call negotiator's startConnection method upon answering", () => {
      const mc = new MediaConnection('remoteId', { payload: {} });
      assert(startSpy.called === false);
      mc.answer('foobar');
      assert(startSpy.calledOnce === true);
    });

    it('should process any queued messages after PeerConnection object is created', () => {
      const messages = [
        { type: config.MESSAGE_TYPES.SERVER.ANSWER.key, payload: 'message' },
      ];

      const mc = new MediaConnection('remoteId', {
        payload: {},
        queuedMessages: messages,
      });

      const spy = sinon.spy(mc, 'handleAnswer');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy.called, false);

      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);

      spy.resetHistory();
    });

    it('should not process any invalid queued messages', () => {
      const messages = [{ type: 'WRONG', payload: 'message' }];

      const mc = new MediaConnection('remoteId', {
        payload: {},
        queuedMessages: messages,
      });

      const spy1 = sinon.spy(mc, 'handleAnswer');
      const spy2 = sinon.spy(mc, 'handleCandidate');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);

      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);

      spy1.resetHistory();
      spy2.resetHistory();
    });

    it('should queue a message if handleMessage is called before PC is available', () => {
      const message1 = {
        type: config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
        payload: 'message1',
      };
      const message2 = {
        type: config.MESSAGE_TYPES.SERVER.ANSWER.key,
        payload: 'message2',
      };
      const messages = [message1];

      const mc = new MediaConnection('remoteId', {
        payload: {},
        queuedMessages: messages,
      });

      assert.equal(mc._pcAvailable, false);
      mc.handleAnswer(message2.payload);

      assert.deepEqual(mc._queuedMessages, [message1, message2]);
      assert(answerSpy.called === false);
      assert(candidateSpy.called === false);
    });
  });

  describe('getPeerConnection', () => {
    it('should return null when Connection status is not open', async () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      mc._negotiator._pc = {};
      mc.open = false;

      const pc = mc.getPeerConnection();

      assert.equal(pc, null);
    });

    it('should return RTCPeerConnection object when Connection status is open', async () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      mc._negotiator._pc = {};
      mc.open = true;

      const pc = await mc.getPeerConnection();

      assert.deepEqual(pc, {});
    });
  });

  describe('Cleanup', () => {
    it('should close the socket and call the negotiator to cleanup on close()', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });

      // Force to be open
      mc.open = true;

      const spy = sinon.spy(mc, 'close');

      mc.close();
      assert(mc);
      assert(spy.calledOnce);
      assert.equal(mc.open, false);

      assert(cleanupSpy.called);
    });
  });

  describe('Close', () => {
    it('should emit a close event upon the connection is opening', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      const spy = sinon.spy(mc, 'emit');
      // Force to be open
      mc.open = true;

      mc.close();

      assert(spy.withArgs(Connection.EVENTS.close.key).calledOnce);
    });

    it('should NOT emit a close event upon the connection is closed', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      const spy = sinon.spy(mc, 'emit');
      // Force to be close
      mc.open = false;

      mc.close();

      assert(spy.withArgs(Connection.EVENTS.close.key).notCalled);
    });

    it('should emit a forceClose event when call close(true)', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      const spy = sinon.spy(mc, 'emit');
      // Force to be open
      mc.open = true;

      mc.close(true);

      assert(spy.withArgs(Connection.EVENTS.forceClose.key).calledOnce);
    });

    it('should not emit a forceClose event when call close(false)', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      const spy = sinon.spy(mc, 'emit');
      // Force to be open
      mc.open = true;

      mc.close(false);

      assert(spy.withArgs(Connection.EVENTS.forceClose.key).notCalled);
    });

    it('should not emit a forceClose event when call close() by default', () => {
      const mc = new MediaConnection('remoteId', { stream: {} });
      const spy = sinon.spy(mc, 'emit');
      // Force to be open
      mc.open = true;

      mc.close();

      assert(spy.withArgs(Connection.EVENTS.forceClose.key).notCalled);
    });
  });
});
