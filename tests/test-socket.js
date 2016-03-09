'use strict';

const assert      = require('power-assert');
const proxyquire  = require('proxyquire');
const SocketIO    = require('socket.io-client');
const sinon       = require('sinon');

const util = require('../src/util');

describe('Socket', () => {
  const serverPort = 5080;
  let Socket;
  let stub;
  let spy;

  beforeEach(() => {
    stub = sinon.stub(SocketIO, 'Socket');
    spy = sinon.spy();

    stub.returns(
      {
        // socket.io is not standard eventEmitter API
        // fake messages by calling io._fakeMessage[messagetype](data)
        on: function(event, callback) {
          if (!this._fakeMessage) {
            this._fakeMessage = {};
          }
          this._fakeMessage[event] = callback;
        },
        emit:       spy,
        disconnect: spy,
        connected:  true
      }
    );
    Socket = proxyquire('../src/socket', {'socket.io-client': stub});
  });

  afterEach(() => {
    stub.restore();
    spy.reset();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      let apiKey = 'apiKey';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(undefined, token);

      assert(stub.called);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name]('peerId');

      assert.equal(socket.disconnected, false);

      done();
    });

    it('should be able to connect to a server with a PeerID', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);

      assert(stub.called);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name]('peerId');

      assert.equal(socket.disconnected, false);

      done();
    });

    it('should close socket and have disconnect status set', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      assert.equal(socket.disconnected, true);

      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name](peerId);
      assert.equal(socket.disconnected, false);

      socket.close();
      assert.equal(socket.disconnected, true);
    });
  });

  describe('Sending data', () => {
    it('should be able to send some data', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {type: 'MSG', message: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name](peerId);
      socket.send(data.type, data.message);
      assert(spy.calledWith(data.type, data.message));
      socket.close();
    });

    it('should not send data without a type set', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {message: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name](peerId);
      socket.send(undefined, data.message);
      assert.deepEqual(spy.args[0], ['error', 'Invalid message']);

      socket.close();
    });

    it('should send queued messages upon connecting', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data1 = {type: 'MSG', message: 'hello world'};
      let data2 = {type: 'MSG', message: 'goodbye world'};
      let receivedData;

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(undefined, token);
      assert.equal(socket.disconnected, true);

      // First pass - No peerID
      socket.send(data1.type, data1.message);
      assert.deepEqual(socket._queue, [data1]);
      assert.deepEqual(receivedData, undefined);

      // Second pass - peerID set, queued messages sent
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name](peerId);
      assert.deepEqual(socket._queue, []);
      assert.deepEqual(spy.args[0], ['MSG', data1.message]);

      // Third pass - additional send() invocation
      socket.send(data2.type, data2.message);
      assert.deepEqual(socket._queue, []);
      assert.deepEqual(spy.args[1], ['MSG', data2.message]);

      socket.close();
    });
  });

  describe('_setupMessageHandlers', () => {
    let socket;
    beforeEach(() => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      socket = new Socket(false, 'localhost', serverPort, apiKey);
      socket.start(peerId, token);
    });

    it('should set _isOpen and emit peerId on _io \'OPEN\' messages', () => {
      let peerId = 'peerId';

      const spy = sinon.spy(socket, 'emit');

      assert.equal(spy.callCount, 0);

      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.name](peerId);

      assert(socket._isOpen);
      assert.equal(spy.callCount, 1);
      assert(spy.calledWith(util.MESSAGE_TYPES.OPEN.name, peerId));
    });

    it('should emit all non-OPEN message types on socket', () => {
      const spy = sinon.spy(socket, 'emit');

      assert.equal(spy.callCount, 0);

      for (let type of util.MESSAGE_TYPES.enumValues) {
        if (type.name === util.MESSAGE_TYPES.OPEN.name) {
          return;
        }

        const message = Symbol();
        socket._io._fakeMessage[type.name](message);

        assert(spy.calledWith(type.name, message));
      }

      assert.equal(spy.callCount, util.MESSAGE_TYPES.enumValues.length - 1);
    });
  });
});
