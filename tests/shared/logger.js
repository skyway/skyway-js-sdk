import logger from '../../src/shared/logger';

import assert from 'power-assert';
import sinon from 'sinon';

describe('Logger', () => {
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
      currentLogLevel = logger._logLevel;
      logger.setLogLevel(currentLogLevel);
      stubError.restore();
      stubWarn.restore();
      stubLog.restore();
    });

    describe('log', () => {
      beforeEach(() => {
        const LOG_LEVEL_FULL = 3;
        logger.setLogLevel(LOG_LEVEL_FULL);
      });

      it('should log() once with a normal message', () => {
        logger.log('normal message');
        assert(stubLog.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubError.callCount === 0);
      });

      it('should log() once with empty argument', () => {
        logger.log();
        assert(stubLog.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubError.callCount === 0);
      });
    });

    describe('warn', () => {
      beforeEach(() => {
        const LOG_LEVEL_WARN = 2;
        logger.setLogLevel(LOG_LEVEL_WARN);
      });

      it('should warn() once with a normal message', () => {
        logger.warn('normal message');
        assert(stubLog.callCount === 0);
        assert(stubWarn.callCount === 1);
        assert(stubError.callCount === 0);
      });

      it('should warn() once with empty argument', () => {
        logger.warn();
        assert(stubLog.callCount === 0);
        assert(stubWarn.callCount === 1);
        assert(stubError.callCount === 0);
      });
    });

    describe('error', () => {
      beforeEach(() => {
        const LOG_LEVEL_ERROR = 1;
        logger.setLogLevel(LOG_LEVEL_ERROR);
      });

      it('should error() once with a normal message', () => {
        logger.error('normal message');
        assert(stubError.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubLog.callCount === 0);
      });

      it('should error() once with empty argument', () => {
        logger.error();
        assert(stubError.callCount === 1);
        assert(stubWarn.callCount === 0);
        assert(stubLog.callCount === 0);
      });
    });
  });
});
