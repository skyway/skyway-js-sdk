'use strict';

const Peer       = require('../src/peer');
const util       = require('../src/util');

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let MediaConnection;

describe('MediaConnection', () => {
  let stub;
  let startSpy;
  let answerSpy;
  let candidateSpy;

  beforeEach(() => {
    stub = sinon.stub();
    startSpy = sinon.spy();
    answerSpy = sinon.spy();
    candidateSpy = sinon.spy();

    stub.returns({
      startConnection: startSpy,
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
    answerSpy.reset();
    candidateSpy.reset();
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      assert(mc);
      assert(startSpy.calledOnce);
    });

    it('should store any messages passed in when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const mc = new MediaConnection(peer, {_stream: {}, _queuedMessages: ['message']});

      assert.deepEqual(mc.options._queuedMessages, ['message']);
    });
  });

  describe('Add Stream', () => {
    it('should set remoteStream upon addStream being invoked', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      let spy = sinon.spy(mc, 'addStream');

      mc.addStream('fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert.equal(mc.remoteStream, 'fakeStream');

      spy.restore();
    });

    it('should emit a \'stream\' event upon addStream being invoked', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const mc = new MediaConnection(peer, {_stream: {}});

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
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const answer = 'message';

      const mc = new MediaConnection(peer, {_stream: {}});
      assert(answerSpy.calledOnce === false);

      mc.handleAnswer(answer);
      assert(answerSpy.calledOnce === true);
    });

    it('should call negotiator\'s handleCandidate with a candidate', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const candidate = 'message';

      const mc = new MediaConnection(peer, {_stream: {}});
      assert(candidateSpy.calledOnce === false);

      mc.handleCandidate(candidate);
      assert(candidateSpy.calledOnce === true);
    });
  });

  describe('Answering', () => {
    it('should set the localStream upon answering', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      // Callee, so no _stream option provided at first
      const mc = new MediaConnection(peer, {_payload: {}});
      assert.equal(mc.localStream, undefined);
      mc.answer('foobar');
      assert.equal(mc.localStream, 'foobar');
      assert.equal(mc.open, true);
    });

    it('should not set the localStream if already set', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      // Caller, so _stream option is initially provided
      const mc = new MediaConnection(peer, {_stream: 'exists', _payload: {}});
      assert.equal(mc.localStream, 'exists');
      mc.answer('foobar');
      assert.equal(mc.localStream, 'exists');
      assert.equal(mc.open, false);
    });

    it('should call negotiator\'s startConnection method upon answering', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_payload: {}});
      assert(startSpy.calledOnce === false);
      mc.answer('foobar');
      assert(startSpy.calledOnce === true);
    });

    it('should process any queued messages after PeerConnection object is created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const messages = [{type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message'}];

      const mc = new MediaConnection(peer, {_payload: {}, _queuedMessages: messages});

      let spy = sinon.spy(mc, 'handleAnswer');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy.calledOnce, false);
      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);

      spy.reset();
    });

    it('should not process any invalid queued messages', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const messages = [{type: 'WRONG', payload: 'message'}];

      const mc = new MediaConnection(peer, {_payload: {}, _queuedMessages: messages});

      let spy1 = sinon.spy(mc, 'handleAnswer');
      let spy2 = sinon.spy(mc, 'handleCandidate');

      assert.deepEqual(mc._queuedMessages, messages);
      assert.equal(spy1.calledOnce, false);
      assert.equal(spy2.calledOnce, false);

      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy1.calledOnce, false);
      assert.equal(spy2.calledOnce, false);

      spy1.reset();
      spy2.reset();
    });

    it('should queue a message if handleMessage is called before PC is available', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});
      const message1 = {type: util.MESSAGE_TYPES.CANDIDATE.name, payload: 'message1'};
      const message2 = {type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message2'};
      const messages = [message1];

      const mc = new MediaConnection(peer, {_payload: {}, _queuedMessages: messages});

      assert.equal(mc._pcAvailable, false);
      mc.handleAnswer(message2.payload);

      assert.deepEqual(mc._queuedMessages, [message1, message2]);
      assert(answerSpy.calledOnce === false);
      assert(candidateSpy.calledOnce === false);
    });
  });
});
