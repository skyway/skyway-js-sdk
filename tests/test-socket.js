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
    server.on('connection', conn => {
      // How to get peerId?
      conn.emit('OPEN', 'foobar');
      // Hmm.
      conn.connected = true;
    });
    server.on('msg', data => {
      console.log('MSG: ' + data);
      server.receivedData = data;
    });
  });

  afterEach(() => {
    server.close();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      let apiKey = 'apiKey';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start();
      socket.socket.on('connect', function() {
        socket.close();
        done();
      });
    });

    it('should be able to connect with a specific peerID', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        assert.equal(socket.id, peerId);
        socket.close();
        done();
      });
    });

    it('should close socket and properly set disconnect status', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.close();
        assert.equal(socket.socket.readyState, 3);
        assert.equal(socket.disconnected, true);
        done();
      });
    });

    it('should be able to send some data', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let msg = 'hello world';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.send(msg);
        assert.equal(server.receivedData, JSON.stringify(msg));
        socket.close();
        done();
      });
    });
  });
});
