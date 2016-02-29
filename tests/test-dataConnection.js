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
      const dc = new DataConnection({_stream: {}});

      assert(dc);
      assert(startSpy.calledOnce);
    });
  });

  describe('Initialise', () => {
    it('should appropriately set and configure dc upon intialisation', () => {
      dcObj = {test: 'foobar'};

      const dc = new DataConnection({_stream: {}});
      dc.initialize(dcObj);

      assert(dc._dc === dcObj);
      assert(dc._dc.onopen);
      assert(dc._dc.onmessage);
      assert(dc._dc.onclose);
    });

    it('should open the DataConnection and emit upon _dc.onopen()', () => {
      dcObj = {};
      spy = sinon.spy();

      const dc = new DataConnection({_stream: {}});
      dc.initialize(dcObj);

      spy = sinon.spy(dc, 'emit');
 
      assert.equal(dc.open, false);
      dc._dc.onopen();
      assert.equal(dc.open, true);
      assert(spy.calledOnce);

      spy.reset();
    });

    it('should handle a message upon _dc.onmessage()', () => {
      dcObj = {};
      message = {data: {constructor: 'foobar'}};
      spy = sinon.spy();

      const dc = new DataConnection({_stream: {}});
      dc.initialize(dcObj);

      spy = sinon.spy(dc, '_handleDataMessage');
 
      dc._dc.onmessage(message);
      assert(spy.calledOnce);
      assert.deepEqual(spy.args[0], message);

      spy.reset();
    });

    it('should close the DataConnection upon _dc.onclose()', () => {
      dcObj = {};
      spy = sinon.spy();

      const dc = new DataConnection({_stream: {}});
      dc.initialize(dcObj);

      spy = sinon.spy(dc, 'close');
      dc._dc.onclose();
      assert(spy.calledOnce);

      spy.reset();
    });
  });
});
