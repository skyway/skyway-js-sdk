'use strict';

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');
const util       = require('../src/util');

let Connection;
let DataConnection;

describe('DataConnection', () => {
  let negotiatorStub;
  let startSpy;

  beforeEach(() => {
    // Negotiator stub and spies
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
    startSpy.reset();
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
        assert.equal(data, unpacked);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should convert a blob type to an array buffer', done => {
      const string = 'foobar';
      const arrayBuffer = util.pack(string);
      const blob = new Blob([arrayBuffer], {type: 'text/plain'});
      const message = {data: blob};

      const dc = new DataConnection({serialization: 'binary'});
      dc.initialize({});

      dc.on('data', data => {
        assert.equal(data, string);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should parse JSON messages', done => {
      const obj = {name: 'foobar'};
      const json = JSON.stringify(obj);
      const message = {data: json};

      const dc = new DataConnection({serialization: 'json'});
      dc.initialize({});

      dc.on('data', data => {
        assert.deepEqual(data, obj);
        done();
      });

      dc._handleDataMessage(message);
    });

    it('should be able to recombine chunked blobs', done => {
      // Chunk size is 16300
      // Each char is 2 bytes
      const len = 16300 * 3;
      const string = new Array(len + 1).join('a');
      const arrayBuffer = util.pack(string);
      const blob = new Blob([arrayBuffer], {type: 'text/plain'});

      let chunked = util.chunk(blob);
      console.log('Blob size: ' + blob.size);
      console.log('Chunks: ' + chunked.length);

      const dc = new DataConnection({});
      dc.initialize({});

      dc.on('data', data => {
        // Receives the reconstructed blob after all chunks have been handled
        assert.deepEqual(data, blob);
        done();
      });

      for (let chunk of chunked) {
        let message = {data: chunk};
        dc._handleDataMessage(message);
      }
    });
  });

  describe('Send', () => {
    it('should emit an error if send() is called while DC is not open', done => {
      const dc = new DataConnection({});
      assert.equal(dc.open, false);

      dc.on('error', error => {
        assert(error instanceof Error);
        done();
      });

      dc.send('foobar', false);
    });

    it('should stringify JSON data and call _bufferedSend', () => {
      const obj = {name: 'foobar'};

      const dc = new DataConnection({});
      dc.initialize({});
      dc._dc.onopen();
      dc.serialization = 'json';

      let spy = sinon.spy(dc, '_bufferedSend');

      dc.send(obj, false);
      assert(spy.calledOnce);
      assert(spy.calledWith(JSON.stringify(obj)));

      spy.reset();
    });

    it('should call _bufferedSend on data with non-regular types of serialization', () => {
      const message = 'foobar';

      const dc = new DataConnection({});
      dc.initialize({});
      dc._dc.onopen();
      dc.serialization = 'test';

      let spy = sinon.spy(dc, '_bufferedSend');

      dc.send(message, false);
      assert(spy.calledOnce);
      assert(spy.calledWith(message));

      spy.reset();
    });

    it('should send data as a Blob if serialization is binary', () => {
      util.supports = {binaryBlob: true};

      DataConnection = proxyquire(
        '../src/dataConnection',
        {'./connection': Connection,
         './util':       util}
      );
      const message = 'foobar';

      const dc = new DataConnection({});
      dc.initialize({});
      dc._dc.onopen();
      dc.serialization = 'binary';

      let spy = sinon.spy(dc, '_bufferedSend');

      dc.send(message, false);
      assert(spy.calledOnce);
      assert(spy.args[0][0] instanceof Blob);

      spy.reset();
    });

    it('should convert a Blob to an ArrayBuffer if Blobs are not supported', done => {
      util.supports = {binaryBlob: false};

      DataConnection = proxyquire(
        '../src/dataConnection',
        {'./connection': Connection,
         './util':       util}
      );
      const message = 'foobar';

      const dc = new DataConnection({});
      dc.initialize({});
      dc._dc.onopen();
      dc.serialization = 'binary';

      let spy = sinon.spy(dc, '_bufferedSend');

      dc.send(message, false);

      setTimeout(() => {
        assert(spy.calledOnce);
        assert(spy.args[0][0] instanceof ArrayBuffer);

        spy.reset();
        done();
      }, 100);
    });
  });
});
