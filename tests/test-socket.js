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
    // server.on('connection', function() {
    //   console.log('Peer connected');
    // });
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
        // assert.equal(socket.socket.connected, false);
        assert.equal(socket.disconnected, true);
        done();
      });
    });

    it('should be able to send some data', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('connect', function() {
        socket.send('foobar');
        socket.close();
        done();
      });
    });
  });
});
