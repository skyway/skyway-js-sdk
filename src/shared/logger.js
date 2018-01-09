import Enum from 'enum';

const LOG_PREFIX = 'SkyWay: ';
const LogLevel = new Enum({
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  FULL: 3,
});

/**
 * Class for logging
 * This class exports only one instance(a.k.a. Singleton)
 */
class Logger {
  /**
   * Create a Logger instance.
   *
   */
  constructor() {
    this._logLevel = LogLevel.NONE.value;
    this.LOG_LEVELS = LogLevel;
  }

  /**
   * Set the level of log.
   * @param {number} [level=0] The log level. 0: NONE, 1: ERROR, 2: WARN, 3:FULL.
   */
  setLogLevel(level) {
    if (level.value) {
      level = level.value;
    }

    const debugLevel = parseInt(level, 10);

    switch (debugLevel) {
      case 0:
        this._logLevel = LogLevel.NONE.value;
        break;
      case 1:
        this._logLevel = LogLevel.ERROR.value;
        break;
      case 2:
        this._logLevel = LogLevel.WARN.value;
        break;
      case 3:
        this._logLevel = LogLevel.FULL.value;
        break;
      default:
        this._logLevel = LogLevel.NONE.value;
        break;
    }
  }

  /**
   * Output a warning message to the Web Console.
   * @param {...*} args - arguments to warn.
   */
  warn(...args) {
    if (this._logLevel >= LogLevel.WARN.value) {
      console.warn(LOG_PREFIX, ...args);
    }
  }

  /**
   * Output an error message to the Web Console.
   * @param {...*} args - arguments to error.
   */
  error(...args) {
    if (this._logLevel >= LogLevel.ERROR.value) {
      console.error(LOG_PREFIX, ...args);
    }
  }

  /**
   * Output a log message to the Web Console.
   * @param {...*} args - arguments to log.
   */
  log(...args) {
    if (this._logLevel >= LogLevel.FULL.value) {
      console.log(LOG_PREFIX, ...args);
    }
  }
}

export default new Logger();
