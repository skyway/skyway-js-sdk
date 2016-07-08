'use strict';

const assert      = require('power-assert');
const proxyquire  = require('proxyquireify')(require);
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
        connected:  true,
        io:         {opts: {query: ''}}
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
      let peerId = 'peerId';
      const openMessage = {peerId: peerId};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(undefined, token);

      assert(stub.called);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);

      assert.equal(socket.disconnected, false);

      done();
    });

    it('should be able to connect to a server with a PeerID', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const openMessage = {peerId: peerId};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);

      assert(stub.called);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);

      assert.equal(socket.disconnected, false);
    });

    it('should close socket and have disconnect status set', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const openMessage = {peerId: peerId};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      assert.equal(socket.disconnected, true);

      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);
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
      const openMessage = {peerId: peerId};
      let data = {type: 'MSG', message: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);
      socket.send(data.type, data.message);
      assert(spy.calledWith(data.type, data.message));
      socket.close();
    });

    it('should not send data without a type set', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const openMessage = {peerId: peerId};
      let data = {message: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);
      socket.send(undefined, data.message);
      assert.deepEqual(spy.args[0], ['error', 'Invalid message']);

      socket.close();
    });

    it('should send queued messages upon connecting', () => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const openMessage = {peerId: peerId};
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
      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);
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
    let emitSpy;
    let peerId = 'peerId';
    let token = 'token';
    const openMessage = {peerId: peerId};

    beforeEach(() => {
      let apiKey = 'apiKey';
      socket = new Socket(false, 'localhost', serverPort, apiKey);
      emitSpy = sinon.spy(socket, 'emit');
    });

    afterEach(() => {
      emitSpy.restore();
    });

    it('should set _isOpen and emit peerId on _io \'OPEN\' messages', () => {
      socket.start(peerId, token);

      assert.equal(spy.callCount, 0);

      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);

      assert(socket._isOpen);
      assert.equal(emitSpy.callCount, 1);
      assert(emitSpy.calledWith(util.MESSAGE_TYPES.OPEN.key, openMessage));
    });

    it('should update the _io query on \'OPEN\' messages', () => {
      let peerId = 'peerId';
      const openMessage = {peerId: peerId};

      socket.start(undefined, token);

      const peerIdRegex = new RegExp(`&peerId=${peerId}`);

      let query = socket._io.io.opts.query;
      assert.equal(socket._isPeerIdSet, false);
      assert.equal(peerIdRegex.test(query), false);

      socket._io._fakeMessage[util.MESSAGE_TYPES.OPEN.key](openMessage);

      query = socket._io.io.opts.query;
      assert(socket._isPeerIdSet);
      assert(peerIdRegex.test(query));
    });

    it('should emit all non-OPEN message types on socket', () => {
      socket.start(peerId, token);

      assert.equal(emitSpy.callCount, 0);

      util.MESSAGE_TYPES.enums.forEach(type => {
        if (type.key === util.MESSAGE_TYPES.OPEN.key) {
          return;
        }

        const message = Symbol();
        socket._io._fakeMessage[type.key](message);

        assert(emitSpy.calledWith(type.key, message));
      });

      assert.equal(emitSpy.callCount, util.MESSAGE_TYPES.enums.length - 1);
    });
  });

  describe('SFURoom API', () => {
    describe('Join', () => {
      let emitSpy;
      let socket;
      let peerId = 'peerId';
      let token = 'token';

      beforeEach(() => {
        let apiKey = 'apiKey';

        socket = new Socket(false, 'localhost', serverPort, apiKey);
        emitSpy = sinon.spy(socket, 'emit');
      });

      afterEach(() => {
        emitSpy.restore();
      });

      it('should emit a message to the Peer upon a SFU_USER_JOIN acknowledgement', () => {
        const data = {roomName: 'testRoom'};

        socket.start(peerId, token);

        assert.equal(emitSpy.callCount, 0);

        socket._io._fakeMessage[util.MESSAGE_TYPES.SFU_USER_JOIN.key](data);

        assert(emitSpy.calledWith(util.MESSAGE_TYPES.SFU_USER_JOIN.key, data));
        assert.equal(emitSpy.callCount, 1);
      });
    });

    describe('Send', () => {
      let emitSpy;
      let socket;
      let peerId = 'peerId';
      let token = 'token';

      beforeEach(() => {
        let apiKey = 'apiKey';

        socket = new Socket(false, 'localhost', serverPort, apiKey);
        emitSpy = sinon.spy(socket, 'emit');
      });

      afterEach(() => {
        emitSpy.restore();
      });

      it('should emit a message to the Peer upon a SFU_DATA message', () => {
        const data = {roomName: 'testRoom', payload: 'foobar'};
        socket.start(peerId, token);

        assert.equal(emitSpy.callCount, 0);

        socket._io._fakeMessage[util.MESSAGE_TYPES.SFU_DATA.key](data);

        assert(emitSpy.calledWith(util.MESSAGE_TYPES.SFU_DATA.key, data));
      });
    });

    describe('Leave', () => {
      let socket;
      let emitSpy;
      let peerId = 'peerId';
      let token = 'token';

      beforeEach(() => {
        let apiKey = 'apiKey';

        socket = new Socket(false, 'localhost', serverPort, apiKey);
        emitSpy = sinon.spy(socket, 'emit');
      });

      afterEach(() => {
        emitSpy.restore();
      });

      it('should emit a message to the Peer upon a SFU_USER_LEAVE acknowledgement', () => {
        const data = {roomName: 'testRoom'};

        socket.start(peerId, token);

        assert.equal(emitSpy.callCount, 0);

        socket._io._fakeMessage[util.MESSAGE_TYPES.SFU_USER_LEAVE.key](data);

        assert(emitSpy.calledWith(util.MESSAGE_TYPES.SFU_USER_LEAVE.key, data));
        assert.equal(emitSpy.callCount, 1);
      });
    });
  });

  describe('MeshRoom API', () => {
    describe('Join', () => {
      let emitSpy;
      let socket;
      let peerId = 'peerId';
      let token = 'token';

      beforeEach(() => {
        let apiKey = 'apiKey';

        socket = new Socket(false, 'localhost', serverPort, apiKey);
        emitSpy = sinon.spy(socket, 'emit');
      });

      afterEach(() => {
        emitSpy.restore();
      });

      it('should emit a message to the Peer upon a MESH_USER_JOIN acknowledgement', () => {
        const data = {roomName: 'testRoom'};

        socket.start(peerId, token);

        assert.equal(emitSpy.callCount, 0);

        socket._io._fakeMessage[util.MESSAGE_TYPES.MESH_USER_JOIN.key](data);

        assert(emitSpy.calledWith(util.MESSAGE_TYPES.MESH_USER_JOIN.key, data));
        assert.equal(emitSpy.callCount, 1);
      });
    });

    describe('Send', () => {
      let emitSpy;
      let socket;
      let peerId = 'peerId';
      let token = 'token';

      beforeEach(() => {
        let apiKey = 'apiKey';

        socket = new Socket(false, 'localhost', serverPort, apiKey);
        emitSpy = sinon.spy(socket, 'emit');
      });

      afterEach(() => {
        emitSpy.restore();
      });

      it('should emit a message to the Peer upon a MESH_DATA message', () => {
        const data = {roomName: 'testRoom', payload: 'foobar'};
        socket.start(peerId, token);

        assert.equal(emitSpy.callCount, 0);

        socket._io._fakeMessage[util.MESSAGE_TYPES.MESH_DATA.key](data);

        assert(emitSpy.calledWith(util.MESSAGE_TYPES.MESH_DATA.key, data));
      });
    });
  });
});
