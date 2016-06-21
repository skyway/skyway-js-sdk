'use strict';

// const MeshRoom   = require('../src/meshRoom');
const Connection      = require('../src/connection');
const util            = require('../src/util');

const shim              = require('../src/webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const assert     = require('power-assert');
const sinon      = require('sinon');
const proxyquire       = require('proxyquireify')(require);

describe('MeshRoom', () => {
  const meshRoomName = 'testMeshRoom';
  const peerId = 'testId';
  let MeshRoom;
  let meshRoom;
  let mcStub;
  let onSpy;
  let answerSpy;
  let emitSpy;
  let storeSpy;

  beforeEach(() => {
    mcStub = sinon.stub();
    onSpy = sinon.spy();
    answerSpy = sinon.spy();

    mcStub.returns({
      on: onSpy,
      answer: answerSpy
    });
    MeshRoom = proxyquire('../src/meshRoom', {'./mediaConnection': mcStub});
    meshRoom = new MeshRoom(meshRoomName, {peerId: peerId, _stream: 'stream'});
    emitSpy = sinon.spy(meshRoom, 'emit');
    storeSpy = sinon.spy(meshRoom, '_storeMessage');
  });

  afterEach(() => {
    emitSpy.restore();
  });

  describe('Constructor', () => {
    it('should create a MeshRoom Object', () => {
      const meshRoom = new MeshRoom(meshRoomName, {});

      assert(meshRoom);
      assert(meshRoom instanceof MeshRoom);
    });

    it('should create a MeshRoom Object with a peerId', () => {
      assert(meshRoom);
      assert.equal(meshRoom._peerId, peerId);
    });
  });

  describe('callRoom', () => {
    it('should emit getPeers event', () => {
      const stream = {};
      meshRoom.callRoom(stream);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.getPeers.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName});
    });
  });

  describe('connectRoom', () => {
    it('should emit getPeers event', () => {
      meshRoom.connectRoom();

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.getPeers.key);
      assert.deepEqual(emitSpy.args[0][1], {roomName: meshRoomName});
    });
  });
  
  describe('makeCalls', () => {
    it('should create MediaConnections according to given peerIds', () => {
      const peerIds = ['peerId1', 'peerId2'];
      meshRoom.makeCalls(peerIds);

      assert.equal(mcStub.callCount, 2);
      assert.equal(mcStub.args[0][0], 'peerId1');
      assert.equal(mcStub.args[1][0], 'peerId2');
      assert(meshRoom.connections['peerId1']);
      assert(meshRoom.connections['peerId2']);
    });
  });

  describe('_addConnection', () => {
    it('should add connection to connections', () => {
      const peerId1 = 'peerId1';
      const connection1 = 'connection1';
      meshRoom._addConnection(peerId1, connection1);

      const peerId2 = 'peerId2';
      const connection2 = 'connection2';
      meshRoom._addConnection(peerId2, connection2);

      assert(meshRoom.connections[peerId1]);
      assert.deepEqual(meshRoom.connections[peerId1][0], connection1);
      assert(meshRoom.connections[peerId1]);
      assert.deepEqual(meshRoom.connections[peerId2][0], connection2);
    });
  });

  describe('_setupMessageHandlers', () => {
    it('should set up message handlers', () => {
      const meshRoom = new MeshRoom(meshRoomName);
      const onSpy = sinon.spy();
      meshRoom._setupMessageHandlers({on: onSpy});

      assert.equal(onSpy.args[0][0], Connection.EVENTS.offer.key);
      assert.equal(onSpy.args[1][0], Connection.EVENTS.answer.key);
      assert.equal(onSpy.args[2][0], Connection.EVENTS.candidate.key);
      assert.equal(onSpy.args[3][0], 'stream');
    });
  });

  describe('getConnection', () => {
    it('should get a connection according to given peerId and connectionId', () => {
      const meshRoom = new MeshRoom(meshRoomName);

      const peerId1 = 'peerId1';
      const conId1 = 'conId1';
      const connection1 = {id: conId1};
      meshRoom._addConnection(peerId1, connection1);

      const peerId2 = 'peerId2';
      const conId2 = 'conId2';
      const connection2 = {id: conId2};
      meshRoom._addConnection(peerId2, connection2);

      assert(meshRoom.getConnection(peerId1, conId1));
      assert.equal(meshRoom.getConnection(peerId1, conId1), connection1);
      assert.equal(meshRoom.getConnection(peerId1, conId2), null);
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
    it('should emit peerLeave event', () => {
      const peerId1 = 'peerId1';
      const message = {src: peerId1};
      meshRoom.handleLeave(message);

      assert(emitSpy.calledOnce);
      assert.equal(emitSpy.args[0][0], MeshRoom.EVENTS.peerLeave.key);
      assert.equal(emitSpy.args[0][1], peerId1);
    });
  });
  
  describe('handleOffer', () => {
    it('should create new MediaConnection and call connection.answer', () => {
      const peerId2 = 'peerId2';
      const conId2 = 'conId2';
      const data = {
        connectionId: conId2, 
        connectionType: 'media',
        src: peerId2
      };
      meshRoom.handleOffer(data);

      assert.equal(mcStub.callCount, 1);
      assert.equal(mcStub.args[0][0], peerId2);
      assert(meshRoom.connections[peerId2])

      assert(answerSpy.calledOnce);
      assert.equal(answerSpy.args[0][0], 'stream')
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
        src: peerId1
      };
      meshRoom.handleAnswer(answerMessage);

      assert(handleSpy.calledOnce);
      assert.deepEqual(handleSpy.args[0][0], answerMessage);
    });

    it('should store message if connection is not exist.', () => {
      const answerMessage = {
        connectionId: 'conId2'
      };
      meshRoom.handleAnswer(answerMessage);

      assert(storeSpy.calledOnce);
      assert.equal(storeSpy.args[0][0], util.MESSAGE_TYPES.ANSWER.key);
      assert.deepEqual(storeSpy.args[0][1], answerMessage);
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
        src: peerId1
      };
      meshRoom.handleCandidate(candidateMessage);

      assert(handleSpy.calledOnce);
      assert.deepEqual(handleSpy.args[0][0], candidateMessage);
    });

    it('should store message if connection is not exist.', () => {
      const candidateMessage = {
        connectionId: 'conId2'
      };
      meshRoom.handleCandidate(candidateMessage);

      assert(storeSpy.calledOnce);
      assert.equal(storeSpy.args[0][0], util.MESSAGE_TYPES.CANDIDATE.key);
      assert.deepEqual(storeSpy.args[0][1], candidateMessage);
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

  describe('Close', () => {
    it('should emit close and leave events when close() is called', () => {

    });
  });
});
