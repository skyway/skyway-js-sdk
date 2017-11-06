'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _sdpTransform = require('sdp-transform');

var _sdpTransform2 = _interopRequireDefault(_sdpTransform);

var _sdpInterop = require('sdp-interop');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Class that contains utility functions for SDP munging.
 */
var SdpUtil = function () {
  function SdpUtil() {
    _classCallCheck(this, SdpUtil);
  }

  _createClass(SdpUtil, [{
    key: 'unifiedToPlanB',

    /**
     * Convert unified plan SDP to Plan B SDP
     * @param {RTCSessionDescriptionInit} offer unified plan SDP
     * @return {RTCSessionDescription} Plan B SDP
     */
    value: function unifiedToPlanB(offer) {
      var interop = new _sdpInterop.Interop();
      var oldSdp = interop.toPlanB(offer).sdp;

      // use a set to avoid duplicates
      var msids = new Set();
      // extract msids from the offer sdp
      var msidRegexp = /a=ssrc:\d+ msid:(\w+)/g;
      var matches = void 0;
      // loop while matches is truthy
      // double parentheses for explicit conditional assignment (lint)
      while (matches = msidRegexp.exec(oldSdp)) {
        msids.add(matches[1]);
      }

      // replace msid-semantic line with planB version
      var newSdp = oldSdp.replace('a=msid-semantic:WMS *', 'a=msid-semantic:WMS ' + Array.from(msids).join(' '));

      return new RTCSessionDescription({
        type: 'offer',
        sdp: newSdp
      });
    }

    /**
     * Add b=AS to m=video section and return the SDP.
     * @param {string} sdp - A SDP.
     * @param {number} bandwidth - video Bandwidth (kbps)
     * @return {string} A SDP which include b=AS in m=video section
     */

  }, {
    key: 'addVideoBandwidth',
    value: function addVideoBandwidth(sdp, bandwidth) {
      this._validateBandwidth(bandwidth);
      return this._addBandwidth(sdp, bandwidth, 'video');
    }

    /**
     * Add b=AS to m=audio section and return the SDP
     * @param {string} sdp - A SDP.
     * @param {number} bandwidth - audio Bandwidth (kbps)
     * @return {string} A SDP which include b=AS in m=audio section
     */

  }, {
    key: 'addAudioBandwidth',
    value: function addAudioBandwidth(sdp, bandwidth) {
      this._validateBandwidth(bandwidth);
      return this._addBandwidth(sdp, bandwidth, 'audio');
    }

    /**
     * Remove video codecs in SDP except argument's codec.
     * If the codec doesn't exist, throw error.
     * @param {string} sdp - A SDP.
     * @param {string} codec - Video codec name (e.g. H264)
     * @return {string} A SDP which contains the codecs except argument's codec
     */

  }, {
    key: 'filterVideoCodec',
    value: function filterVideoCodec(sdp, codec) {
      return this._filterCodec(sdp, codec, 'video');
    }

    /**
     * Remove audio codecs in SDP except argument's codec.
     * If the codec doesn't exist, throw error.
     * @param {string} sdp - A SDP.
     * @param {string} codec - Audio codec name (e.g. PCMU)
     * @return {string} A SDP which contains the codecs except argument's codec
     */

  }, {
    key: 'filterAudioCodec',
    value: function filterAudioCodec(sdp, codec) {
      return this._filterCodec(sdp, codec, 'audio');
    }

    /**
     * Remove codecs except the codec passed as argument and return the SDP
     *
     * @param {string} sdp - A SDP.
     * @param {string} codec - The codec name, case sensitive.
     * @param {string} mediaType - 'audio' or 'video'
     * @return {string} A SDP which contains the codecs except argument's codec
     * @private
     */

  }, {
    key: '_filterCodec',
    value: function _filterCodec(sdp, codec, mediaType) {
      if (codec === undefined) {
        throw new Error('codec is not passed');
      }

      var sdpObject = _sdpTransform2.default.parse(sdp);

      sdpObject.media = sdpObject.media.map(function (media) {
        if (media.type === mediaType) {
          media.rtp = media.rtp.filter(function (rtp) {
            return rtp.codec === codec;
          });

          // Extract the payload number into Array, like [126, 97];
          // Note, there are cases the length of Array is more than 2.
          //   e.g. Firefox generates two 'H264' video codecs: 126, 97;
          //   e.g. Chrome generates three 'CN' audio codecs:  106, 105, 13;
          var payloadNumbers = media.rtp.reduce(function (prev, curr) {
            return [].concat(_toConsumableArray(prev), [curr.payload]);
          }, []);

          // At this point, 0 means there's no codec, so let's throw Error.
          if (media.rtp.length === 0) {
            throw new Error(codec + ' does not exist');
          }

          // fmtp is optional though most codecs have this parameter.
          if (media.fmtp) {
            media.fmtp = media.fmtp.filter(function (fmtp) {
              return payloadNumbers.includes(fmtp.payload);
            });
          }

          // rtcpFb is optional. Especially, m=audio doesn't have rtcpFb.
          if (media.rtcpFb) {
            media.rtcpFb = media.rtcpFb.filter(function (rtcpFb) {
              return payloadNumbers.includes(rtcpFb.payload);
            });
          }

          media.payloads = payloadNumbers.join(' ');
        }
        return media;
      });

      return _sdpTransform2.default.write(sdpObject);
    }

    /**
     * Add b=AS to 'm=audio' or 'm=video' section and return the SDP
     *
     * @param {string} sdp - A SDP.
     * @param {number} bandwidth - bandidth of 'audio' or 'video'
     * @param {string} mediaType - 'audio' or 'video'
     * @return {string} A SDP which include b=AS in m=audio or m=video section
     * @private
     */

  }, {
    key: '_addBandwidth',
    value: function _addBandwidth(sdp, bandwidth, mediaType) {
      var sdpObject = _sdpTransform2.default.parse(sdp);
      sdpObject.media = sdpObject.media.map(function (media) {
        if (media.type === mediaType) {
          media.bandwidth = [{
            // Chrome supports only 'AS'
            type: 'AS',
            limit: bandwidth.toString()
          }, {
            // Firefox Supports only 'TIAS' from M49
            type: 'TIAS',
            limit: (bandwidth * 1000).toString()
          }];
        }
        return media;
      });
      return _sdpTransform2.default.write(sdpObject);
    }

    /**
     * Check bandwidth is valid or not. If invalid, throw Error
     * @param {number} bandwidth - bandwidth of 'audio' or 'video'
     * @private
     */

  }, {
    key: '_validateBandwidth',
    value: function _validateBandwidth(bandwidth) {
      if (bandwidth === undefined) {
        throw new Error('bandwidth is not passed');
      }

      if (!/^\d+$/.test(bandwidth)) {
        throw new Error(bandwidth + ' is not a number');
      }
    }
  }]);

  return SdpUtil;
}();

exports.default = new SdpUtil();