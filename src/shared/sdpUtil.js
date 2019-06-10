import sdpTransform from 'sdp-transform';
import { Interop } from 'sdp-interop';

/**
 * Class that contains utility functions for SDP munging.
 */
class SdpUtil {
  /**
   * Convert unified plan SDP to Plan B SDP
   * @param {RTCSessionDescriptionInit} offer unified plan SDP
   * @return {RTCSessionDescription} Plan B SDP
   */
  unifiedToPlanB(offer) {
    const interop = new Interop();
    const oldSdp = interop.toPlanB(offer).sdp;

    // use a set to avoid duplicates
    const msids = new Set();
    // extract msids from the offer sdp
    const msidRegexp = /a=ssrc:\d+ msid:(\w+)/g;
    let matches;
    // loop while matches is truthy
    // double parentheses for explicit conditional assignment (lint)
    while ((matches = msidRegexp.exec(oldSdp))) {
      msids.add(matches[1]);
    }

    // replace msid-semantic line with planB version
    const newSdp = oldSdp.replace(
      'a=msid-semantic:WMS *',
      `a=msid-semantic:WMS ${Array.from(msids).join(' ')}`
    );

    return new RTCSessionDescription({
      type: 'offer',
      sdp: newSdp,
    });
  }

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
   * Remove video codecs in SDP except argument's codec.
   * If the codec doesn't exist, throw error.
   * @param {string} sdp - A SDP.
   * @param {string} codec - Video codec name (e.g. H264)
   * @return {string} A SDP which contains the codecs except argument's codec
   */
  filterVideoCodec(sdp, codec) {
    return this._filterCodec(sdp, codec, 'video');
  }

  /**
   * Remove audio codecs in SDP except argument's codec.
   * If the codec doesn't exist, throw error.
   * @param {string} sdp - A SDP.
   * @param {string} codec - Audio codec name (e.g. PCMU)
   * @return {string} A SDP which contains the codecs except argument's codec
   */
  filterAudioCodec(sdp, codec) {
    return this._filterCodec(sdp, codec, 'audio');
  }

  /**
   * Our signaling server determines client's SDP semantics
   * by checking answer SDP includes `a=msid-semantic:WMS *` or NOT.
   *
   * Currenly, Firefox prints exact string,
   * but Chrome does not. even using `unified-plan`.
   * Therefore Chrome needs to pretend Firefox to join SFU rooms.
   *
   * At a glance, using `sdp-transform` is better choice to munge SDP,
   * but if you do so, it prints `a=msid-semantic: WMS *`.
   * The problem is the space before the word `WMS`,
   * our signaling server can not handle this as `unified-plan` SDP...
   *
   * @param {string} sdp - A SDP.
   * @return {string} A SDP which has `a=msid-semantic:WMS *`.
   */
  ensureUnifiedPlan(sdp) {
    const delimiter = '\r\n';
    return sdp
      .split(delimiter)
      .map(line => {
        return line.startsWith('a=msid-semantic')
          ? 'a=msid-semantic:WMS *'
          : line;
      })
      .join(delimiter);
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
  _filterCodec(sdp, codec, mediaType) {
    if (codec === undefined) {
      throw new Error('codec is not passed');
    }

    const sdpObject = sdpTransform.parse(sdp);

    sdpObject.media = sdpObject.media.map(media => {
      if (media.type === mediaType) {
        media.rtp = media.rtp.filter(rtp => {
          return rtp.codec === codec;
        });

        // Extract the payload number into Array, like [126, 97];
        // Note, there are cases the length of Array is more than 2.
        //   e.g. Firefox generates two 'H264' video codecs: 126, 97;
        //   e.g. Chrome generates three 'CN' audio codecs:  106, 105, 13;
        const payloadNumbers = media.rtp.reduce((prev, curr) => {
          return [...prev, curr.payload];
        }, []);

        // At this point, 0 means there's no codec, so let's throw Error.
        if (media.rtp.length === 0) {
          throw new Error(`${codec} does not exist`);
        }

        // fmtp is optional though most codecs have this parameter.
        if (media.fmtp) {
          media.fmtp = media.fmtp.filter(fmtp => {
            return payloadNumbers.includes(fmtp.payload);
          });
        }

        // rtcpFb is optional. Especially, m=audio doesn't have rtcpFb.
        if (media.rtcpFb) {
          media.rtcpFb = media.rtcpFb.filter(rtcpFb => {
            return payloadNumbers.includes(rtcpFb.payload);
          });
        }

        media.payloads = payloadNumbers.join(' ');
      }
      return media;
    });

    return sdpTransform.write(sdpObject);
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
  _addBandwidth(sdp, bandwidth, mediaType) {
    const sdpObject = sdpTransform.parse(sdp);
    sdpObject.media = sdpObject.media.map(media => {
      if (media.type === mediaType) {
        media.bandwidth = [
          {
            // Chrome supports only 'AS'
            type: 'AS',
            limit: bandwidth.toString(),
          },
          {
            // Firefox Supports only 'TIAS' from M49
            type: 'TIAS',
            limit: (bandwidth * 1000).toString(),
          },
        ];
      }
      return media;
    });
    return sdpTransform.write(sdpObject);
  }

  /**
   * Check bandwidth is valid or not. If invalid, throw Error
   * @param {number} bandwidth - bandwidth of 'audio' or 'video'
   * @private
   */
  _validateBandwidth(bandwidth) {
    if (bandwidth === undefined) {
      throw new Error('bandwidth is not passed');
    }

    if (!/^\d+$/.test(bandwidth)) {
      throw new Error(`${bandwidth} is not a number`);
    }
  }
}

export default new SdpUtil();
