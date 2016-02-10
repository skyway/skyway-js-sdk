'use strict';

const util      = require('../src/util');
const assert    = require('power-assert');
const sinon     = require('sinon');

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
  // FIXME: Lint error since location is not defined explicitly
  describe('isSecure', () => {
    // Test only 'HTTP' becauuse Karma only runs on 'HTTP'
    it('should return false if HTTP', () => {
      assert(util.isSecure(location.protocol) === false);
    });
  });
});
