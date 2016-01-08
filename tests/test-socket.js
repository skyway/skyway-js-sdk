'use strict';

var proxyquire  = require('proxyquire');
var mockSocket  = require('mock-socket');
var SocketIO    = mockSocket.SocketIO;
var Server      = mockSocket.Server;

var Socket = proxyquire('../src/socket', {'socket.io-client': SocketIO});

describe('Socket', function() {
  var serverPort = 5080;

  beforeEach(function() {
    this.server = new Server('http://localhost:' + serverPort);
    this.server.on('connection', function() {

    });
  });

  afterEach(function() {
    this.server.close();
  });

  describe('Connecting to the server', function() {
    it('should be able to connect to a server', function(done) {
      var socket = new Socket(false, 'localhost', serverPort, 'foobar');

      socket.connect();
      socket.socket.on('connect', function() {
        done();
      });
    });
  });
});
