'use strict';

const util       = require('../src/util');

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let MediaConnection;

describe('MediaConnection', () => {
  let stub;
  let startSpy;
  let cleanupSpy;
  let answerSpy;
  let candidateSpy;

  beforeEach(() => {
    stub = sinon.stub();
    startSpy = sinon.spy();
    cleanupSpy = sinon.spy();
    answerSpy = sinon.spy();
    candidateSpy = sinon.spy();

    stub.returns({
      startConnection: startSpy,
      cleanup:         cleanupSpy,
      handleAnswer:    answerSpy,
      handleCandidate: candidateSpy
    });

    Connection = proxyquire(
      '../src/connection',
      {'./negotiator': stub}
    );
    MediaConnection = proxyquire(
      '../src/mediaConnection',
      {'./connection': Connection}
    );
  });

  afterEach(() => {
    startSpy.reset();
    cleanupSpy.reset();
    answerSpy.reset();
    candidateSpy.reset();
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const mc = new MediaConnection('id', {_stream: {}});

      assert(mc);
      assert(startSpy.calledOnce);
    });

    it('should store any messages passed in when created', () => {
      const mc = new MediaConnection('id',
        {_stream: {}, _queuedMessages: ['message']}
      );
      assert.deepEqual(mc.options._queuedMessages, ['message']);
    });
  });

  describe('Add Stream', () => {
    it('should set remoteStream upon addStream being invoked', () => {
      const mc = new MediaConnection('id', {_stream: {}});

      let spy = sinon.spy(mc, 'addStream');

      mc.addStream('fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert.equal(mc.remoteStream, 'fakeStream');

      spy.restore();
    });

    it('should emit a \'stream\' event upon addStream being invoked', () => {
      const mc = new MediaConnection('id', {_stream: {}});

      let spy = sinon.spy(mc, 'emit');

      mc.addStream('fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert(spy.calledWith('stream', 'fakeStream') === true);

      spy.restore();
    });
  });

  describe('Handling messages', () => {
    it('should call negotiator\'s handleAnswer with an answer', () => {
      const answer = 'message';

      const mc = new MediaConnection('id', {_stream: {}});
      assert(answerSpy.called === false);

      mc.handleAnswer(answer);
      assert(answerSpy.calledOnce === true);
    });

    it('should call negotiator\'s handleCandidate with a candidate', () => {
      const candidate = 'message';

      const mc = new MediaConnection('id', {_stream: {}});
      assert(candidateSpy.called === false);

      mc.handleCandidate(candidate);
      assert(candidateSpy.calledOnce === true);
    });
  });

  describe('Answering', () => {
    it('should set the localStream upon answering', () => {
      // Callee, so no _stream option provided at first
      const mc = new MediaConnection('id', {_payload: {}});
      assert.equal(mc.localStream, undefined);
      mc.answer('foobar');
      assert.equal(mc.localStream, 'foobar');
      assert.equal(mc.open, true);
    });

    it('should not set the localStream if already set', () => {
      // Caller, so _stream option is initially provided
      const mc = new MediaConnection('id', {_stream: 'exists', _payload: {}});
      assert.equal(mc.localStream, 'exists');
      mc.answer('foobar');
      assert.equal(mc.localStream, 'exists');
      assert.equal(mc.open, false);
    });

    it('should call negotiator\'s startConnection method upon answering', () => {
      const mc = new MediaConnection('id', {_payload: {}});
      assert(startSpy.called === false);
      mc.answer('foobar');
      assert(startSpy.calledOnce === true);
    });

    it('should process any queued messages after PeerConnection object is created', () => {
      const messages = [{type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message'}];

      const mc = new MediaConnection('id', {_payload: {}, _queuedMessages: messages});

      let spy = sinon.spy(mc, 'handleAnswer');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy.called, false);
      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);

      spy.reset();
    });

    it('should not process any invalid queued messages', () => {
      const messages = [{type: 'WRONG', payload: 'message'}];

      const mc = new MediaConnection('id', {_payload: {}, _queuedMessages: messages});

      let spy1 = sinon.spy(mc, 'handleAnswer');
      let spy2 = sinon.spy(mc, 'handleCandidate');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);

      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);

      spy1.reset();
      spy2.reset();
    });

    it('should queue a message if handleMessage is called before PC is available', () => {
      const message1 = {type: util.MESSAGE_TYPES.CANDIDATE.name, payload: 'message1'};
      const message2 = {type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message2'};
      const messages = [message1];

      const mc = new MediaConnection('id', {_payload: {}, _queuedMessages: messages});

      assert.equal(mc._pcAvailable, false);
      mc.handleAnswer(message2.payload);

      assert.deepEqual(mc._queuedMessages, [message1, message2]);
      assert(answerSpy.called === false);
      assert(candidateSpy.called === false);
    });
  });

  describe('Cleanup', () => {
    it('should close the socket and call the negotiator to cleanup on close()', () => {
      const mc = new MediaConnection('id', {_stream: {}});

      // Force to be open
      mc.open = true;

      let spy = sinon.spy(mc, 'close');

      mc.close();
      assert(mc);
      assert(spy.calledOnce);
      assert.equal(mc.open, false);

      assert(cleanupSpy.called);
    });
  });
});
