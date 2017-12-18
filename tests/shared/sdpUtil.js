import assert from 'power-assert';

import sdpUtil from '../../src/shared/sdpUtil';

describe('SdpUtil', () => {
  const chromeSdpSingleStream = `v=0
o=- 7275415827503364971 3 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:886038975 1 tcp 1518280447 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 1 tcp 1518214911 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 1 tcp 1518149375 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=candidate:886038975 2 tcp 1518280446 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 2 tcp 1518214910 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 2 tcp 1518149374 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=ice-ufrag:3Z7iz6fq6D/HVRKj
a=ice-pwd:dIgdtQsZyREr5MoOKDhVOPji
a=fingerprint:sha-256 4E:99:6D:17:6B:A1:D1:40:34:FC:97:55:C0:59:CB:9F:9C:FC:3C:95:7E:71:46:95:4F:91:70:5B:09:D5:29:00
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:126 telephone-event/8000
a=ssrc:2735417111 cname:hnXj+zm5rl2IZmeR
a=ssrc:2735417111 msid:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK 99c41081-534b-4e66-a2e5-0aaed69c8f3b
a=ssrc:2735417111 mslabel:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK
a=ssrc:2735417111 label:99c41081-534b-4e66-a2e5-0aaed69c8f3b
m=video 9 UDP/TLS/RTP/SAVPF 100 101 107 116 117 96 97 99 98
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:886038975 1 tcp 1518280447 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 1 tcp 1518214911 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 1 tcp 1518149375 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=candidate:886038975 2 tcp 1518280446 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 2 tcp 1518214910 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 2 tcp 1518149374 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=ice-ufrag:3Z7iz6fq6D/HVRKj
a=ice-pwd:dIgdtQsZyREr5MoOKDhVOPji
a=fingerprint:sha-256 4E:99:6D:17:6B:A1:D1:40:34:FC:97:55:C0:59:CB:9F:9C:FC:3C:95:7E:71:46:95:4F:91:70:5B:09:D5:29:00
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:100 VP8/90000
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtpmap:101 VP9/90000
a=rtcp-fb:101 ccm fir
a=rtcp-fb:101 nack
a=rtcp-fb:101 nack pli
a=rtcp-fb:101 goog-remb
a=rtcp-fb:101 transport-cc
a=rtpmap:107 H264/90000
a=rtcp-fb:107 ccm fir
a=rtcp-fb:107 nack
a=rtcp-fb:107 nack pli
a=rtcp-fb:107 goog-remb
a=rtcp-fb:107 transport-cc
a=fmtp:107 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:116 red/90000
a=rtpmap:117 ulpfec/90000
a=rtpmap:96 rtx/90000
a=fmtp:96 apt=100
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=101
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=107
a=rtpmap:98 rtx/90000
a=fmtp:98 apt=116
a=ssrc-group:FID 2391045308 2252770815
a=ssrc:2391045308 cname:hnXj+zm5rl2IZmeR
a=ssrc:2391045308 msid:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK 39efbd01-32d1-4a46-946f-db7854bc10f2
a=ssrc:2391045308 mslabel:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK
a=ssrc:2391045308 label:39efbd01-32d1-4a46-946f-db7854bc10f2
a=ssrc:2252770815 cname:hnXj+zm5rl2IZmeR
a=ssrc:2252770815 msid:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK 39efbd01-32d1-4a46-946f-db7854bc10f2
a=ssrc:2252770815 mslabel:nrfvaEN2VRe4QdkX3O7OY9ODaR4LbzFoDRwK
a=ssrc:2252770815 label:39efbd01-32d1-4a46-946f-db7854bc10f2
`;

  const chromeSdpMultiStream = `v=0
o=- 6935231771389776773 4 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:886038975 1 tcp 1518280447 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 1 tcp 1518214911 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 1 tcp 1518149375 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=candidate:886038975 2 tcp 1518280446 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 2 tcp 1518214910 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 2 tcp 1518149374 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=ice-ufrag:X3EFTK6ix7NuQ8oN
a=ice-pwd:/NCd5krvtxJtRuVlOJn6Rinu
a=fingerprint:sha-256 5F:45:FC:A6:6D:C5:E7:E1:11:EC:84:DE:39:D8:90:6F:0E:21:3A:FB:07:6C:C3:D2:BE:EC:9A:AE:61:88:FC:FF
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:126 telephone-event/8000
a=ssrc:1250515243 cname:tct6RazNnxhxHRP3
a=ssrc:1250515243 msid:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K a13f8037-201f-4e22-bb97-3c6e8df02715
a=ssrc:1250515243 mslabel:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K
a=ssrc:1250515243 label:a13f8037-201f-4e22-bb97-3c6e8df02715
a=ssrc:1924600349 cname:tct6RazNnxhxHRP3
a=ssrc:1924600349 msid:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad 9e039434-5fed-441b-8fdc-1c5f15b07a00
a=ssrc:1924600349 mslabel:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad
a=ssrc:1924600349 label:9e039434-5fed-441b-8fdc-1c5f15b07a00
m=video 9 UDP/TLS/RTP/SAVPF 100 101 107 116 117 96 97 99 98
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:886038975 1 tcp 1518280447 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 1 tcp 1518214911 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 1 tcp 1518149375 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=candidate:886038975 2 tcp 1518280446 192.168.150.1 9 typ host tcptype active generation 0 network-id 3
a=candidate:3267389721 2 tcp 1518214910 172.16.0.56 9 typ host tcptype active generation 0 network-id 2
a=candidate:1736268921 2 tcp 1518149374 192.168.1.3 9 typ host tcptype active generation 0 network-id 1
a=ice-ufrag:X3EFTK6ix7NuQ8oN
a=ice-pwd:/NCd5krvtxJtRuVlOJn6Rinu
a=fingerprint:sha-256 5F:45:FC:A6:6D:C5:E7:E1:11:EC:84:DE:39:D8:90:6F:0E:21:3A:FB:07:6C:C3:D2:BE:EC:9A:AE:61:88:FC:FF
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:100 VP8/90000
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtpmap:101 VP9/90000
a=rtcp-fb:101 ccm fir
a=rtcp-fb:101 nack
a=rtcp-fb:101 nack pli
a=rtcp-fb:101 goog-remb
a=rtcp-fb:101 transport-cc
a=rtpmap:107 H264/90000
a=rtcp-fb:107 ccm fir
a=rtcp-fb:107 nack
a=rtcp-fb:107 nack pli
a=rtcp-fb:107 goog-remb
a=rtcp-fb:107 transport-cc
a=fmtp:107 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:116 red/90000
a=rtpmap:117 ulpfec/90000
a=rtpmap:96 rtx/90000
a=fmtp:96 apt=100
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=101
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=107
a=rtpmap:98 rtx/90000
a=fmtp:98 apt=116
a=ssrc-group:FID 1800970 443144717
a=ssrc:1800970 cname:tct6RazNnxhxHRP3
a=ssrc:1800970 msid:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K ee568fc4-e891-4105-a022-fc69a4100951
a=ssrc:1800970 mslabel:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K
a=ssrc:1800970 label:ee568fc4-e891-4105-a022-fc69a4100951
a=ssrc:443144717 cname:tct6RazNnxhxHRP3
a=ssrc:443144717 msid:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K ee568fc4-e891-4105-a022-fc69a4100951
a=ssrc:443144717 mslabel:WCIhdDR2r2qx7xkj8PKniskwnGumOE6wqB8K
a=ssrc:443144717 label:ee568fc4-e891-4105-a022-fc69a4100951
a=ssrc-group:FID 3045480655 642834637
a=ssrc:3045480655 cname:tct6RazNnxhxHRP3
a=ssrc:3045480655 msid:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad 7881f0a8-2f78-4cd2-9212-2408384f24eb
a=ssrc:3045480655 mslabel:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad
a=ssrc:3045480655 label:7881f0a8-2f78-4cd2-9212-2408384f24eb
a=ssrc:642834637 cname:tct6RazNnxhxHRP3
a=ssrc:642834637 msid:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad 7881f0a8-2f78-4cd2-9212-2408384f24eb
a=ssrc:642834637 mslabel:TmF7MpxG2AJPqCurOsk59bo4gDYyACfRjSad
a=ssrc:642834637 label:7881f0a8-2f78-4cd2-9212-2408384f24eb
`;

  const firefoxSdpSingleStream = `v=0
o=mozilla...THIS_IS_SDPARTA-48.0.1 5607070371164959555 0 IN IP4 0.0.0.0
s=-
t=0 0
a=sendrecv
a=fingerprint:sha-256 63:F6:33:F8:37:3B:6A:59:79:BC:FF:03:4E:33:3B:7E:45:BA:D8:21:74:1B:5B:7F:07:F3:2F:18:F7:CF:9A:03
a=group:BUNDLE sdparta_0 sdparta_1
a=ice-options:trickle
a=msid-semantic:WMS *
m=audio 57299 UDP/TLS/RTP/SAVPF 109 9 0 8
c=IN IP4 192.168.1.3
a=candidate:0 1 UDP 2122252543 192.168.1.3 57299 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 61943 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 64853 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 50653 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 54574 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 50553 typ host
a=sendrecv
a=end-of-candidates
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=fmtp:109 maxplaybackrate=48000;stereo=1
a=ice-pwd:eb77dda6036af02103e19b930cbfc657
a=ice-ufrag:c3e7fd4c
a=mid:sdparta_0
a=msid:{c06ce669-027d-fb44-85ec-1b31d00e10cf} {bca7e88e-5aaa-aa49-9400-a27bf0ed67ab}
a=rtcp:50653 IN IP4 192.168.1.3
a=rtcp-mux
a=rtpmap:109 opus/48000/2
a=rtpmap:9 G722/8000/1
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=setup:actpass
a=ssrc:1996831592 cname:{6fe60be3-7e7d-6047-9bb4-5f76f516417d}
m=video 59464 UDP/TLS/RTP/SAVPF 120 126 97
c=IN IP4 192.168.1.3
a=candidate:0 1 UDP 2122252543 192.168.1.3 59464 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 59439 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 49156 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 50838 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 65291 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 63742 typ host
a=sendrecv
a=end-of-candidates
a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1
a=fmtp:97 profile-level-id=42e01f;level-asymmetry-allowed=1
a=fmtp:120 max-fs=12288;max-fr=60
a=ice-pwd:eb77dda6036af02103e19b930cbfc657
a=ice-ufrag:c3e7fd4c
a=mid:sdparta_1
a=msid:{c06ce669-027d-fb44-85ec-1b31d00e10cf} {eb3e2bbb-f831-f045-9971-4ac9c4f7175e}
a=rtcp:50838 IN IP4 192.168.1.3
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 ccm fir
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtcp-fb:97 ccm fir
a=rtcp-mux
a=rtpmap:120 VP8/90000
a=rtpmap:126 H264/90000
a=rtpmap:97 H264/90000
a=setup:actpass
a=ssrc:3744113605 cname:{6fe60be3-7e7d-6047-9bb4-5f76f516417d}
`;

  const firefoxSdpMultiStream = `v=0
o=mozilla...THIS_IS_SDPARTA-48.0.1 3387153887084673378 0 IN IP4 0.0.0.0
s=-
t=0 0
a=sendrecv
a=fingerprint:sha-256 2B:6E:9B:59:F0:F3:CA:9D:93:2F:58:FD:69:94:25:75:AE:AD:3B:0F:2C:15:D1:A2:E8:B9:F3:DA:6A:B8:1B:40
a=group:BUNDLE sdparta_0 sdparta_1 sdparta_2 sdparta_3
a=ice-options:trickle
a=msid-semantic:WMS *
m=audio 56685 UDP/TLS/RTP/SAVPF 109 9 0 8
c=IN IP4 192.168.1.3
a=candidate:0 1 UDP 2122252543 192.168.1.3 56685 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 63868 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 56671 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 60338 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 64958 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 56347 typ host
a=sendrecv
a=end-of-candidates
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=fmtp:109 maxplaybackrate=48000;stereo=1
a=ice-pwd:22c5644c398bdf87a9a3c948859ebea2
a=ice-ufrag:5f318203
a=mid:sdparta_0
a=msid:{e8bc09a6-62f8-4c42-be8c-cfbc9223a173} {040c2f51-b2c3-c24b-a8f4-a3893b35fb2b}
a=rtcp:60338 IN IP4 192.168.1.3
a=rtcp-mux
a=rtpmap:109 opus/48000/2
a=rtpmap:9 G722/8000/1
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=setup:actpass
a=ssrc:553641627 cname:{71eaeac1-5ffa-184a-bdb6-96356857d252}
m=audio 56771 UDP/TLS/RTP/SAVPF 109 9 0 8
c=IN IP4 192.168.1.3
a=bundle-only
a=candidate:0 1 UDP 2122252543 192.168.1.3 56771 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 52496 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 61854 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 53926 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 52277 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 52063 typ host
a=sendrecv
a=end-of-candidates
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=fmtp:109 maxplaybackrate=48000;stereo=1
a=ice-pwd:22c5644c398bdf87a9a3c948859ebea2
a=ice-ufrag:5f318203
a=mid:sdparta_1
a=msid:{79a159cd-05e7-eb48-85c8-455987ffda99} {c25f8b25-7e2a-b049-8489-b46fcf9f503d}
a=rtcp:53926 IN IP4 192.168.1.3
a=rtcp-mux
a=rtpmap:109 opus/48000/2
a=rtpmap:9 G722/8000/1
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=setup:actpass
a=ssrc:985715871 cname:{71eaeac1-5ffa-184a-bdb6-96356857d252}
m=video 63505 UDP/TLS/RTP/SAVPF 120 126 97
c=IN IP4 192.168.1.3
a=candidate:0 1 UDP 2122252543 192.168.1.3 63505 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 54784 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 55439 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 62216 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 54658 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 51174 typ host
a=sendrecv
a=end-of-candidates
a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1
a=fmtp:97 profile-level-id=42e01f;level-asymmetry-allowed=1
a=fmtp:120 max-fs=12288;max-fr=60
a=ice-pwd:22c5644c398bdf87a9a3c948859ebea2
a=ice-ufrag:5f318203
a=mid:sdparta_2
a=msid:{e8bc09a6-62f8-4c42-be8c-cfbc9223a173} {a4b72291-cbae-3645-9994-01893db74aea}
a=rtcp:62216 IN IP4 192.168.1.3
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 ccm fir
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtcp-fb:97 ccm fir
a=rtcp-mux
a=rtpmap:120 VP8/90000
a=rtpmap:126 H264/90000
a=rtpmap:97 H264/90000
a=setup:actpass
a=ssrc:477697179 cname:{71eaeac1-5ffa-184a-bdb6-96356857d252}
m=video 63046 UDP/TLS/RTP/SAVPF 120 126 97
c=IN IP4 192.168.1.3
a=bundle-only
a=candidate:0 1 UDP 2122252543 192.168.1.3 63046 typ host
a=candidate:1 1 UDP 2122121471 192.168.150.1 49998 typ host
a=candidate:2 1 UDP 2122187007 172.16.0.56 53943 typ host
a=candidate:0 2 UDP 2122252542 192.168.1.3 65499 typ host
a=candidate:1 2 UDP 2122121470 192.168.150.1 57103 typ host
a=candidate:2 2 UDP 2122187006 172.16.0.56 58600 typ host
a=sendrecv
a=end-of-candidates
a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1
a=fmtp:97 profile-level-id=42e01f;level-asymmetry-allowed=1
a=fmtp:120 max-fs=12288;max-fr=60
a=ice-pwd:22c5644c398bdf87a9a3c948859ebea2
a=ice-ufrag:5f318203
a=mid:sdparta_3
a=msid:{79a159cd-05e7-eb48-85c8-455987ffda99} {94f6d274-cb47-d349-80e5-baf44a8e343f}
a=rtcp:65499 IN IP4 192.168.1.3
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 ccm fir
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtcp-fb:97 ccm fir
a=rtcp-mux
a=rtpmap:120 VP8/90000
a=rtpmap:126 H264/90000
a=rtpmap:97 H264/90000
a=setup:actpass
a=ssrc:3344931084 cname:{71eaeac1-5ffa-184a-bdb6-96356857d252}
`;

  const testBandwidthKbps = 200;
  const testBandwidthBps = 200 * 1000;

  describe('addVideoBandwidth', () => {
    it('should throw error when bandwidth is not Number', () => {
      const illegalArgument = 'hogehoge';
      try {
        sdpUtil.addVideoBandwidth(chromeSdpSingleStream, illegalArgument);
      } catch (e) {
        assert(e instanceof Error);
        assert.equal(e.message, `${illegalArgument} is not a number`);
      }
    });

    it('should throw error when bandwidth is not passed', () => {
      try {
        sdpUtil.addVideoBandwidth(chromeSdpSingleStream);
      } catch (e) {
        assert(e instanceof Error);
        assert.equal(e.message, 'bandwidth is not passed');
      }
    });

    describe('When Plan B (Chrome)', () => {
      // eslint-disable-next-line max-len
      const audioRegex = `m=audio \\d+ UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126\r\nc=IN IP4 0.0.0.0\r\nb=AS:${testBandwidthKbps}`;
      // eslint-disable-next-line max-len
      const videoRegex = `m=video \\d+ UDP/TLS/RTP/SAVPF 100 101 107 116 117 96 97 99 98\r\nc=IN IP4 0.0.0.0\r\nb=AS:${testBandwidthKbps}\r\nb=TIAS:${testBandwidthBps}`;

      describe('When single stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            chromeSdpSingleStream,
            testBandwidthKbps
          );
          assert(new RegExp(videoRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            chromeSdpSingleStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(audioRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            chromeSdpMultiStream,
            testBandwidthKbps
          );
          assert(new RegExp(videoRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            chromeSdpMultiStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(audioRegex).test(testSdp), false);
        });
      });
    });

    describe('When Unified Plan (Firefox)', () => {
      // eslint-disable-next-line max-len
      const audioRegex = `m=audio \\d+ UDP/TLS/RTP/SAVPF 109 9 0 8\r\nc=IN IP4 192.168.1.3\r\nb=AS:${testBandwidthKbps}`;
      // eslint-disable-next-line max-len
      const videoRegex = `m=video \\d+ UDP/TLS/RTP/SAVPF 120 126 97\r\nc=IN IP4 192.168.1.3\r\nb=AS:${testBandwidthKbps}\r\nb=TIAS:${testBandwidthBps}`;

      describe('When single stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            firefoxSdpSingleStream,
            testBandwidthKbps
          );
          assert(new RegExp(videoRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            firefoxSdpSingleStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(audioRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            firefoxSdpMultiStream,
            testBandwidthKbps
          );
          const regex = new RegExp(videoRegex, 'g');

          // "2" means 2 m=video sections with b=AS
          assert.equal(testSdp.match(regex).length, 2);
        });
        it('should not add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addVideoBandwidth(
            firefoxSdpMultiStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(audioRegex).test(testSdp), false);
        });
      });
    });
  });

  describe('addAudioBandwidth', () => {
    const testBandwiidth = 200;

    describe('When Plan B (Chrome)', () => {
      // eslint-disable-next-line max-len
      const audioRegex = `m=audio \\d+ UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 126\r\nc=IN IP4 0.0.0.0\r\nb=AS:${testBandwidthKbps}\r\nb=TIAS:${testBandwidthBps}`;
      // eslint-disable-next-line max-len
      const videoRegex = `m=video \\d+ UDP/TLS/RTP/SAVPF 100 101 107 116 117 96 97 99 98\r\nc=IN IP4 0.0.0.0\r\nb=AS:${testBandwidthKbps}`;

      describe('When single stream', () => {
        it('should add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            chromeSdpSingleStream,
            testBandwidthKbps
          );
          assert(new RegExp(audioRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            chromeSdpSingleStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(videoRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            chromeSdpMultiStream,
            testBandwidthKbps
          );
          assert(new RegExp(audioRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            chromeSdpMultiStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(videoRegex).test(testSdp), false);
        });
      });
    });

    describe('When Unified Plan (Firefox)', () => {
      // eslint-disable-next-line max-len
      const audioRegex = `m=audio \\d+ UDP/TLS/RTP/SAVPF 109 9 0 8\r\nc=IN IP4 192.168.1.3\r\nb=AS:${testBandwidthKbps}\r\nb=TIAS:${testBandwidthBps}`;
      // eslint-disable-next-line max-len
      const videoRegex = `m=video \\d+ UDP/TLS/RTP/SAVPF 120 126 97\r\nc=IN IP4 192.168.1.3\r\nb=AS:${testBandwidthKbps}`;

      describe('When single stream', () => {
        it('should add b=as:XX to m=audio', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            firefoxSdpSingleStream,
            testBandwiidth
          );
          assert(new RegExp(audioRegex).test(testSdp));
        });
        it('should not add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            firefoxSdpSingleStream,
            testBandwiidth
          );
          assert.equal(new RegExp(videoRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            firefoxSdpMultiStream,
            testBandwidthKbps
          );
          const regex = new RegExp(audioRegex, 'g');

          // "2" means 2 m=video sections with b=AS
          assert.equal(testSdp.match(regex).length, 2);
        });
        it('should not add b=as:XX to m=video', () => {
          const testSdp = sdpUtil.addAudioBandwidth(
            firefoxSdpMultiStream,
            testBandwidthKbps
          );
          assert.equal(new RegExp(videoRegex).test(testSdp), false);
        });
      });
    });
  });

  describe('filterAudioCodec', () => {
    const testAudioCodec = 'PCMU';

    it('should throw error when codec does not exist', () => {
      try {
        sdpUtil.filterAudioCodec(chromeSdpMultiStream, 'NonExistCodec');
      } catch (e) {
        assert(e instanceof Error);
        assert.equal(e.message, 'NonExistCodec does not exist');
      }
    });

    it('should throw error when codec is not passed', () => {
      try {
        sdpUtil.filterAudioCodec(chromeSdpSingleStream);
      } catch (e) {
        assert(e instanceof Error);
        assert.equal(e.message, 'codec is not passed');
      }
    });

    describe('When Plan B (Chrome)', () => {
      const pcmuRegex = 'a=rtpmap:0 PCMU/8000';
      const opusRegex = 'a=rtpmap:111 opus/48000/2';

      describe('When single stream', () => {
        it('should remove audio codecs except PCMU', () => {
          const testSdp = sdpUtil.filterAudioCodec(
            chromeSdpSingleStream,
            testAudioCodec
          );

          assert(new RegExp(pcmuRegex).test(testSdp));
          assert.equal(new RegExp(opusRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should remove audio codecs except PCMU', () => {
          const testSdp = sdpUtil.filterAudioCodec(
            chromeSdpMultiStream,
            testAudioCodec
          );

          assert(new RegExp(pcmuRegex).test(testSdp));
          assert.equal(new RegExp(opusRegex).test(testSdp), false);
        });
      });
    });

    describe('When Unified Plan (Firefox)', () => {
      const pcmuRegex = 'a=rtpmap:0 PCMU/8000';
      const opusRegex = 'a=rtpmap:109 opus/48000/2';

      describe('When single stream', () => {
        it('should remove audio codecs except PCMU', () => {
          const testSdp = sdpUtil.filterAudioCodec(
            firefoxSdpSingleStream,
            testAudioCodec
          );

          assert(new RegExp(pcmuRegex).test(testSdp));
          assert.equal(new RegExp(opusRegex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should remove audio codecs except PCMU', () => {
          const testSdp = sdpUtil.filterAudioCodec(
            firefoxSdpMultiStream,
            testAudioCodec
          );

          assert(new RegExp(pcmuRegex).test(testSdp));
          assert.equal(new RegExp(opusRegex).test(testSdp), false);
        });
      });
    });
  });

  describe('filterVideoCodec', () => {
    const testVideoCodec = 'H264';

    describe('When Plan B (Chrome)', () => {
      const h264Regex = 'a=rtpmap:107 H264/90000';
      const vp8Regex = 'a=rtpmap:100 VP8/90000';

      describe('When single stream', () => {
        it('should remove video codecs except H264', () => {
          const testSdp = sdpUtil.filterVideoCodec(
            chromeSdpSingleStream,
            testVideoCodec
          );

          assert(new RegExp(h264Regex).test(testSdp));
          assert.equal(new RegExp(vp8Regex).test(testSdp), false);
        });
      });

      describe('When multi stream', () => {
        it('should remove video codecs except H264', () => {
          const testSdp = sdpUtil.filterVideoCodec(
            chromeSdpMultiStream,
            testVideoCodec
          );

          assert(new RegExp(h264Regex).test(testSdp));
          assert.equal(new RegExp(vp8Regex).test(testSdp), false);
        });
      });
    });

    describe('When Unified Plan (Firefox)', () => {
      const h264Regex = 'a=rtpmap:126 H264/90000';
      const vp8Regex = 'a=rtpmap:120 VP8/90000';

      describe('When single stream', () => {
        it('should remove video codecs except H264', () => {
          const testSdp = sdpUtil.filterVideoCodec(
            firefoxSdpSingleStream,
            testVideoCodec
          );

          assert(new RegExp(h264Regex).test(testSdp));
          assert.equal(new RegExp(vp8Regex).test(testSdp), false);

          // Firefox should generate two H264 codecs
          const regex = new RegExp('a=rtpmap:\\d+ H264', 'g');
          assert.equal(testSdp.match(regex).length, 2);
        });
      });

      describe('When multi stream', () => {
        it('should remove video codecs except H264', () => {
          const testSdp = sdpUtil.filterVideoCodec(
            firefoxSdpMultiStream,
            testVideoCodec
          );

          assert(new RegExp(h264Regex).test(testSdp));
          assert.equal(new RegExp(vp8Regex).test(testSdp), false);
        });
      });
    });
  });
});
