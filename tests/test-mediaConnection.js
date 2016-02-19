'use strict';

const Peer       = require('../src/peer');
const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let MediaConnection;

describe('MediaConnection', () => {
  let stub;
  let startSpy;

  beforeEach(() => {
    stub = sinon.stub();
    startSpy = sinon.spy();

    stub.returns({
      startConnection: startSpy
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
    startSpy = undefined;
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      assert(mc);
      assert(startSpy.calledOnce);
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
      // assert.equal(startSpy.args[0], mc.options._payload);
    });

    it('should process any queued messages after PeerConnection object is created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_payload: {}, _queuedMessages: ['message']});

      let spy = sinon.spy(mc, 'handleMessage');

      assert.deepEqual(mc._queuedMessages, ['message']);
      assert.equal(spy.calledOnce, false);
      mc.answer('foobar');
      assert.deepEqual(mc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);
    });
  });
});
