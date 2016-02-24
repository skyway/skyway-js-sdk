'use strict';

const Peer       = require('../src/peer');
const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let DataConnection;

describe('DataConnection', () => {
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
    DataConnection = proxyquire(
      '../src/dataConnection',
      {'./connection': Connection}
    );
  });

  afterEach(() => {
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const peerId = 'peerId';
      const peer = new Peer(peerId, {});

      const dc = new DataConnection(peer, {_stream: {}});

      assert(dc);
      assert(startSpy.calledOnce);
    });
  });
});
