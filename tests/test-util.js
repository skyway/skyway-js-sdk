'use strict';

const assert    = require('power-assert');
const sinon     = require('sinon');
const util      = require('../src/util');

describe('Util', () => {
  before(() => {
    util.debug = true;
  });

  describe('validateId', () => {
    it('should be valid when valid id is given', () => {
      const validIds = [
        'ABCD 0123',
        'ABCD_0123',
        'ABCD-0123-abcd-7890',
        'ABCD-0123------------abcd-7890'
      ];
      validIds.forEach(id => {
        assert(util.validateId(id));
      });
    });

    it('should be invalid when invalid id is given', () => {
      const invalidIds = [
        'あいうえお',
        '!@#$%^&&*()',
        'ABCD  0000 ',
        '><script>alert(1);</script>'
      ];
      invalidIds.forEach(id => {
        assert(util.validateId(id) === null);
      });
    });
  });

  describe('validateKey', () => {
    it('should be valid when valid key is given', () => {
      const validKeys = [
        '00000000-0000-0000-0000-000000000000',
        'abcdefgh-1234-5678-jklm-zxcvasdfqwrt'
      ];
      validKeys.forEach(key => {
        assert(util.validateKey(key));
      });
    });

    it('should be invalid when invalid key is given', () => {
      const validKeys = [
        '0-0-0-0',
        'あいうえお',
        '><script>alert(1);</script>',
        '00000000-0000-0000-0000-0000000000001'
      ];
      validKeys.forEach(key => {
        assert(util.validateKey(key) === null);
      });
    });
  });

  describe('randomToken', () => {
    it('should only contain alphanumeric characters', () => {
      assert(/^[a-zA-Z0-9]+$/.exec(util.randomToken()));
    });

    it('should produce distinct outputs when run multiple times', () => {
      // There's a very small possibility that this test will fail because randomID could produce the same number twice
      assert.notEqual(util.randomToken(), util.randomToken());
    });
  });

  describe('Log Related methods', () => {
    let stubError;
    let stubWarn;
    let stubLog;
    let currentLogLevel;

    beforeEach(() => {
      currentLogLevel = util._logLevel;

      const LOG_LEVEL_FULL = 3;
      util.setLogLevel(LOG_LEVEL_FULL);

      stubError = sinon.stub(console, 'error');
      stubWarn = sinon.stub(console, 'warn');
      stubLog = sinon.stub(console, 'log');
    });

    afterEach(() => {
      currentLogLevel = util._logLevel;
      util.setLogLevel(currentLogLevel);
      stubError.restore();
      stubWarn.restore();
      stubLog.restore();
    });

    describe('log', () => {
      beforeEach(() => {
        const LOG_LEVEL_FULL = 3;
        util.setLogLevel(LOG_LEVEL_FULL);
      });

      it('should log() once with a normal message', () => {
        util.log('normal message');
        assert(stubLog.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubError.callCount === 0);
      });

      it('should log() once with empty argument', () => {
        util.log();
        assert(stubLog.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubError.callCount === 0);
      });
    });

    describe('warn', () => {
      beforeEach(() => {
        const LOG_LEVEL_WARN = 2;
        util.setLogLevel(LOG_LEVEL_WARN);
      });

      it('should warn() once with a normal message', () => {
        util.warn('normal message');
        assert(stubLog.callCount === 0);
        assert(stubWarn.callCount === 1);
        assert(stubError.callCount === 0);
      });

      it('should warn() once with empty argument', () => {
        util.warn();
        assert(stubLog.callCount === 0);
        assert(stubWarn.callCount === 1);
        assert(stubError.callCount === 0);
      });
    });

    describe('error', () => {
      beforeEach(() => {
        const LOG_LEVEL_ERROR = 1;
        util.setLogLevel(LOG_LEVEL_ERROR);
      });

      it('should error() once with a normal message', () => {
        util.error('normal message');
        assert(stubError.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubLog.callCount === 0);
      });

      it('should error() once with empty argument', () => {
        util.error();
        assert(stubError.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubLog.callCount === 0);
      });
    });
  });

  describe('Message type conversion', () => {
    it('should correctly convert a Binary String to an ArrayBuffer', () => {
      // Convert to binary String
      const binary = 'foobar'.toString(2);
      const arrayBuffer = util.binaryStringToArrayBuffer(binary);
      assert.equal(arrayBuffer.constructor, ArrayBuffer);

      const result = String.fromCharCode.apply(null, Array.prototype.slice.apply(new Uint8Array(arrayBuffer)));
      assert.equal(result, binary);
    });

    it('should correctly convert a Blob to an ArrayBuffer', done => {
      const string = 'foobar';

      let arrayBuffer = new ArrayBuffer(string.length);
      let bufferView = new Uint8Array(arrayBuffer);
      for (let i = 0; i < string.length; i++) {
        bufferView[i] = string.charCodeAt(i);
      }
      const blob = new Blob([arrayBuffer], {type: 'text/plain'});

      util.blobToArrayBuffer(blob, result => {
        assert.deepEqual(result.constructor, ArrayBuffer);
        assert.deepEqual(arrayBuffer, result);
        done();
      });
    });

    it('should correctly convert a Blob to a Binary String', done => {
      const string = 'foobar';

      let arrayBuffer = new ArrayBuffer(string.length);
      let bufferView = new Uint8Array(arrayBuffer);
      for (let i = 0; i < string.length; i++) {
        bufferView[i] = string.charCodeAt(i);
      }
      const blob = new Blob([arrayBuffer], {type: 'text/plain'});

      util.blobToBinaryString(blob, result => {
        assert.deepEqual(typeof result, 'string');
        assert.equal(result, string);
        done();
      });
    });

    it('should correctly chunk a Blob', () => {
      // Chunk size is 16300
      // Each char is 2 bytes
      const chunkSize = util.chunkedMTU;
      const multiple = 3;
      const len = chunkSize * multiple;

      const string = new Array(len + 1).join('e');
      const arrayBuffer = util.pack(string);
      const blob = new Blob([arrayBuffer], {type: 'text/plain'});

      const chunked = util.chunk(blob);

      console.log('Blob size: ' + blob.size);
      console.log('Chunks: ' + chunked.length);

      // There are 3 overhead bytes, so actual size is actually 16300*X + 3
      assert.equal(chunked.length, multiple + 1);

      // __peerData increments with each chunking operation
      // Since a DataConnection test has already chunked once, this will now be 2 for each of our chunks
      // (Just checking all chunks have the same value since checking == 2 could break later)
      //
      // (__peerData is a terrible name for this - can we change it?)
      const timesChunked = chunked[0].__peerData;

      for (let i = 0; i < chunked.length; i++) {
        assert.equal(chunked[i].__peerData, timesChunked);
        assert.equal(chunked[i].n, i);
        assert.equal(chunked[i].total, chunked.length);
      }

      const reconstructed = new Blob(chunked);
      assert.deepEqual(reconstructed, blob);
    });
  });

  // FIXME: Lint error since location is not defined explicitly
  describe('isSecure', () => {
    // Test only 'HTTP' becauuse Karma only runs on 'HTTP'
    it('should return false if HTTP', () => {
      assert(util.isSecure(location.protocol) === false);
    });
  });
});
