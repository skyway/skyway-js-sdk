'use strict';

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
  const keyLength = 16;
  // '36' means that we want to convert the number to a string using chars in
  // the range of '0-9a-z'. The concatenated 0's are for padding the key,
  // as Math.random() may produce a key shorter than 16 chars in length
  const randString = Math.random().toString(36) + '0000000000000000000';
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
  let size = buffers.reduce((sum, buffer) => {
    return sum + buffer.byteLength;
  }, 0);
  let tmpArray = new Uint8Array(size);
  let currPos = 0;
  for (let buffer of buffers) {
    tmpArray.set(new Uint8Array(buffer), currPos);
    currPos += buffer.byteLength;
  }
  return tmpArray.buffer;
}

/**
 * Convert Blob to ArrayBuffer.
 * @param {Blob} blob - The Blob to be read as ArrayBuffer.
 * @param {Function} cb - Callback function that called after load event fired.
 */
function blobToArrayBuffer(blob, cb) {
  let fr = new FileReader();
  fr.onload = event => {
    cb(event.target.result);
  };
  fr.readAsArrayBuffer(blob);
}

/**
 * Convert Blob to BinaryString.
 * @param {Blob} blob - The Blob to be read as BinaryString.
 * @param {Function} cb - Callback function that called after load event fired.
 */
function blobToBinaryString(blob, cb) {
  let fr = new FileReader();
  fr.onload = event => {
    cb(event.target.result);
  };
  fr.readAsBinaryString(blob);
}

/**
 * Convert Blob to text.
 * @param {Blob} blob - The Blob to be read as text.
 * @param {Function} cb - Callback function that called after load event fired.
 */
function blobToString(blob, cb) {
  let fr = new FileReader();
  fr.onload = event => {
    cb(event.target.result);
  };
  fr.readAsText(blob);
}

/**
 * Convert BinaryString to ArrayBuffer.
 * @param {BinaryString} binary - The BinaryString that is converted to ArrayBuffer.
 * @return {string} An ArrayBuffer.
 */
function binaryStringToArrayBuffer(binary) {
  let byteArray = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    byteArray[i] = binary.charCodeAt(i) & 0xff;
  }
  return byteArray.buffer;
}

/**
 * Whether the protocol is https or not.
 * @return {boolean} Whether the protocol is https or not.
 */
function isSecure() {
  return location.protocol === 'https:';
}

module.exports = {
  validateId,
  validateKey,
  randomId,
  randomToken,
  joinArrayBuffers,
  blobToBinaryString,
  blobToString,
  blobToArrayBuffer,
  binaryStringToArrayBuffer,
  isSecure,
};
