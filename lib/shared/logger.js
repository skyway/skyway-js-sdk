'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _enum = require('enum');

var _enum2 = _interopRequireDefault(_enum);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LOG_PREFIX = 'SkyWay: ';
var LogLevel = new _enum2.default({
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  FULL: 3
});

/**
 * Class for logging
 * This class exports only one instance(a.k.a. Singleton)
 */

var Logger = function () {
  /**
   * Create a Logger instance.
   *
   */
  function Logger() {
    _classCallCheck(this, Logger);

    this._logLevel = LogLevel.NONE.value;
    this.LOG_LEVELS = LogLevel;
  }

  /**
   * Set the level of log.
   * @param {number} [level=0] The log level. 0: NONE, 1: ERROR, 2: WARN, 3:FULL.
   */


  _createClass(Logger, [{
    key: 'setLogLevel',
    value: function setLogLevel(level) {
      if (level.value) {
        level = level.value;
      }

      var debugLevel = parseInt(level, 10);

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

  }, {
    key: 'warn',
    value: function warn() {
      if (this._logLevel >= LogLevel.WARN.value) {
        var _console;

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        (_console = console).warn.apply(_console, [LOG_PREFIX].concat(args));
      }
    }

    /**
     * Output an error message to the Web Console.
     * @param {...*} args - arguments to error.
     */

  }, {
    key: 'error',
    value: function error() {
      if (this._logLevel >= LogLevel.ERROR.value) {
        var _console2;

        for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }

        (_console2 = console).error.apply(_console2, [LOG_PREFIX].concat(args));
      }
    }

    /**
     * Output a log message to the Web Console.
     * @param {...*} args - arguments to log.
     */

  }, {
    key: 'log',
    value: function log() {
      if (this._logLevel >= LogLevel.FULL.value) {
        var _console3;

        for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }

        (_console3 = console).log.apply(_console3, [LOG_PREFIX].concat(args));
      }
    }
  }]);

  return Logger;
}();

exports.default = new Logger();