'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Validate the Peer ID format.
 * @param {string} [id] - A Peer ID.
 * @return {boolean} True if the peerId format is valid. False if not.
 */
function validateId(id) {
  // Allow empty ids
  return !id || /^[A-Za-z0-9_-]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
}

/**
 * Validate the API key.
 * @param {string} [key] A SkyWay API key.
 * @return {boolean} True if the API key format is valid. False if not.
 */
function validateKey(key) {
  // Allow empty keys
  return !key || /^[a-z0-9]{8}(-[a-z0-9]{4}){3}-[a-z0-9]{12}$/.exec(key);
}

/**
 * Return random ID.
 * @return {string} A text consisting of 16 chars.
 */
function randomId() {
  var keyLength = 16;
  // '36' means that we want to convert the number to a string using chars in
  // the range of '0-9a-z'. The concatenated 0's are for padding the key,
  // as Math.random() may produce a key shorter than 16 chars in length
  var randString = Math.random().toString(36) + '0000000000000000000';
  return randString.substr(2, keyLength);
}

/**
 * Generate random token.
 * @return {string} A token consisting of random alphabet and integer.
 */
function randomToken() {
  return Math.random().toString(36).substr(2);
}

/**
 * Combine the sliced ArrayBuffers.
 * @param {Array} buffers - An Array of ArrayBuffer.
 * @return {ArrayBuffer} The combined ArrayBuffer.
 */
function joinArrayBuffers(buffers) {
  var size = buffers.reduce(function (sum, buffer) {
    return sum + buffer.byteLength;
  }, 0);
  var tmpArray = new Uint8Array(size);
  var currPos = 0;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = buffers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var buffer = _step.value;

      tmpArray.set(new Uint8Array(buffer), currPos);
      currPos += buffer.byteLength;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return tmpArray.buffer;
}

/**
 * Convert Blob to ArrayBuffer.
 * @param {Blob} blob - The Blob to be read as ArrayBuffer.
 * @param {Function} cb - Callback function that called after load event fired.
 */
function blobToArrayBuffer(blob, cb) {
  var fr = new FileReader();
  fr.onload = function (event) {
    cb(event.target.result);
  };
  fr.readAsArrayBuffer(blob);
}

/**
 * Whether the protocol is https or not.
 * @return {boolean} Whether the protocol is https or not.
 */
function isSecure() {
  return location.protocol === 'https:';
}

/**
 * Detect browser.
 * @return {string} Browser name or empty string for not supported.
 */
function detectBrowser() {
  var ua = navigator.userAgent;

  switch (true) {
    case /Edge/.test(ua):
      return 'edge';
    case /Chrome/.test(ua):
      return 'chrome';
    case /Firefox/.test(ua):
      return 'firefox';
    case /Safari\//.test(ua):
      return 'safari';
    default:
      return '';
  }
}

exports.default = {
  validateId: validateId,
  validateKey: validateKey,
  randomId: randomId,
  randomToken: randomToken,
  joinArrayBuffers: joinArrayBuffers,
  blobToArrayBuffer: blobToArrayBuffer,
  isSecure: isSecure,
  detectBrowser: detectBrowser
};