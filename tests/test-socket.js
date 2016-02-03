'use strict';

const proxyquire  = require('proxyquire');
const mockSocket  = require('mock-socket');
const SocketIO    = mockSocket.SocketIO;
const Server      = mockSocket.Server;

const Socket = proxyquire('../src/socket', {'socket.io-client': SocketIO});

describe('Socket', () => {
  const serverPort = 5080;
  let server = new Server('http://localhost:' + serverPort);

  beforeEach(() => {
    server.on('connection', function() {

    });
  });

  afterEach(() => {
    server.close();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      const socket = new Socket(false, 'localhost', serverPort, 'foobar');

      socket.connect();
      socket.socket.on('connect', () => {
        done();
      });
    });
  });
});
