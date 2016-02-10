'use strict';

const Peer      = require('../src/peer');
const assert    = require('power-assert');
const util      = require('../src/util');

describe.only('Peer', () => {
  describe('Constructor', () => {
    const apiKey = 'abcdefgh-1234-5678-jklm-zxcvasdfqwrt';
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
  });
});
