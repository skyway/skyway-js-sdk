'use strict';

const util         = require('../src/util');

const assert       = require('power-assert');
const sinon        = require('sinon');
const EventEmitter = require('events');
const Enum         = require('enum');

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
      // There's a very small possibility that this test will
      // fail because randomID could produce the same number twice
      assert.notEqual(util.randomToken(), util.randomToken());
    });
  });

  describe('Log Related methods', () => {
    let stubError;
    let stubWarn;
    let stubLog;
    let currentLogLevel;

    beforeEach(() => {
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

      const result = String.fromCharCode.apply(
        null, Array.prototype.slice.apply(new Uint8Array(arrayBuffer)));
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
  });

  describe('isSecure', () => {
    // Test only 'HTTP' becauuse Karma only runs on 'HTTP'
    it('should return false if HTTP', () => {
      assert(util.isSecure(location.protocol) === false);
    });
  });

  describe('getSignalingServer', () => {
    let requests = [];
    let xhr;
    const fakeDomain = 'fake.domain';
    beforeEach(() => {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = request => {
        requests.push(request);
      };
    });

    afterEach(() => {
      xhr.restore();
      requests = [];
    });

    it('should send a "GET" request to the dispatcher URL', done => {
      const result = {domain: fakeDomain};

      util.getSignalingServer().then(res => {
        assert.equal(requests.length, 1);
        const url = `https://${util.DISPATCHER_HOST}:` +
          `${util.DISPATCHER_PORT}/signaling`;
        assert(requests[0].url === url);
        assert(requests[0].method === 'GET');
        done();
      }).catch(err => {
        assert.fail('Failed to get signaling server options from dispatcher.', err);
        done();
      });

      requests[0].respond(200, {}, JSON.stringify(result));
    });

    describe('when response from dispatcher is including server domain', () => {
      it('should call callback with object including host', done => {
        const result = {domain: fakeDomain};

        util.getSignalingServer().then(res => {
          assert.deepEqual(res, {host: fakeDomain, port: 443, secure: true});
          done();
        }).catch(err => {
          assert(err);
          done();
        });

        requests[0].respond(200, {}, JSON.stringify(result));
      });
    });

    describe('when response from dispatcher is empty', () => {
      it('should reject', done => {
        const result = {};

        util.getSignalingServer().then(() => {
          assert.fail('This should be rejected.');
          done();
        }).catch(err => {
          assert(err);
          done();
        });

        requests[0].respond(200, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 500', () => {
      it('should reject', done => {
        const result = {error: {
          code:    500,
          message: 'There was a problem with the server. Please wait a while and try again.'
        }};

        util.getSignalingServer().then(res => {
          assert.fail('This should be rejected.');
          done();
        }).catch(err => {
          assert(err);
          assert.equal(err.message, 'There was a problem with the server. Please wait a while and try again.');
          done();
        });

        requests[0].respond(500, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 404', () => {
      it('should reject', done => {
        const result = {error: {code: 404, message: 'Not Found.'}};

        util.getSignalingServer().then(res => {
          assert.fail('This should be rejected.');
          done();
        }).catch(err => {
          assert(err);
          assert.equal(err.message, 'Not Found.');
          done();
        });

        requests[0].respond(404, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 405', () => {
      it('should reject', done => {
        const result = {error: {code: 405, message: 'Method Not Allowed.'}};

        util.getSignalingServer().then(res => {
          assert.fail('This should be rejected.');
          done();
        }).catch(err => {
          assert(err);
          assert.equal(err.message, 'Method Not Allowed.');
          done();
        });

        requests[0].respond(405, {}, JSON.stringify(result));
      });
    });
  });

  describe('emitError', () => {
    const errorMessage = 'Error message';
    const errorType = 'error-type';
    let errorStub;
    let emitter;

    class DummyEmitter extends EventEmitter {
      static get EVENTS() {
        return new Enum(['error']);
      }
    }

    beforeEach(() => {
      emitter = new DummyEmitter();

      errorStub = sinon.stub(util, 'error');
    });

    afterEach(() => {
      errorStub.restore();
    });

    describe('when error is an Error object', () => {
      let error;
      beforeEach(() => {
        error = new Error(errorMessage);
      });

      it('should log the error', () => {
        sinon.stub(emitter, 'emit');
        util.emitError.call(emitter, errorType, error);

        assert.equal(errorStub.callCount, 1);
        assert(errorStub.calledWith(error));
      });

      it('should log and not throw an error when not called using call', () => {
        util.emitError(errorType, error);

        assert.equal(errorStub.callCount, 1);
        assert(errorStub.calledWith(error));
      });

      it('should emit the error in an \'error\' event', done => {
        emitter.on(DummyEmitter.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.message, errorMessage);
          assert.equal(err.type, errorType);
          done();
        });

        util.emitError.call(emitter, errorType, error);
      });
    });

    describe('when error is an string', () => {
      it('should log the error', () => {
        sinon.stub(emitter, 'emit');
        util.emitError.call(emitter, errorType, errorMessage);

        assert.equal(errorStub.callCount, 1);
        assert(errorStub.calledWithMatch({type: errorType, message: errorMessage}));
      });

      it('should log and not throw an error when not called using call', () => {
        util.emitError(errorType, errorMessage);

        assert.equal(errorStub.callCount, 1);
        assert(errorStub.calledWithMatch({type: errorType, message: errorMessage}));
      });

      it('should emit the error in an \'error\' event', done => {
        emitter.on(DummyEmitter.EVENTS.error.key, err => {
          assert(err instanceof Error);
          assert.equal(err.message, errorMessage);
          assert.equal(err.type, errorType);
          done();
        });

        util.emitError.call(emitter, errorType, errorMessage);
      });
    });
  });
});
