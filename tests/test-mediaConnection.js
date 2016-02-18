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
    it('should set and emit the remote stream upon receiving it', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      let spy = sinon.spy(mc, 'addStream');

      mc.addStream('foobar');

      assert(mc);
      assert(spy.calledOnce);

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
    });

    it('should call negotiator\'s startConnection method upon answering', () => {

    });
  });
});
