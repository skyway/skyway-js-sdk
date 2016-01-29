'use strict';

require('rootpath')();

var Socket = require('src/socket');

var io;
var serverPort = 5080;

beforeEach(function() {
  io = require('socket.io').listen(serverPort);

  io.sockets.on('connection', function() {});
});

afterEach(function() {
  io.close();
});

describe('Connecting to the server', function() {
  it('should be able to connect to a server', function(done) {
    var socket = new Socket(false, 'localhost', serverPort, 'foobar');

    socket.start();
    socket.socket.on('connect', function() {
      done();
    });
  });
});
