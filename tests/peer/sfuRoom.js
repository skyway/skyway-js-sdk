import assert from 'power-assert';
import sinon from 'sinon';

import SFURoom from '../../src/peer/sfuRoom';
import Negotiator from '../../src/peer/negotiator';

describe('SFURoom', () => {
  const sfuRoomName = 'testSFURoom';
  const peerId = 'testId';
  const remotePeerId = 'differentTestId';
  const pcConfig = { iceServers: [] };
  const origStream = {};
  let sfuRoom;

  beforeEach(() => {
    sfuRoom = new SFURoom(sfuRoomName, peerId, {
      pcConfig: pcConfig,
      stream: origStream,
    });
  });

  describe('Constructor', () => {
    it('should create a SFURoom Object with properties set', () => {
      assert(sfuRoom);
      assert.equal(sfuRoom.name, sfuRoomName);
      assert.equal(sfuRoom._peerId, peerId);
      assert.equal(sfuRoom._localStream, origStream);
      assert.equal(sfuRoom._pcConfig, pcConfig);
    });
  });

  describe('call', () => {
    it('should emit an offerRequest event', done => {
      sfuRoom.on(SFURoom.MESSAGE_EVENTS.offerRequest.key, message => {
        assert.equal(message.roomName, sfuRoomName);
        done();
      });

      sfuRoom.call();
    });

    it('should set _localStream', () => {
      const dummyStream = {};

      sfuRoom.call(dummyStream);

      assert.equal(sfuRoom._localStream, dummyStream);
    });
  });

  describe('handleOffer', () => {
    const dummyOfferMessage = { offer: { sdp: '', type: 'offer' } };
    let startConnectionStub;
    let setupNegotiatorSpy;

    beforeEach(() => {
      startConnectionStub = sinon.stub(sfuRoom._negotiator, 'startConnection');
      setupNegotiatorSpy = sinon.spy(
        sfuRoom,
        '_setupNegotiatorMessageHandlers'
      );
    });

    it('should call negotiator.startConnection', () => {
      sfuRoom.handleOffer(dummyOfferMessage);

      assert.equal(startConnectionStub.callCount, 1);

      const startConnectionArgs = startConnectionStub.args[0][0];
      assert.equal(startConnectionArgs.type, 'media');
      assert.equal(startConnectionArgs.stream, origStream);
      assert.equal(startConnectionArgs.pcConfig, pcConfig);
      assert.equal(startConnectionArgs.offer.sdp, dummyOfferMessage.offer.sdp);
    });

    it('should call _setupNegotiatorMessageHandlers', () => {
      sfuRoom.handleOffer(dummyOfferMessage);

      assert.equal(setupNegotiatorSpy.callCount, 1);
    });

    it('should set _connectionStarted to true', () => {
      sfuRoom.handleOffer(dummyOfferMessage);

      assert.equal(sfuRoom._connectionStarted, true);
    });

    it('should call negotiator.handleOffer if _connectionStarted is true', () => {
      const handleOfferStub = sinon.stub(sfuRoom._negotiator, 'handleOffer');
      sfuRoom._connectionStarted = true;

      sfuRoom.handleOffer(dummyOfferMessage);

      assert.equal(handleOfferStub.callCount, 1);

      assert.equal(setupNegotiatorSpy.called, false);
      assert.equal(startConnectionStub.called, false);
    });
  });

  describe('_setupNegotiatorMessageHandlers', () => {
    it('should set up handlers for the negotiator events', () => {
      const onSpy = sinon.spy(sfuRoom._negotiator, 'on');

      sfuRoom._setupNegotiatorMessageHandlers();

      assert(onSpy.calledWith(Negotiator.EVENTS.addStream.key));
      assert(onSpy.calledWith(Negotiator.EVENTS.iceCandidate.key));
      assert(onSpy.calledWith(Negotiator.EVENTS.answerCreated.key));
      assert(onSpy.calledWith(Negotiator.EVENTS.iceConnectionFailed.key));
      assert(onSpy.calledWith(Negotiator.EVENTS.negotiationNeeded.key));
    });

    describe('Event handlers', () => {
      beforeEach(() => {
        sfuRoom._setupNegotiatorMessageHandlers();
      });

      describe('addStream', () => {
        const stream = { id: 'streamId' };

        describe('when stream.id is in _msidMap', () => {
          describe('when stream belongs to another peer', () => {
            beforeEach(() => {
              sfuRoom._msidMap[stream.id] = remotePeerId;
            });

            it('should emit a stream event with peerId set', done => {
              sfuRoom.on(SFURoom.EVENTS.stream.key, remoteStream => {
                assert.equal(remoteStream, stream);
                assert.equal(remoteStream.peerId, remotePeerId);
                done();
              });

              sfuRoom._negotiator.emit(Negotiator.EVENTS.addStream.key, stream);
            });

            it('should add the stream to remoteStreams', () => {
              assert.deepEqual(sfuRoom.remoteStreams, {});

              sfuRoom._negotiator.emit(Negotiator.EVENTS.addStream.key, stream);

              assert.deepEqual(sfuRoom.remoteStreams, { [stream.id]: stream });
            });
          });

          describe('when stream belongs to you', done => {
            it('should not emit an event or add to remoteStreams', () => {
              sfuRoom._msidMap[stream.id] = peerId;
              sfuRoom.on(SFURoom.EVENTS.stream.key, () => {
                assert.fail(
                  undefined,
                  undefined,
                  'Should not have emitted a stream event'
                );
              });

              sfuRoom._negotiator.emit(Negotiator.EVENTS.addStream.key, stream);
              assert.deepEqual(sfuRoom.remoteStreams, {});

              // let other async events run
              setTimeout(done);
            });
          });
        });

        describe('when stream.id is not in _msidMap', () => {
          it('should add the stream to _unknownStreams', () => {
            assert.deepEqual(sfuRoom._unknownStreams, {});

            sfuRoom._negotiator.emit(Negotiator.EVENTS.addStream.key, stream);

            assert.deepEqual(sfuRoom._unknownStreams, { [stream.id]: stream });
          });
        });
      });

      describe('negotiationNeeded', () => {
        it('should emit an offerRequest message event', done => {
          sfuRoom.on(
            SFURoom.MESSAGE_EVENTS.offerRequest.key,
            offerRequestMessage => {
              assert.equal(offerRequestMessage.roomName, sfuRoomName);
              done();
            }
          );

          sfuRoom._negotiator.emit(Negotiator.EVENTS.negotiationNeeded.key);
        });
      });

      describe('answerCreated', () => {
        it('should emit an answer message event', done => {
          const answer = { type: 'answer', sdp: 'v=0' };
          sfuRoom.on(SFURoom.MESSAGE_EVENTS.answer.key, answerMessage => {
            assert.equal(answerMessage.roomName, sfuRoomName);
            assert.equal(answerMessage.answer, answer);
            done();
          });

          sfuRoom._negotiator.emit(Negotiator.EVENTS.answerCreated.key, answer);
        });
      });

      describe('iceCandidate', () => {
        it('should emit a candidate message event', done => {
          const candidate = {};
          sfuRoom.on(SFURoom.MESSAGE_EVENTS.candidate.key, candidateMessage => {
            assert.equal(candidateMessage.roomName, sfuRoomName);
            assert.equal(candidateMessage.candidate, candidate);
            done();
          });

          sfuRoom._negotiator.emit(
            Negotiator.EVENTS.iceCandidate.key,
            candidate
          );
        });
      });

      describe('iceConnectionDisconnected', () => {
        it('should call close', () => {
          const closeStub = sinon.spy(sfuRoom, 'close');

          sfuRoom._negotiator.emit(Negotiator.EVENTS.iceConnectionFailed.key);

          assert.equal(closeStub.callCount, 1);
        });
      });
    });
  });

  describe('handleJoin', () => {
    describe('when message src is your peerId', () => {
      const joinMessage = {
        src: peerId,
        roomMembers: [peerId],
      };

      it('should emit an open event', done => {
        sfuRoom.on(SFURoom.EVENTS.open.key, () => {
          done();
        });

        sfuRoom.handleJoin(joinMessage);
      });

      it('should set open to true', () => {
        assert.equal(sfuRoom._open, false);

        sfuRoom.handleJoin(joinMessage);

        assert.equal(sfuRoom._open, true);
      });

      it('should not emit a peerJoin event', done => {
        sfuRoom.on(SFURoom.EVENTS.peerJoin.key, () => {
          assert.fail(
            undefined,
            undefined,
            'Should not have emitted a peerJoin event'
          );
        });

        sfuRoom.handleJoin(joinMessage);

        // let other async events run
        setTimeout(done);
      });

      it('should call room.call', done => {
        const callStub = sinon.stub(sfuRoom, 'call');

        sfuRoom.on(SFURoom.EVENTS.open.key, () => {
          assert.equal(callStub.callCount, 1);

          done();
        });

        assert.equal(callStub.callCount, 0);
        sfuRoom.handleJoin(joinMessage);
      });
    });

    describe('when message src is not your peerId', () => {
      const joinMessage = {
        src: remotePeerId,
        roomMembers: [peerId, remotePeerId],
      };

      it('should add user to members', () => {
        assert.equal(sfuRoom.members.length, 0);

        sfuRoom.handleJoin(joinMessage);

        assert.equal(sfuRoom.members.length, 1);
        assert.equal(sfuRoom.members[0], remotePeerId);
      });

      it('should emit a peerJoin event', done => {
        sfuRoom.on(SFURoom.EVENTS.peerJoin.key, joinedPeerId => {
          assert.equal(joinedPeerId, remotePeerId);

          done();
        });

        sfuRoom.handleJoin(joinMessage);
      });
    });
  });

  describe('handleLeave', () => {
    beforeEach(() => {
      sfuRoom.members = ['peer1', 'peer2', 'peer3'];
    });

    describe('when a peer has left from a opened room', () => {
      beforeEach(() => {
        sfuRoom._open = true;
      });

      it('should remove the user from members', () => {
        const removePeerId = sfuRoom.members[1];
        const leaveMessage = {
          src: removePeerId,
        };

        sfuRoom.handleLeave(leaveMessage);

        assert.equal(sfuRoom.members.length, 2);
        assert.equal(sfuRoom.members.indexOf(removePeerId), -1);
      });

      it("should not change members if user isn't in it", () => {
        const leaveMessage = {
          src: 'notAMember',
        };

        sfuRoom.handleLeave(leaveMessage);

        assert.equal(sfuRoom.members.length, 3);
      });

      it('should emit a peerLeave event', done => {
        const leaveMessage = {
          src: sfuRoom.members[1],
        };

        sfuRoom.on(SFURoom.EVENTS.peerLeave.key, leaveId => {
          assert.equal(leaveId, leaveMessage.src);

          done();
        });

        sfuRoom.handleLeave(leaveMessage);
      });

      it('should remove all of its streams from remoteStreams', done => {
        const receiveStreams = [
          { id: 'stream_1', peerId: sfuRoom.members[0] },
          { id: 'stream_2-1', peerId: sfuRoom.members[1] },
          { id: 'stream_2-2', peerId: sfuRoom.members[1] },
          { id: 'stream_3', peerId: sfuRoom.members[2] },
        ];

        const leaveMessage = { src: sfuRoom.members[1] };
        const leaveStreams = [receiveStreams[1], receiveStreams[2]];

        // register remote streams into sfuroom
        for (const stream of receiveStreams) {
          sfuRoom.remoteStreams[stream.id] = stream;
        }

        sfuRoom.on(SFURoom.EVENTS.peerLeave.key, () => {
          assert.equal(sfuRoom.remoteStreams[leaveStreams[0].id], undefined);
          assert.equal(sfuRoom.remoteStreams[leaveStreams[1].id], undefined);
          done();
        });

        sfuRoom.handleLeave(leaveMessage);
      });

      it('should not remove the stream of non-leaving peer', done => {
        const receiveStreams = [
          { id: 'stream_1', peerId: sfuRoom.members[0] },
          { id: 'stream_2-1', peerId: sfuRoom.members[1] },
          { id: 'stream_2-2', peerId: sfuRoom.members[1] },
          { id: 'stream_3', peerId: sfuRoom.members[2] },
        ];

        const leaveMessage = { src: sfuRoom.members[1] };
        const remainStream = receiveStreams[0];

        // register remote streams into sfuroom
        for (const stream of receiveStreams) {
          sfuRoom.remoteStreams[stream.id] = stream;
        }

        sfuRoom.on(SFURoom.EVENTS.peerLeave.key, () => {
          assert.equal(sfuRoom.remoteStreams[remainStream.id], remainStream);
          done();
        });

        sfuRoom.handleLeave(leaveMessage);
      });
    });

    describe('when room is not open', () => {
      it('should not remove from members', () => {
        const removePeerId = sfuRoom.members[1];
        const leaveMessage = {
          src: removePeerId,
        };

        sfuRoom.handleLeave(leaveMessage);

        assert.equal(sfuRoom.members.length, 3);
        assert(sfuRoom.members.indexOf(removePeerId) >= 0);
      });

      it('should not emit a peerLeave event', done => {
        const removePeerId = sfuRoom.members[1];
        const leaveMessage = {
          src: removePeerId,
        };

        sfuRoom.on(SFURoom.EVENTS.peerLeave.key, () => {
          assert.fail(
            undefined,
            undefined,
            'Should not have emitted a peerLeave event'
          );
        });

        sfuRoom.handleLeave(leaveMessage);

        // let other async events run
        setTimeout(done);
      });
    });
  });

  describe('send', () => {
    it('should emit a broadcast event', done => {
      const data = 'foobar';

      const sfuRoom = new SFURoom(sfuRoomName, peerId);
      sfuRoom._open = true;

      sfuRoom.on(SFURoom.MESSAGE_EVENTS.broadcast.key, message => {
        assert.equal(message.roomName, sfuRoomName);
        assert.equal(message.data, data);
        done();
      });

      sfuRoom.send(data);
    });

    it('should not emit a broadcast event if not open', done => {
      const data = 'foobar';

      const sfuRoom = new SFURoom(sfuRoomName, peerId);
      sfuRoom._open = false;

      sfuRoom.on(SFURoom.MESSAGE_EVENTS.broadcast.key, () => {
        assert.fail(
          undefined,
          undefined,
          'Should not have emitted a broadcast event'
        );
      });

      sfuRoom.send(data);

      // let other async events run
      setTimeout(done);
    });
  });

  describe('close', () => {
    it('should emit close and leave events when close() is called', () => {
      const message = { roomName: sfuRoomName };
      sfuRoom._open = true;

      const emitSpy = sinon.spy(sfuRoom, 'emit');

      sfuRoom.close();

      // spy on emitters because there are two events
      assert.equal(emitSpy.callCount, 2);
      assert(emitSpy.calledWith(SFURoom.MESSAGE_EVENTS.leave.key, message));
      assert(emitSpy.calledWith(SFURoom.EVENTS.close.key));
    });
  });

  describe('replaceStream', () => {
    const newStream = {};

    it('should change _localStream property with newStream', () => {
      assert.notEqual(sfuRoom._localStream, newStream);

      sfuRoom.replaceStream(newStream);

      assert.equal(sfuRoom._localStream, newStream);
    });

    it('should call replaceStream on room._negotiator', () => {
      const negotiatorReplaceStreamStub = sinon.stub(
        sfuRoom._negotiator,
        'replaceStream'
      );

      sfuRoom.replaceStream(newStream);

      assert.equal(negotiatorReplaceStreamStub.callCount, 1);
      assert(negotiatorReplaceStreamStub.calledWith(newStream));
    });
  });

  describe('updateMsidMap', () => {
    it('should update room._msidMap', () => {
      const newMsidMap = { stream1: {}, stream2: {} };

      assert.deepEqual(sfuRoom._msidMap, {});
      sfuRoom.updateMsidMap(newMsidMap);
      assert.equal(sfuRoom._msidMap, newMsidMap);
    });

    it('should emit stream if previously unknown stream is in msidMap', done => {
      const stream = { id: 'streamId' };

      const newMsidMap = {};
      newMsidMap[stream.id] = remotePeerId;

      sfuRoom._unknownStreams[stream.id] = stream;

      sfuRoom.on(SFURoom.EVENTS.stream.key, newStream => {
        assert.equal(newStream, stream);
        assert.equal(newStream.peerId, remotePeerId);

        done();
      });

      sfuRoom.updateMsidMap(newMsidMap);
    });
  });

  /** Inherited from Room */
  describe('handleData', () => {
    it('should emit a data event', done => {
      const message = {
        data: 'foobar',
        src: remotePeerId,
      };

      sfuRoom.on(SFURoom.EVENTS.data.key, receivedMessage => {
        assert.deepEqual(receivedMessage, message);

        done();
      });

      sfuRoom.handleData(message);
    });
  });

  describe('handleLog', () => {
    it('should emit a log event', done => {
      const testLog = Symbol();

      sfuRoom._open = true;

      sfuRoom.on('log', log => {
        assert.equal(log, testLog);
        done();
      });
      sfuRoom.handleLog(testLog);
    });
  });

  describe('getLog', () => {
    it('should emit a getLog event', done => {
      sfuRoom._open = true;

      sfuRoom.on(SFURoom.MESSAGE_EVENTS.getLog.key, () => {
        done();
      });

      sfuRoom.getLog();
    });
  });
});
