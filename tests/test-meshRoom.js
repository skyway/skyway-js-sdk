'use strict';

const Connection  = require('../src/connection');

const assert      = require('power-assert');
const sinon       = require('sinon');
const proxyquire  = require('proxyquireify')(require);

describe('MeshRoom', () => {
  const meshRoomName = 'testMeshRoom';
  const peerId = 'testId';
  let MeshRoom;
  let meshRoom;
  let mcStub;
  let dcStub;
  let onSpy;
  let closeSpy;
  let emitSpy;

  beforeEach(() => {
    mcStub = sinon.stub();
    dcStub = sinon.stub();
    onSpy = sinon.spy();
    closeSpy = sinon.spy();

    mcStub.returns({
      on:    onSpy,
      close: closeSpy
    });

    dcStub.returns({
      on: onSpy
    });
    MeshRoom = proxyquire('../src/meshRoom', {'./mediaConnection': mcStub, './dataConnection': dcStub});
    meshRoom = new MeshRoom(meshRoomName, peerId, {stream: 'stream'});
    emitSpy = sinon.spy(meshRoom, 'emit');
  });

  describe('Constructor', () => {
    it('should create a MeshRoom Object with a peerId', () => {
      const peerId = 'peerId';
      const meshRoom = new MeshRoom(meshRoomName, peerId, {});

      assert(meshRoom);
      assert(meshRoom instanceof MeshRoom);
      assert.equal(meshRoom._peerId, peerId);
    });
  });

  describe('call', () => {
    it('should emit getPeers event', () => {
      const stream = {};
      meshRoom.call(stream);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.getPeers.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName, type: 'media'});
    });
  });

  describe('connectRoom', () => {
    it('should emit getPeers event', () => {
      meshRoom.connect();

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.getPeers.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName, type: 'data'});
    });
  });

  describe('makeMCs', () => {
    it('should create MediaConnections according to given peerIds', () => {
      const peerId1 = 'peerId1';
      const peerId2 = 'peerId1';
      const peerIds = [peerId1, peerId2];
      meshRoom.makeMCs(peerIds);

      assert.equal(mcStub.callCount, 2);
      assert.equal(mcStub.args[0][0], peerId1);
      assert.equal(mcStub.args[1][0], peerId2);
      assert(meshRoom.connections[peerId1]);
      assert(meshRoom.connections[peerId2]);
    });
  });

  describe('makeDCs', () => {
    it('should create DataConnections according to given peerIds', () => {
      const peerId1 = 'peerId1';
      const peerId2 = 'peerId1';
      const peerIds = [peerId1, peerId2];
      meshRoom.makeDCs(peerIds);

      assert.equal(dcStub.callCount, 2);
      assert.equal(dcStub.args[0][0], peerId1);
      assert.equal(dcStub.args[1][0], peerId2);
      assert(meshRoom.connections[peerId1]);
      assert(meshRoom.connections[peerId2]);
    });
  });

  describe('_deleteConnections', () => {
    it('should delete connections from connections property', () => {
      const peerId1 = 'peerId1';
      const connection1 = 'connection1';
      meshRoom._addConnection(peerId1, connection1);
      const connection2 = 'connection2';
      meshRoom._addConnection(peerId1, connection2);

      assert(meshRoom.connections[peerId1].length, 2);

      meshRoom._deleteConnections(peerId1);
      assert.equal(meshRoom.connections[peerId1], undefined);
    });
  });

  describe('_setupMessageHandlers', () => {
    it('should set up message handlers', () => {
      meshRoom._setupMessageHandlers({on: onSpy});

      assert.equal(onSpy.args[0][0], Connection.EVENTS.offer.key);
      assert.equal(onSpy.args[1][0], Connection.EVENTS.answer.key);
      assert.equal(onSpy.args[2][0], Connection.EVENTS.candidate.key);
      assert.equal(onSpy.args[3][0], 'stream');
    });
  });

  describe('connection\'s event listeners', () => {
    let MediaConnection = require('../src/mediaConnection');
    const remoteId = 'remoteId';
    let mc;

    beforeEach(() => {
      mc = new MediaConnection(remoteId);
      meshRoom._setupMessageHandlers(mc);
    });

    describe('offer', () => {
      it('should emit offer message including room name', () => {
        const offerMessage = {
          offer: 'offer'
        };

        mc.emit(Connection.EVENTS.offer.key, offerMessage);

        assert(emitSpy.calledOnce);
        assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.offer.key);
        offerMessage.roomName = meshRoomName;
        assert.deepEqual(emitSpy.args[0][1], offerMessage);
      });
    });

    describe('answer', () => {
      it('should emit answer message including room name', () => {
        const answerMessage = {
          answer: 'answer'
        };

        mc.emit(Connection.EVENTS.answer.key, answerMessage);

        assert(emitSpy.calledOnce);
        assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.answer.key);
        answerMessage.roomName = meshRoomName;
        assert.deepEqual(emitSpy.args[0][1], answerMessage);
      });
    });

    describe('candidate', () => {
      it('should emit candidate message including room name', () => {
        const candidateMessage = {
          candidate: 'candidate'
        };

        mc.emit(Connection.EVENTS.candidate.key, candidateMessage);

        assert(emitSpy.calledOnce);
        assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.candidate.key);
        candidateMessage.roomName = meshRoomName;
        assert.deepEqual(emitSpy.args[0][1], candidateMessage);
      });
    });

    describe('stream', () => {
      it('should emit stream with peerId', () => {
        const stream = {};

        mc.emit(MediaConnection.EVENTS.stream.key, stream);

        assert(emitSpy.calledOnce);
        assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.stream.key);
        stream.peerId = remoteId;
        assert.deepEqual(emitSpy.args[0][1], stream);
      });
    });
  });

  describe('_getConnection', () => {
    it('should get a connection according to given peerId and connectionId', () => {
      const peerId1 = 'peerId1';
      const conId1 = 'conId1';
      const connection1 = {id: conId1};
      meshRoom._addConnection(peerId1, connection1);

      const peerId2 = 'peerId2';
      const conId2 = 'conId2';
      const connection2 = {id: conId2};
      meshRoom._addConnection(peerId2, connection2);

      assert(meshRoom._getConnection(peerId1, conId1));
      assert.equal(meshRoom._getConnection(peerId1, conId1), connection1);
      assert.equal(meshRoom._getConnection(peerId1, conId2), null);
    });
  });

  describe('handleJoin', () => {
    it('should emit peerJoin event', () => {
      const peerId1 = 'peerId1';
      const message = {src: peerId1};
      meshRoom.handleJoin(message);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.peerJoin.key);
      assert.equal(emitSpy.args[0][1], peerId1);
    });
  });

  describe('handleLeave', () => {
    it('should call _deleteConnections and emit peerLeave event', () => {
      const peerId1 = 'peerId1';
      const message = {src: peerId1};
      meshRoom.handleLeave(message);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.peerLeave.key);
      assert.equal(emitSpy.args[0][1], peerId1);
    });
  });

  describe('handleOffer', () => {
    it('should create new MediaConnection and emit call event', () => {
      const peerId1 = 'peerId1';
      const conId1 = 'conId1';
      const data = {
        connectionId:   conId1,
        connectionType: 'media',
        src:            peerId1
      };
      meshRoom.handleOffer(data);

      assert.equal(mcStub.callCount, 1);
      assert.equal(mcStub.args[0][0], peerId1);
      assert(meshRoom.connections[peerId1]);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.call.key);
      assert.equal(emitSpy.args[0][1], meshRoom.connections[peerId1][0]);
    });
  });

  describe('handleAnswer', () => {
    it('should call connection.handleAnswer method', () => {
      const peerId1 = 'peerId1';
      const conId1 = 'conId1';
      const handleSpy = sinon.spy();
      const connection1 = {id: conId1, handleAnswer: handleSpy};
      meshRoom._addConnection(peerId1, connection1);

      const answerMessage = {
        connectionId: conId1,
        src:          peerId1
      };
      meshRoom.handleAnswer(answerMessage);

      assert(handleSpy.calledOnce);
      assert.deepEqual(handleSpy.args[0][0], answerMessage);
    });
  });

  describe('handleCandidate', () => {
    it('should call connection.handleCandidate method', () => {
      const peerId1 = 'peerId1';
      const conId1 = 'conId1';
      const handleSpy = sinon.spy();
      const connection1 = {id: conId1, handleCandidate: handleSpy};
      meshRoom._addConnection(peerId1, connection1);

      const candidateMessage = {
        connectionId: conId1,
        src:          peerId1
      };
      meshRoom.handleCandidate(candidateMessage);

      assert(handleSpy.calledOnce);
      assert.deepEqual(handleSpy.args[0][0], candidateMessage);
    });
  });

  describe('SendByWS', () => {
    it('should emit a broadcastByWS event when sending data', () => {
      const data = 'foobar';
      meshRoom.sendByWS(data);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.broadcastByWS.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName, data: data});
    });
  });

  describe('SendByDC', () => {
    it('should emit a broadcastByDC event when sending data', () => {
      const data = 'foobar';
      meshRoom.sendByDC(data);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.broadcastByDC.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName, data: data});
    });
  });

  describe('close', () => {
    it('should close all connections within the room and emit close and leave events', () => {
      meshRoom.makeMCs(['peerId1', 'peerId2']);
      meshRoom.close();

      assert(closeSpy.calledTwice);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.leave.key);
      assert.equal(emitSpy.args[1][0], MeshRoom.EVENTS.close.key);
    });
  });

  describe('Logging', () => {
    it('should emit a getLog event when getLog() is called', () => {
      meshRoom.getLog();

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.MESSAGE_EVENTS.getLog.key);
    });

    it('should emit a log event when handleLog is called', done => {
      const testLog = Symbol();
      meshRoom.on('log', log => {
        assert.equal(log, testLog);
        done();
      });

      meshRoom.handleLog(testLog);
    });
  });
});
