'use strict';

const assert      = require('assert');
const proxyquire  = require('proxyquire');
const mockSocket  = require('mock-socket');
const SocketIO    = mockSocket.SocketIO;
const Server      = mockSocket.Server;

const Socket = proxyquire('../src/socket', {'socket.io-client': SocketIO});

describe('Socket', () => {
  const serverPort = 5080;
  let server;

  beforeEach(() => {
    server = new Server('http://localhost:' + serverPort);
  });

  afterEach(() => {
    server.close();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      let apiKey = 'apiKey';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });

      socket.start();
      socket.socket.on('connect', () => {
        socket.close();
        done();
      });
    });

    it('should be able to connect with a specific peerID', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        // How to get peerId?
        conn.emit('OPEN', 'foobar');
        console.log(conn);
        // console.log(conn.handshake.query.peerId);
      });

      socket.start(peerId, token);
      socket.socket.on('connect', () => {
        assert.equal(socket.id, peerId);
        socket.close();
        done();
      });
    });

    it('should close socket and have disconnect status set', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });

      socket.start(peerId, token);
      socket.socket.on('connect', () => {
        socket.close();
        assert.equal(socket.socket.readyState, 3);
        assert.equal(socket.disconnected, true);
        done();
      });
    });
  });

  describe('Sending data', () => {
    it('should be able to send some data', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {value: 'hello world', type: 'string'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });
      server.on('MSG', msg => {
        assert.equal(msg, JSON.stringify(data));
      });

      socket.start(peerId, token);
      socket.socket.on('connect', () => {
        socket.send(data);
        socket.close();
        done();
      });
    });

    it('should not send data without a type set', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {value: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        conn.emit('OPEN', 'foobar');
      });
      server.on('MSG', msg => {
        assert(msg, false, 'should not have received data');
      });
      server.on('ERR', msg => {
        assert.equal(msg, 'Invalid message');
      });

      socket.start(peerId, token);
      socket.socket.on('connect', () => {
        socket.send(data);
        socket.close();
        done();
      });
    });

    it('should send queued messages upon connecting', done => {
      let apiKey = 'apiKey';
      let peerId;
      let token = 'token';
      let data1 = {value: 'hello world', type: 'string'};
      let data2 = {value: 'goodbye world', type: 'string'};
      let receivedData;

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      server.on('connection', conn => {
        // Force peerID to be undefined
        conn.emit('OPEN', undefined);
      });

      server.on('MSG', msg => {
        receivedData = JSON.parse(msg);
      });

      socket.start(peerId, token);
      socket.socket.on('connect', () => {
        // First pass - No peerID
        socket.send(data1);
        assert.deepEqual(socket._queue, [data1]);
        assert.deepEqual(receivedData, undefined);
        // Second pass - peerID set, queued messages sent
        socket.id = 'peerId';
        socket._sendQueuedMessages();
        assert.deepEqual(socket._queue, []);
        assert.deepEqual(receivedData, data1);
        // Third pass - additional send() invocation
        socket.send(data2);
        assert.deepEqual(socket._queue, []);
        assert.deepEqual(receivedData, data2);

        socket.close();
        done();
      });
    });
  });
});
