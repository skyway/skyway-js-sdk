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
    negotiatorStub = sinon.stub();
    startSpy = sinon.spy();

    negotiatorStub.returns({
      startConnection: startSpy
    });

    Connection = proxyquire(
      '../src/connection',
      {'./negotiator': negotiatorStub}
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
      const dc = new DataConnection({});

      assert(dc);
      assert(startSpy.calledOnce);
    });
  });

  describe('Initialise', () => {
    it('should appropriately set and configure dc upon intialisation', () => {
      const dcObj = {test: 'foobar'};

      const dc = new DataConnection({});
      dc.initialize(dcObj);

      assert(dc._dc === dcObj);
      assert(dc._dc.onopen);
      assert(dc._dc.onmessage);
      assert(dc._dc.onclose);
    });

    it('should open the DataConnection and emit upon _dc.onopen()', () => {
      let spy;

      const dc = new DataConnection({});
      dc.initialize({});

      spy = sinon.spy(dc, 'emit');
 
      assert.equal(dc.open, false);
      dc._dc.onopen();
      assert.equal(dc.open, true);
      assert(spy.calledOnce);

      spy.reset();
    });

    it('should handle a message upon _dc.onmessage()', () => {
      const message = {data: {constructor: 'foobar'}};
      let spy;

      const dc = new DataConnection({});
      dc.initialize({});

      spy = sinon.spy(dc, '_handleDataMessage');
 
      dc._dc.onmessage(message);
      assert(spy.calledOnce);
      console.log(spy.args[0]);
      // assert.equal(spy.args[0], message);

      spy.reset();
    });

    it('should close the DataConnection upon _dc.onclose()', () => {
      let spy;

      const dc = new DataConnection({});
      dc.initialize({});

      spy = sinon.spy(dc, 'close');
      dc._dc.onclose();
      assert(spy.calledOnce);

      spy.reset();
    });
  });

  describe('Handle Message', () => {
    it('should convert a blob type to an array buffer', () => {
      const blob = new Blob([1,2,3]);
      const message = {data: blob};
      let spy = sinon.spy();

      const dc = new DataConnection({serialization: 'binary'});
      dc.initialize({});

      spy = sinon.spy(dc, 'emit');

      dc._handleDataMessage(message);
      assert(spy.calledOnce);
      console.log(spy.args[0][1]);
      assert(spy.args[0][0] === 'data');
      // assert(spy.args[1] === 'not true');
    });
  });
});
