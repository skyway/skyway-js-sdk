'use strict';

const SFURoom   = require('../src/sfuRoom');

const shim              = require('../src/webrtcShim');
const RTCPeerConnection = shim.RTCPeerConnection;

const assert     = require('power-assert');
const sinon      = require('sinon');

describe('SFURoom', () => {
  const sfuRoomName = 'testSFURoom';
  describe('Constructor', () => {
    it('should create a SFURoom Object', () => {
      const sfuRoom = new SFURoom(sfuRoomName, {});

      assert(sfuRoom);
      assert(sfuRoom instanceof SFURoom);
      assert.equal(sfuRoom.open, false);
    });

    it('should create a SFURoom Object with a peerId', () => {
      const peerId = 'testId';
      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});

      assert(sfuRoom);
      assert.equal(sfuRoom._peerId, peerId);
    });
  });

  describe('Send', () => {
    it('should emit a send event when sending data', () => {
      const peerId = 'testId';
      const data = 'foobar';

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.send(data);

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.MESSAGE_EVENTS.broadcast.key);
      console.log(spy.args[0][1])
      assert.deepEqual(spy.args[0][1], {roomName: sfuRoomName, data: data});
    });
  });

  describe('Socket.io Events', () => {
    it('should add to the members array and emit when someone joins the SFURoom', () => {
      const peerId1 = 'peer1';
      const peerId2 = 'peer2';

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId1});
      console.log(sfuRoom)
      sfuRoom.open = true;
      assert.equal(sfuRoom.members.length, 0);

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.handleJoin({src: peerId2});

      assert.equal(sfuRoom.members.length, 1);
      assert.equal(sfuRoom.members[0], peerId2);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.EVENTS.peerJoin.key);
      assert.equal(spy.args[0][1], peerId2);
    });

    it('should emit an open event and not add to the members array when src peerId is own', () => {
      const peerId = 'peerId';

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      assert.equal(sfuRoom.members.length, 0);

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.handleJoin({src: peerId});

      assert.equal(sfuRoom.members.length, 0);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.EVENTS.open.key);
    });

    it('should remove from members array and emit when someone leaves the SFURoom', () => {
      const peerId1 = 'peer1';
      const peerId2 = 'peer2';

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId1});
      sfuRoom.open = true;
      sfuRoom.members = [peerId2];
      assert.equal(sfuRoom.members.length, 1);

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.handleLeave({src: peerId2});

      assert.equal(sfuRoom.members.length, 0);
      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.EVENTS.peerLeave.key);
      assert.equal(spy.args[0][1], peerId2);
    });

    it('should emit to client when receiving data', () => {
      const peerId = 'peer';

      const data = 'foobar';
      const message = {sfuRoomName, data};

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.handleData(message);

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.EVENTS.data.key);
      assert.deepEqual(spy.args[0][1], message);
    });
  });

  describe('JVB', () => {
    it('should setup a new PC when an offer is first handled', () => {
      const peerId = 'peer';
      const offer = {};

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      assert.equal(sfuRoom._pc, null);

      sfuRoom.handleOffer(offer);
      assert(sfuRoom._pc instanceof RTCPeerConnection);
    });

    it('should call setRemoteDescription on the PC when an offer is handled', () => {
      const offer = {};
      const peerId = 'peer';

      const spy = sinon.spy();
      const pc = {setRemoteDescription: spy};

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      sfuRoom._pc = pc;
      sfuRoom.handleOffer(offer);
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

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      sfuRoom._pc = pc;
      sfuRoom.handleOffer(offer);
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

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      sfuRoom._pc = pc;
      sfuRoom.handleOffer(offer);
      assert(spy.calledOnce);
    });
  });

  describe('_setupPCListeners', () => {
    it('should set up PeerConnection listeners', () => {
      const offer = {};
      const peerId = 'peer';

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;
      sfuRoom.handleOffer(offer);

      const pc = sfuRoom._pc;

      assert(pc.onaddstream);
      assert(pc.onicecandidate);
      assert(pc.oniceconnectionstatechange);
      assert(pc.onremovestream);
      assert(pc.onsignalingstatechange);
    });

    describe('RTCPeerConnection\'s event listeners', () => {
      const offer = {};
      const peerId = 'peer';
      let sfuRoom;
      let pc;
      let ev;

      beforeEach(() => {
        sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
        sfuRoom.open = true;
        sfuRoom.handleOffer(offer);
        pc = sfuRoom._pc;

        ev = {stream: {id: 'streamId'}};
      });

      describe('onaddstream', () => {
        it('should set remote stream and emit on a onaddstream event', () => {
          const spy = sinon.spy();
          sfuRoom.emit = spy;

          pc.onaddstream(ev);

          assert.equal(sfuRoom.remoteStreams[ev.stream.id], ev.stream);
          assert(spy.calledOnce);
          assert.equal(spy.args[0][0], SFURoom.EVENTS.stream.key);
          assert.equal(spy.args[0][1], ev.stream);
        });
      });

      describe('onicecandidate', () => {
        it('should emit \'answer\' upon receiving onicecandidate', done => {
          sfuRoom.on(SFURoom.MESSAGE_EVENTS.answer.key, () => {
            done();
          });

          pc.onicecandidate(ev);
        });
      });
    });
  });

  describe('Logging', () => {
    it('should emit a getLog event when getLog() is called', () => {
      const peerId = 'peer';

      const room = new SFURoom(sfuRoomName, {peerId: peerId});
      room.open = true;

      const spy = sinon.spy();
      room.emit = spy;

      room.getLog();

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], SFURoom.MESSAGE_EVENTS.getLog.key);
    });

    it('should emit a log event when handleLog is called', done => {
      const peerId1 = 'peerId1';
      const testLog = Symbol();

      const room = new SFURoom(sfuRoomName, {peerId: peerId1});
      room.open = true;

      room.on('log', log => {
        assert.equal(log, testLog);
        done();
      });
      room.handleLog(testLog);
    });
  });

  describe('Close', () => {
    it('should emit close and leave events when close() is called', () => {
      const peerId = 'peer';
      const message = {roomName: sfuRoomName};

      const sfuRoom = new SFURoom(sfuRoomName, {peerId: peerId});
      sfuRoom.open = true;

      const spy = sinon.spy();
      sfuRoom.emit = spy;

      sfuRoom.close();

      assert(spy.calledTwice);
      assert.equal(spy.args[0][0], SFURoom.MESSAGE_EVENTS.leave.key);
      assert.deepEqual(spy.args[0][1], message);
      assert.equal(spy.args[1][0], SFURoom.EVENTS.close.key);
    });
  });
});
