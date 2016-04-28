'use strict';

const Room   = require('../src/room');

const shim              = require('../src/webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const assert     = require('power-assert');
const sinon      = require('sinon');

describe('Room', () => {
  const roomName = 'testRoom';

  describe('Constructor', () => {
    it('should create a Room Object', () => {
      const room = new Room(roomName, {});

      assert(room);
      assert(room instanceof Room);
      assert.equal(room.open, false);
    });

    it('should create a Room Object with a peerId', () => {
      const peerId = 'testId';
      const room = new Room(roomName, {peerId: peerId});

      assert(room);
      assert.equal(room._peerId, peerId);
    });
  });

  describe('Send', () => {
    it('should emit a send event when sending data', () => {
      const peerId = 'testId';
      const data = 'foobar';

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;

      const spy = sinon.spy();
      room.emit = spy;

      room.send(data);

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.MESSAGE_EVENTS.broadcast.key);
      assert.deepEqual(spy.args[0][1], {roomName, data});
    });
  });

  describe('Socket.io Events', () => {
    it('should add to the members array and emit when someone joins the room', () => {
      const peerId1 = 'peer1';
      const peerId2 = 'peer2';

      const room = new Room(roomName, {peerId: peerId1});
      room.open = true;
      assert.equal(room.members.length, 0);

      const spy = sinon.spy();
      room.emit = spy;

      room.handleJoin({src: peerId2});

      assert.equal(room.members.length, 1);
      assert.equal(room.members[0], peerId2);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.EVENTS.peerJoin.key);
      assert.equal(spy.args[0][1], peerId2);
    });

    it('should emit an open event and not add to the members array when src peerId is own', () => {
      const peerId = 'peerId';

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      assert.equal(room.members.length, 0);

      const spy = sinon.spy();
      room.emit = spy;

      room.handleJoin({src: peerId});

      assert.equal(room.members.length, 0);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.EVENTS.open.key);
    });

    it('should remove from members array and emit when someone leaves the room', () => {
      const peerId1 = 'peer1';
      const peerId2 = 'peer2';

      const room = new Room(roomName, {peerId: peerId1});
      room.open = true;
      room.members = [peerId2];
      assert.equal(room.members.length, 1);

      const spy = sinon.spy();
      room.emit = spy;

      room.handleLeave({src: peerId2});

      assert.equal(room.members.length, 0);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.EVENTS.peerLeave.key);
      assert.equal(spy.args[0][1], peerId2);
    });

    it('should emit to client when receiving data', () => {
      const peerId = 'peer';

      const data = 'foobar';
      const message = {roomName, data};

      const room = new Room(roomName, {peerId: peerId});

      const spy = sinon.spy();
      room.emit = spy;

      room.handleData(message);

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.EVENTS.data.key);
      assert.deepEqual(spy.args[0][1], message);
    });
  });

  describe('JVB', () => {
    it('should setup a new PC when an offer is first handled', () => {
      const peerId = 'peer';
      const offer = {};

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      assert.equal(room._pc, null);

      room.handleOffer(offer);
      assert(room._pc instanceof RTCPeerConnection);
    });

    it('should call setRemoteDescription on the PC when an offer is handled', () => {
      const offer = {};
      const peerId = 'peer';

      const spy = sinon.spy();
      const pc = {setRemoteDescription: spy};

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      room._pc = pc;
      room.handleOffer(offer);
      assert(spy.calledOnce);
    });

    it('should call createAnswer when setRemoteDescription completes', () => {
      const offer = {};
      const peerId = 'peer';

      const setRemoteDescription = (description, callback) => {
        callback();
      };

      const spy = sinon.spy();
      const pc = {setRemoteDescription: setRemoteDescription, createAnswer: spy};

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      room._pc = pc;
      room.handleOffer(offer);
      assert(spy.calledOnce);
    });

    it('should call setLocalDescription when createAnswer completes', () => {
      const offer = {};
      const peerId = 'peer';

      const setRemoteDescription = (description, callback) => {
        callback();
      };
      const createAnswer = callback => {
        callback();
      };

      const spy = sinon.spy();
      const pc = {setRemoteDescription: setRemoteDescription,
                  createAnswer:         createAnswer,
                  setLocalDescription:  spy};

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      room._pc = pc;
      room.handleOffer(offer);
      assert(spy.calledOnce);
    });
  });

  describe('_setupPCListeners', () => {
    it('should set up PeerConnection listeners', () => {
      const offer = {};
      const peerId = 'peer';

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;
      room.handleOffer(offer);

      const pc = room._pc;

      assert(pc.onaddstream);
      assert(pc.onicecandidate);
      assert(pc.oniceconnectionstatechange);
      assert(pc.onremovestream);
      assert(pc.onsignalingstatechange);
    });

    describe('RTCPeerConnection\'s event listeners', () => {
      const offer = {};
      const peerId = 'peer';
      let room;
      let pc;
      let ev;

      beforeEach(() => {
        room = new Room(roomName, {peerId: peerId});
        room.open = true;
        room.handleOffer(offer);
        pc = room._pc;

        ev = {id: 'foobar'};
      });

      describe('onaddstream', () => {
        it('should set remote stream on a onaddstream event', () => {
          ev.stream = 'stream';
          pc.onaddstream(ev);
          assert.equal(room.remoteStreams.foobar, ev.stream);
        });
      });

      describe('onicecandidate', () => {
        it('should emit \'answer\' upon receiving onicecandidate', done => {
          room.on(Room.MESSAGE_EVENTS.answer.key, () => {
            done();
          });

          pc.onicecandidate(ev);
        });
      });
    });
  });

  describe('Close', () => {
    it('should emit close and leave events when close() is called', () => {
      const peerId = 'peer';
      const message = {roomName: roomName};

      const room = new Room(roomName, {peerId: peerId});
      room.open = true;

      const spy = sinon.spy();
      room.emit = spy;

      room.close();

      assert(spy.calledTwice);
      assert.equal(spy.args[0][0], Room.MESSAGE_EVENTS.leave.key);
      assert.deepEqual(spy.args[0][1], message);
      assert.equal(spy.args[1][0], Room.EVENTS.close.key);
    });
  });
});
