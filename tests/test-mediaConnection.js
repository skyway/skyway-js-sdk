'use strict';

const Peer       = require('../src/peer');
const Negotiator = require('../src/negotiator');

const assert     = require('assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

describe('MediaConnection', () => {
  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {

      let stub = sinon.stub();
      let spy = sinon.spy();

      stub.returns({
        startConnection: spy
      });

      let Connection = proxyquire('../src/connection', {'./negotiator': stub});
      let MediaConnection = proxyquire('../src/mediaConnection', {'./connection': Connection});

      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const mc = new MediaConnection(peerId, peer, {_stream : {}});

      assert(spy.calledOnce);
    });
  });
});
