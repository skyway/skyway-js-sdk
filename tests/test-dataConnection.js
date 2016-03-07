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
  let cleanupSpy;
  let answerSpy;
  let candidateSpy;

  beforeEach(() => {
    // Negotiator stub and spies
    negotiatorStub = sinon.stub();
    startSpy = sinon.spy();
    cleanupSpy = sinon.spy();
    answerSpy = sinon.spy();
    candidateSpy = sinon.spy();

    negotiatorStub.returns({
      on: function(event, callback) {
        this[event] = callback;
      },
      emit: function(event, arg) {
        this[event](arg);
      },
      startConnection: startSpy,
      cleanup:         cleanupSpy,
      handleAnswer:    answerSpy,
      handleCandidate: candidateSpy
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
    cleanupSpy.reset();
    answerSpy.reset();
    candidateSpy.reset();
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const dc = new DataConnection({});

      assert(dc);
      assert(startSpy.calledOnce);
    });

    it('should store any messages passed in when created', () => {
      const dc = new DataConnection({_queuedMessages: ['message']});
      assert.deepEqual(dc.options._queuedMessages, ['message']);
    });
  });

  describe('Initialize', () => {
    it('should appropriately set and configure dc upon intialization', () => {
      const dcObj = {test: 'foobar'};

      const dc = new DataConnection({});
      dc._negotiator.emit('dcReady', dcObj);

      assert(dc._dc === dcObj);
      assert(dc._dc.onopen);
      assert(dc._dc.onmessage);
      assert(dc._dc.onclose);
    });

    it('should process any queued messages after PeerConnection object is created', () => {
      const messages = [{type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message'}];

      let spy = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer', spy);
      const dc = new DataConnection({_queuedMessages: messages});

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);

      spy.reset();
    });

    it('should correctly handle ALL of multiple queued messages', () => {
      const messages = [{type: util.MESSAGE_TYPES.ANSWER.name, payload: 'message1'},
                        {type: util.MESSAGE_TYPES.CANDIDATE.name, payload: 'message2'}];

      let spy1 = sinon.spy();
      let spy2 = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer', spy1);
      sinon.stub(DataConnection.prototype, 'handleCandidate', spy2);

      const dc = new DataConnection({_queuedMessages: messages});
      // dc._pcAvailable = true;

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy1.calledOnce, true);
      assert.equal(spy2.calledOnce, true);
    });

    it('should not process any invalid queued messages', () => {
      const messages = [{type: 'WRONG', payload: 'message'}];

      let spy1 = sinon.spy();
      let spy2 = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer', spy1);
      sinon.stub(DataConnection.prototype, 'handleCandidate', spy2);

      const dc = new DataConnection({_queuedMessages: messages});
      // dc._pcAvailable = true;

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);
    });

    it('should open the DataConnection and emit upon _dc.onopen()', () => {
      let spy;

      const dc = new DataConnection({});
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

      spy = sinon.spy(dc, '_handleDataMessage');

      dc._dc.onmessage(message);
      assert(spy.calledOnce);
      assert(spy.calledWith, message);

      spy.reset();
    });

    it('should close the DataConnection upon _dc.onclose()', () => {
      let spy;

      const dc = new DataConnection({});
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

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
      dc._negotiator.emit('dcReady', {});

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

      let chunks = util.chunk(blob);
      console.log('Blob size: ' + blob.size);
      console.log('Chunks: ' + chunks.length);

      const dc = new DataConnection({});
      dc._negotiator.emit('dcReady', {});

      dc.on('data', data => {
        // Receives the reconstructed blob after all chunks have been handled
        assert.deepEqual(data, blob);
        done();
      });

      for (let chunk of chunks) {
        let message = {data: chunk};
        dc._handleDataMessage(message);
      }
    });
  });

  describe('Cleanup', () => {
    it('should close the socket and call the negotiator to cleanup on close()', () => {
      const dc = new DataConnection({});

      // Force to be open
      dc.open = true;

      let spy = sinon.spy(dc, 'close');

      dc.close();
      assert(dc);
      assert(spy.calledOnce);
      assert.equal(dc.open, false);

      assert(cleanupSpy.called);
      assert(cleanupSpy.calledWith(dc));
    });
  });
});
