'use strict';

const Room            = require('../src/room');

const assert      = require('power-assert');
const sinon       = require('sinon');

describe('Room', () => {
  describe('Constructor', () => {
    it('should create a Room Object', () => {
      const roomName = 'testRoom';
      const room = new Room(roomName, {});

      assert(room);
      assert(room instanceof Room);
      assert.equal(room.open, false);
    });

    it('should create a Room Object with a peerId', () => {
      const roomName = 'testRoom';
      const peerId = 'testId';
      const room = new Room(roomName, {peerId: peerId});

      assert(room);
      assert.equal(room._peerId, peerId);
    });
  });

  describe('Send', () => {
    it('should emit a send event when sending data', () => {
      const roomName = 'testRoom';
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

  describe.only('Handle Events', () => {
    it('should add to the members array and emit when someone joins the room', () => {
      const roomName = 'testRoom';
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
      const roomName = 'testRoom';
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
      const roomName = 'testRoom';
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
      const roomName = 'testRoom';
      const peerId1 = 'peer1';
      const peerId2 = 'peer2';
      const data = 'foobar';
      const message = {roomName, data};

      const room = new Room(roomName, {peerId: peerId1});

      const spy = sinon.spy();
      room.emit = spy;

      room.handleData(message);

      assert(spy.calledOnce);
      assert.equal(spy.args[0][0], Room.EVENTS.data.key);
      assert.deepEqual(spy.args[0][1], message);
    });
  });
});
