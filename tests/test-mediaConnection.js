'use strict';

const Peer       = require('../src/peer');
const assert     = require('power-assert');
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
      addStream: spy,
      testProp:  'Hi!'
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
    console.log(stub);
    spy = undefined;
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      assert(mc);
      // spy = undefined;
      assert(spy.calledOnce);
    });
  });

  describe('Add Stream', () => {
    it.only('should set and emit the remote stream upon receiving it', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      let spy2 = sinon.spy(mc, 'addStream');

      mc.addStream('foobar');

      console.log(spy2);

      assert(mc);
      assert(spy2.calledOnce);

      spy2.restore();
    });
  });
});
