'use strict';

const assert      = require('assert');
const proxyquire  = require('proxyquire');
// const mockSocket  = require('mock-socket');
const SocketIO    = require('socket.io-client');
// const Server      = require('socket.io');

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

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
        on:  function(event, callback) {
               this[event]=callback
             },
        emit: spy,
        disconnect: spy,
        connected: true
      }
    );
    Socket = proxyquire('../src/socket', {'socket.io-client':stub});
  });

  afterEach(() => {
    stub.restore();
  });

  describe('Connecting to the server', () => {
    it('should be able to connect to a server', done => {
      let apiKey = 'apiKey';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start();

      //console.log(stub);
      assert(stub.called);
      socket.socket.OPEN('peerId');
      // socket.socket.on('connect', () => {
      //   socket.close();
      // });
      // :expect(server.on).to.have.been.calledOnce;
      
      stub.restore();
      done();
    });

    it('should be able to connect with a specific peerID', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('OPEN', () => {
        assert.equal(socket.id, peerId);
        socket.close();
        done();
      });
    });

    it.only('should close socket and have disconnect status set', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      assert.equal(socket.disconnected, true);

      socket.socket.OPEN(peerId);
      assert.equal(socket.disconnected, false);

      socket.close();
      assert.equal(socket.disconnected, true);

      done();

      // socket.socket.on('OPEN', () => {
      //   socket.close();
      //   assert.equal(socket.socket.disconnected, true);
      //   assert.equal(socket.disconnected, true);
      //   done();
      // });
    });
  });

  describe('Sending data', () => {
    it('should be able to send some data', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {value: 'hello world', type: 'string'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.OPEN(peerId);
      socket.send(data);
      assert(spy.calledWith('MSG', JSON.stringify(data)));
      done();
    });

    it('should not send data without a type set', done => {
      let apiKey = 'apiKey';
      let peerId = 'peerId';
      let token = 'token';
      let data = {value: 'hello world'};

      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.OPEN(peerId);
      socket.send(data);
      assert.deepEqual(spy.args[0], ['ERR', 'Invalid message']);
      done();
    });

    it('should send queued messages upon connecting', done => {
      let apiKey = 'apiKey';
      let peerId;
      let token = 'token';
      let data1 = {value: 'hello world', type: 'string'};
      let data2 = {value: 'goodbye world', type: 'string'};
      let receivedData;
      console.log('starting');
      const socket = new Socket(false, 'localhost', serverPort, apiKey);

      socket.start(peerId, token);
      socket.socket.on('OPEN', () => {
        assert.equal(socket.id, undefined);
        // First pass - No peerID
        socket.send(data1);
        assert.deepEqual(socket._queue, [data1]);
        assert.deepEqual(receivedData, undefined);
        // Second pass - peerID set, queued messages sent
        socket.id = 'peerId';
        socket._sendQueuedMessages();
      });

      server.on('MSG', msg => {
        console.log('Message received!');
        receivedData = JSON.parse(msg);
        assert.deepEqual(socket._queue, []);
        assert.equal(receivedData, data1);
        // Third pass - additional send() invocation
        socket.send(data2);
        assert.deepEqual(socket._queue, []);
        assert.deepEqual(receivedData, data2);
        console.log('ending');
        socket.close();
        done();
      });
    });
  });
});
