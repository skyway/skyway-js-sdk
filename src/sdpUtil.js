'use strict';

const sdpTransform = require('sdp-transform');

/**
 * Class that contains utility functions for SDP munging.
 */
class SdpUtil {

  /**
   * Add b=AS to m=video section and return the SDP.
   * @param {string} sdp - A SDP.
   * @param {number} bandwidth - video Bandwidth (kbps)
   * @return {string} A SDP which include b=AS in m=video section
   */
  addVideoBandwidth(sdp, bandwidth) {
    this._validateBandwidth(bandwidth);
    return this._addBandwidth(sdp, bandwidth, 'video');
  }

  /**
   * Add b=AS to m=audio section and return the SDP
   * @param {string} sdp - A SDP.
   * @param {number} bandwidth - audio Bandwidth (kbps)
   * @return {string} A SDP which include b=AS in m=audio section
   */
  addAudioBandwidth(sdp, bandwidth) {
    this._validateBandwidth(bandwidth);
    return this._addBandwidth(sdp, bandwidth, 'audio');
  }

  /**
   * Add b=AS to 'm=audio' or 'm=video' section and return the SDP
   * @param {string} sdp - A SDP.
   * @param {number} bandwidth - bandidth of 'audio' or 'video'
   * @param {string }mediaType - 'audio' or 'video'
   * @return {string} A SDP which include b=AS in m=audio or m=video section
   * @private
   */
  _addBandwidth(sdp, bandwidth, mediaType) {
    const sdpObject = sdpTransform.parse(sdp);
    sdpObject.media = sdpObject.media.map(media => {
      if (media.type === mediaType) {
        media.bandwidth = [{
          // Chrome supports only 'AS'
          type:  'AS',
          limit: bandwidth.toString()
        }, {
          // Firefox Supports only 'TIAS' from M49
          type:  'TIAS',
          limit: (bandwidth * 1000).toString()
        }];
      }
      return media;
    });
    return sdpTransform.write(sdpObject);
  }

  /**
   * Check bandwidth is valid or not. If invalid, throw Error
   * @param {number} bandwidth - bandidth of 'audio' or 'video'
   * @private
   */
  _validateBandwidth(bandwidth) {
    if (bandwidth === undefined) {
      throw new Error('bandwidth is not passed');
    }

    if (!(/^\d+$/.test(bandwidth))) {
      throw new Error(`${bandwidth} is not a number`);
    }
  }
}

const sdpUtilInstance = new SdpUtil();
module.exports = sdpUtilInstance;
