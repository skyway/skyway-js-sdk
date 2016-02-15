'use strict';

const Peer      = require('../src/peer');
const Socket    = require('../src/socket');
const assert    = require('power-assert');
const util      = require('../src/util');
const sinon     = require('sinon');

describe('Peer', () => {
  const apiKey = 'abcdefgh-1234-5678-jklm-zxcvasdfqwrt';

  describe('Constructor', () => {
    it('should create a Peer object', () => {
      const peer = new Peer({
        key: apiKey
      });
      assert(peer);
      assert(peer instanceof Peer);
    });

    it('should create a Peer object with default options', () => {
      const peer = new Peer({
        key: apiKey
      });
      assert(peer.options.debug === util.LOG_LEVELS.NONE);
      assert(peer.options.host === util.CLOUD_HOST);
      assert(peer.options.port === util.CLOUD_PORT);
      assert(peer.options.token);
      assert(typeof peer.options.token === 'string');
      assert(peer.options.config === util.defaultConfig);
      assert(peer.options.turn === true);
    });

    it('should create a Peer object with options overwritten', () => {
      const config = {iceServers: []};
      const peer = new Peer({
        key:    apiKey,
        debug:  util.LOG_LEVELS.FULL,
        config: config
      });
      // Overwritten
      assert(peer.options.key === apiKey);
      assert(peer.options.debug === util.LOG_LEVELS.FULL);
      assert(peer.options.config === config);

      // Default unchanged
      assert(peer.options.host === util.CLOUD_HOST);
      assert(peer.options.port === util.CLOUD_PORT);
      assert(peer.options.token);
      assert(typeof peer.options.token === 'string');
      assert(peer.options.turn === true);
    });

    // TODO: Implement after initializeServerConnection
    // it('should create a Peer object with ID', () => {
    //   const peer = new Peer('myID', {
    //     key: apiKey
    //   });
    //   assert(peer);
    //   assert(peer instanceof Peer);
    // });

    it('should not create a Peer object with invalid ID', done => {
      let peer;
      try {
        peer = new Peer('間違ったIDです', {
          key: apiKey
        });
      } catch (e) {
        assert(peer === undefined);
        done();
      }
    });

    it('should not create a Peer object with invalid API key', done => {
      let peer;
      try {
        peer = new Peer({
          key: 'wrong'
        });
      } catch (e) {
        assert(peer === undefined);
        done();
      }
    });

    it('should contain a Socket object', () => {
      const peer = new Peer({
        key: apiKey
      });

      assert(peer.socket);
      assert(peer.socket instanceof Socket);
    });

    it('should call _handleMessage on a socket "message" event', () => {
      const peer = new Peer({
        key: apiKey
      });

      const testMsg = 'test message';
      const spy = sinon.spy(peer, '_handleMessage');

      peer.socket.emit('message', testMsg);

      assert(spy.calledOnce === true);
      assert(spy.calledWith(testMsg) === true);
      spy.restore();
    });

    it('should abort on a socket "error"', done => {
      const peer = new Peer({
        key: apiKey
      });

      const errMsg = 'test error';

      peer.on('error', err => {
        assert(err.type === 'socket-error');
        assert(err.message === errMsg);
        done();
      });

      peer.socket.emit('error', errMsg);
    });

    it('should abort and disconnect on a socket "disconnect" event', done => {
      const peer = new Peer({
        key: apiKey
      });

      peer.on('error', err => {
        assert(err.type === 'socket-error');
        assert(err.message === 'Lost connection to server.');

        assert(peer._disconnectCalled === true);
        done();
      });

      peer.socket.emit('disconnect');
    });

    it('should call destroy onbeforeunload', () => {
      const peer = new Peer({
        key: apiKey
      });

      window.onbeforeunload();
      assert(peer._destroyCalled === true);
    });
  });

  describe('ListAllPeers', () => {
    let peer;
    let requests = [];
    let xhr;
    beforeEach(() => {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function(request) {
        requests.push(request);
      };

      peer = new Peer({
        key: apiKey
      });
    });

    afterEach(() => {
      xhr.restore();
      requests = [];

      peer.destroy();
    });

    it('should send a "GET" request to the right URL', () => {
      peer.listAllPeers();
      assert(requests.length === 1);

      var protocol = peer.options.secure ? 'https://' : 'http://';
      const url = `${protocol}${peer.options.host}:` +
        `${peer.options.port}/active/list/${apiKey}`;
      assert(requests[0].url = url);
      assert(requests[0].method = 'GET');
    });

    it('should call the callback with the response as the argument', () => {
      const spy = sinon.spy();
      peer.listAllPeers(spy);
      assert(requests.length === 1);

      const peerList = ['peerId1', 'peerId2', 'peerId3'];
      requests[0].respond(200, {}, JSON.stringify(peerList));

      assert(spy.calledOnce === true);
      assert(spy.calledWith(peerList) === true);
    });

    it('should throw an error when the status is 401', () => {
      try {
        peer.listAllPeers();
        requests.respond(401);
      } catch (e) {
        assert(e instanceof Error);
        return;
      }

      assert.fail('Didn\'t throw an error');
    });

    it('should call the callback with an empty array any other status', () => {
      const spy = sinon.spy();
      const peerList = JSON.stringify(['peerId1', 'peerId2', 'peerId3']);
      const responseCodes = [202, 400, 403, 404, 408, 500, 503];

      for (let codeIndex = 0; codeIndex <= responseCodes.length; codeIndex++) {
        peer.listAllPeers(spy);
        requests[codeIndex].respond(responseCodes[codeIndex], {}, peerList);
      }

      assert(spy.withArgs([]).callCount === responseCodes.length);
    });
  });
});
