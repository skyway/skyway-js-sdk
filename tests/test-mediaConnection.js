'use strict';

const Peer       = require('../src/peer');
const assert     = require('assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

describe('MediaConnection', () => {
  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const stub = sinon.stub();
      const spy = sinon.spy();

      stub.returns({
        startConnection: spy
      });

      const Connection = proxyquire(
        '../src/connection',
        {'./negotiator': stub}
      );
      const MediaConnection = proxyquire(
        '../src/mediaConnection',
        {'./connection': Connection}
      );

      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peer, {_stream: {}});

      assert(mc);
      assert(spy.calledOnce);
    });
  });
});
