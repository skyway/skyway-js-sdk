'use strict';

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');
const util       = require('../src/util');

let Connection;
let DataConnection;
//let util;

describe('DataConnection', () => {
  let negotiatorStub;
  let startSpy;

  let utilStub;
  let utilSpy;

  beforeEach(() => {
    // Negotiator stub and spies
    negotiatorStub = sinon.stub();
    startSpy = sinon.spy();

    negotiatorStub.returns({
      startConnection: startSpy
    });

    // Util stub and spies
    //utilSpy = sinon.spy(util, 'blobToArrayBuffer');

    Connection = proxyquire(
      '../src/connection',
      {'./negotiator': negotiatorStub}
    );
    DataConnection = proxyquire(
      '../src/dataConnection',
      {'./connection': Connection}
//       './util':       util}
    );
  });

  afterEach(() => {
    startSpy.reset();
    // utilSpy.reset();
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
    it('should emit a \'data\' event when handling a data message', done => {
      const message = {data: 'foobar'};

      const dc = new DataConnection({});
      dc.initialize({});

      dc.on('data', data => {
        assert.equal(data, message.data);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should unpack an ArrayBuffer message', done => {
      const string = 'foobar';
      const arrayBuffer = util.pack(string);
      const message = {data: arrayBuffer};

      const dc = new DataConnection({serialization: 'binary'});
      dc.initialize({});

      dc.on('data', data => {
        console.log('Got some data');
        assert.equal(data, string);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should convert and unpack a String message', done => {
      const string = 'foobar';
      const arrayBuffer = util.binaryStringToArrayBuffer(string);
      const unpacked = util.unpack(arrayBuffer);
      const message = {data: string};

      const dc = new DataConnection({serialization: 'binary'});
      dc.initialize({});

      dc.on('data', data => {
        console.log('Got some data');
        assert.equal(data, unpacked);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should convert a blob type to an array buffer', done => {
      const string = 'foobar';
      const arrayBuffer = util.pack(string);
      const blob = new Blob([arrayBuffer], {type : 'text/plain'});
      const message = {data: blob};
      
      const dc = new DataConnection({serialization: 'binary'});
      dc.initialize({});

      dc.on('data', data => {
        console.log('Got some data');
        assert.equal(data, string);
        // util.blobToArrayBuffer(message.data, ab => {
        //   assert.equal(data, util.unpack(ab));
        // });
        done();
      });
      dc._handleDataMessage(message);

      // assert(utilSpy.calledOnce);
    });
  });
});
