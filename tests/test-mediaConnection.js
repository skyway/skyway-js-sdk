'use strict';

const Peer       = require('../src/peer');
const assert     = require('assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let MediaConnection;

describe('MediaConnection', () => {

  let stub;
  let spy;

  beforeEach(() => {
    stub = sinon.stub();
    spy = sinon.spy();

    stub.returns({
      startConnection: spy,
      addStream: spy
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
    //stub.restore();
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      assert(mc);
      assert(spy.calledOnce);
    });
  });

  it('should set and emit the remote stream upon receiving it', () => {
    const peerId = 'peerId';
    const peer = new Peer(peerId, {});

    const mc = new MediaConnection(peer, {_stream: {}});
    mc.addStream("foobar");

    assert(mc);
    assert(spy.calledOnce);
  });
});
