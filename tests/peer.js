import assert from 'power-assert';
import sinon from 'sinon';
import EventEmitter from 'events';

import MediaConnection from '../src/peer/mediaConnection';
import DataConnection from '../src/peer/dataConnection';
import SFURoom from '../src/peer/sfuRoom';
import MeshRoom from '../src/peer/meshRoom';
import Room from '../src/peer/room';
import Socket from '../src/peer/socket';
import util from '../src/shared/util';
import config from '../src/shared/config';
import logger from '../src/shared/logger';

import peerInjector from 'inject-loader!../src/peer';

describe('Peer', () => {
  const apiKey = 'abcdefgh-1234-5678-jklm-zxcvasdfqwrt';
  const peerId = 'testPeerId';
  const signalingHost = 'fake.domain';
  const signalingPort = 443;
  let SocketConstructorStub;
  let SFURoomConstructorStub;
  let MeshRoomConstructorStub;

  let DataConnectionConstructorSpy;

  let socketInstanceStub;
  let sfuRoomInstanceStub;
  let meshRoomInstanceStub;

  let Peer;
  let initializeServerConnectionSpy;

  beforeEach(() => {
    // new Socket should return a stubbed socket object
    SocketConstructorStub = sinon.stub(Socket, 'constructor');
    socketInstanceStub = sinon.createStubInstance(Socket);
    SocketConstructorStub.returns(socketInstanceStub);

    // new SFURoom should return a stubbed sfuRoom object
    SFURoomConstructorStub = sinon.stub(SFURoom, 'constructor');
    sfuRoomInstanceStub = sinon.createStubInstance(SFURoom);
    SFURoomConstructorStub.returns(sfuRoomInstanceStub);
    // hoist statics
    SFURoomConstructorStub.MESSAGE_EVENTS = SFURoom.MESSAGE_EVENTS;

    // new MeshRoom should return a stubbed meshRoom object
    MeshRoomConstructorStub = sinon.stub(MeshRoom, 'constructor');
    meshRoomInstanceStub = sinon.createStubInstance(MeshRoom);
    MeshRoomConstructorStub.returns(meshRoomInstanceStub);
    // hoist statics
    MeshRoomConstructorStub.MESSAGE_EVENTS = MeshRoom.MESSAGE_EVENTS;

    // We have to add the spy like this in order to get the
    // DataConnection object using DataConnectionConstructorSpy.thisValues
    DataConnectionConstructorSpy = sinon.spy();
    class DCSpier extends DataConnection {
      constructor(...args) {
        super(...args);
        this.spy = DataConnectionConstructorSpy;
        this.spy(...args);
      }
    }

    // EventEmitter functions should be spies not stubs so we can test them properly
    socketInstanceStub.on.restore();
    socketInstanceStub.emit.restore();
    sinon.spy(socketInstanceStub, 'on');
    sinon.spy(socketInstanceStub, 'emit');

    sfuRoomInstanceStub.on.restore();
    sfuRoomInstanceStub.emit.restore();
    sinon.spy(sfuRoomInstanceStub, 'on');
    sinon.spy(sfuRoomInstanceStub, 'emit');

    meshRoomInstanceStub.on.restore();
    meshRoomInstanceStub.emit.restore();
    sinon.spy(meshRoomInstanceStub, 'on');
    sinon.spy(meshRoomInstanceStub, 'emit');

    Peer = peerInjector({
      './peer/socket': SocketConstructorStub,
      './peer/sfuRoom': SFURoomConstructorStub,
      './peer/meshRoom': MeshRoomConstructorStub,
      './peer/dataConnection': DCSpier,
      './shared/config': config,
      './shared/logger': logger,
      './shared/util': util,
    }).default;
    initializeServerConnectionSpy = sinon.spy(
      Peer.prototype,
      '_initializeServerConnection'
    );
  });

  afterEach(() => {
    SocketConstructorStub.restore();
    SFURoomConstructorStub.restore();
    MeshRoomConstructorStub.restore();

    initializeServerConnectionSpy.restore();
  });

  describe('Constructor', () => {
    it('should create a Peer object', () => {
      const peer = new Peer({
        key: apiKey,
      });

      assert(peer);
      assert(peer instanceof Peer);
    });

    it('should create a Peer object with default options', () => {
      const peer = new Peer({
        key: apiKey,
      });

      assert.equal(peer.options.debug.value, logger.LOG_LEVELS.NONE.value);
      assert(peer.options.token);
      assert.equal(typeof peer.options.token, 'string');
      assert.deepEqual(peer.options.config, config.defaultConfig);
      assert.equal(peer.options.turn, true);
    });

    it('should create a Peer object with options overwritten', () => {
      const config = { iceServers: [] };
      const peer = new Peer({
        key: apiKey,
        debug: logger.LOG_LEVELS.WARN,
        config: config,
      });
      // Overwritten
      assert.equal(peer.options.key, apiKey);
      assert.equal(peer.options.debug, logger.LOG_LEVELS.WARN);
      assert.equal(peer.options.config, config);

      // Default unchanged
      assert.equal(typeof peer.options.token, 'string');
      assert.equal(peer.options.turn, true);
    });

    it('should not override options.token', () => {
      const peer = new Peer({
        key: apiKey,
        token: 'hoge',
      });

      // token is random value
      assert.notEqual(peer.options.token, 'hoge');
    });

    describe('Signaling server options', () => {
      describe('when host option is provided', () => {
        it('should create Peer object with provided host', () => {
          const mySignalingServer = {
            host: 'my.domain',
            port: 80,
            secure: false,
          };
          const peer = new Peer({
            key: apiKey,
            host: mySignalingServer.host,
            port: mySignalingServer.port,
            secure: mySignalingServer.secure,
          });

          assert.equal(peer.options.host, mySignalingServer.host);
          assert.equal(peer.options.port, mySignalingServer.port);
          assert.equal(peer.options.secure, mySignalingServer.secure);
        });
      });
    });

    it('should not create a Peer object with invalid ID', done => {
      let peer;
      try {
        peer = new Peer('間違ったIDです', {
          key: apiKey,
        });
      } catch (e) {
        assert(e.message.includes('is invalid'));
        assert.equal(peer, undefined);
        done();
      }
    });

    it('should not create a Peer object with invalid API key', done => {
      let peer;
      try {
        peer = new Peer({
          key: 'wrong',
        });
      } catch (e) {
        assert(e.message.includes('is invalid'));
        assert.equal(peer, undefined);
        done();
      }
    });

    it('should call _initializeServerConnection with passed id', () => {
      // eslint-disable-next-line no-new
      new Peer(peerId, {
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      assert.equal(initializeServerConnectionSpy.callCount, 1);
      assert(initializeServerConnectionSpy.calledWith(peerId));
    });

    it('should call _initializeServerConnection with undefined if id is not specified', () => {
      // eslint-disable-next-line no-new
      new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      assert.equal(initializeServerConnectionSpy.callCount, 1);
      assert(initializeServerConnectionSpy.calledWith(undefined));
    });

    // This can't be separated out because it is called in the constructor
    describe('_initializeServerConnection', () => {
      let peer;

      describe('without credential', () => {
        beforeEach(() => {
          socketInstanceStub.on.restore();
          socketInstanceStub.emit.restore();

          peer = new Peer(peerId, {
            key: apiKey,
            host: signalingHost,
            port: signalingPort,
          });

          sinon.stub(peer.socket, 'isOpen').get(() => true);
        });

        it('should create a new Socket and set it to peer.socket', () => {
          assert.equal(SocketConstructorStub.callCount, 1);
          assert(
            SocketConstructorStub.calledWithMatch(peer.options.key, {
              secure: peer.options.secure,
              host: peer.options.host,
              port: peer.options.port,
            })
          );
          assert.equal(peer.socket.constructor.name, 'Socket');
        });

        it("should abort on a socket 'error'", done => {
          const errMsg = 'test error';

          peer.on('error', err => {
            assert.equal(err.type, 'socket-error');
            assert.equal(err.message, errMsg);
            done();
          });

          peer.socket.emit('error', errMsg);
        });

        it("should abort and disconnect on a socket 'disconnect' event", done => {
          const disconnectSpy = sinon.spy(peer, 'disconnect');

          peer.on('error', err => {
            assert.equal(err.type, 'socket-error');
            assert.equal(err.message, 'Lost connection to server.');

            assert.equal(disconnectSpy.callCount, 1);
            disconnectSpy.restore();
            done();
          });

          peer.socket.emit('disconnect');
        });

        it('should call socket.start', () => {
          assert.equal(peer.socket.start.callCount, 1);
          assert(peer.socket.start.calledWith(peerId, peer.options.token));
        });
      });

      describe('with credential', () => {
        it('should call socket.start w/ credential', () => {
          peer = new Peer(peerId, {
            key: apiKey,
            host: signalingHost,
            port: signalingPort,
            credential: {
              timestamp: 100,
              ttl: 1000,
              authToken: 'hogehoge',
            },
          });
          assert(
            peer.socket.start.calledWith(
              peerId,
              peer.options.token,
              peer.options.credential
            )
          );
        });
      });
    });
  });

  describe('call', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer(peerId, {
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it('should create a new MediaConnection, add it, and return it', () => {
        const _addConnectionSpy = sinon.spy(peer, '_addConnection');

        const conn = peer.call(peerId, new MediaStream());

        assert.equal(conn.constructor.name, 'MediaConnection');
        assert.equal(_addConnectionSpy.callCount, 1);
        assert(_addConnectionSpy.calledWith(peerId, conn));

        _addConnectionSpy.restore();
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });

      it('should emit error and return', done => {
        peer.on('error', err => {
          assert.equal(err.type, 'disconnected');
          done();
        });

        peer.call(peerId, new MediaStream());
      });
    });
  });

  describe('connect', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it('should create a new DataConnection, add it, and return it', () => {
        const addConnectionSpy = sinon.spy(peer, '_addConnection');

        const conn = peer.connect(peerId, {});

        assert(conn instanceof DataConnection);
        assert.equal(addConnectionSpy.callCount, 1);
        assert(addConnectionSpy.calledWith(peerId, conn));

        addConnectionSpy.restore();
      });

      it('should create a new DataConnection, default reliable mode', () => {
        const addConnectionSpy = sinon.spy(peer, '_addConnection');

        const conn = peer.connect(peerId, {});

        // XXX: property reliable is only visible on Chrome / Firefox
        assert.equal(conn._dc.reliable, true);

        addConnectionSpy.restore();
      });

      it('should create a new DataConnection, with custom dcInit', () => {
        const addConnectionSpy = sinon.spy(peer, '_addConnection');

        const conn = peer.connect(peerId, {
          dcInit: { ordered: false },
        });

        assert.equal(conn._dc.ordered, false);

        addConnectionSpy.restore();
      });

      it('should create a new DataConnection, with unreliable mode', () => {
        const addConnectionSpy = sinon.spy(peer, '_addConnection');

        const conn = peer.connect(peerId, {
          dcInit: { maxRetransmits: 10 },
        });

        // XXX: property reliable is only visible on Chrome / Firefox
        assert.equal(conn._dc.reliable, false);

        addConnectionSpy.restore();
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });

      it('should emit error and return', done => {
        peer.on('error', err => {
          assert.equal(err.type, 'disconnected');
          done();
        });

        peer.connect(peerId);
      });
    });
  });

  describe('joinRoom', () => {
    const roomName = 'testRoomName';
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it("should call _initializeSfuRoom if mode is 'sfu'", () => {
        const initSfuRoomStub = sinon.stub(peer, '_initializeSfuRoom');
        const options = { mode: 'sfu' };

        peer.joinRoom(roomName, options);

        assert.equal(initSfuRoomStub.callCount, 1);
        assert(initSfuRoomStub.calledWith(roomName, options));
      });

      it("should call _initializeFullMeshRoom if mode is 'mesh'", () => {
        const initMeshRoomStub = sinon.stub(peer, '_initializeFullMeshRoom');
        const options = { mode: 'mesh' };

        peer.joinRoom(roomName, options);

        assert.equal(initMeshRoomStub.callCount, 1);
        assert(initMeshRoomStub.calledWith(roomName, options));
      });

      it('should call _initializeFullMeshRoom if mode is not set', () => {
        const initMeshRoomStub = sinon.stub(peer, '_initializeFullMeshRoom');
        const options = {};

        peer.joinRoom(roomName, options);

        assert.equal(initMeshRoomStub.callCount, 1);
        assert(initMeshRoomStub.calledWith(roomName, options));
      });

      it("should emit an error if roomName isn't defined", done => {
        const options = {};

        peer.on('error', err => {
          assert.equal(err.type, 'room-error');
          done();
        });

        peer.joinRoom(undefined, options);
      });

      it('should set roomOptions pcConfig and peerId', () => {
        const initMeshRoomStub = sinon.stub(peer, '_initializeFullMeshRoom');
        const options = {};

        peer.joinRoom(roomName, options);

        const roomOptions = initMeshRoomStub.args[0][1];
        assert.equal(roomOptions.pcConfig, peer._pcConfig);
        assert.equal(roomOptions.peerId, peer.id);
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });

      it('should emit error and return', done => {
        const options = {};

        peer.on('error', err => {
          assert.equal(err.type, 'disconnected');
          done();
        });

        peer.joinRoom(roomName, options);
      });
    });
  });

  describe('getConnection', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    afterEach(() => {
      peer.disconnect();
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it('should get a connection if peerId and connId match', () => {
        const peerId = 'testId';
        const connection = new DataConnection(peerId, {});

        peer._addConnection(peerId, connection);

        assert.equal(peer.getConnection(peerId, connection.id), connection);
      });

      it("should return null if connection doesn't exist", () => {
        const peerId = 'testId';
        const connection = new DataConnection(peerId, {});

        assert.equal(peer.getConnection(peerId, connection.id), null);
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });

      it('should emit error and return', done => {
        peer.on('error', err => {
          assert.equal(err.type, 'disconnected');
          done();
        });

        peer.getConnection();
      });
    });
  });

  describe('destroy', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      sinon.stub(peer.socket, 'isOpen').get(() => true);
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should call disconnect()', () => {
      const spy = sinon.spy(peer, 'disconnect');

      peer.destroy();

      assert.equal(spy.callCount, 1);

      spy.restore();
    });

    it('should not call disconnect() the second time you call it', () => {
      const spy = sinon.spy(peer, 'disconnect');

      peer.destroy();

      assert.equal(spy.callCount, 1);

      spy.restore();
    });

    it('should call _cleanupPeer for each peer in peer.connections', () => {
      const peerIds = [];
      const numPeers = 10;
      for (let peerIndex = 0; peerIndex < numPeers; peerIndex++) {
        const peerId = util.randomToken();
        peerIds.push(peerId);
        peer.connections[peerId] = [];
      }

      const stub = sinon.stub(peer, '_cleanupPeer');
      peer.destroy();

      assert.equal(stub.callCount, peerIds.length);
      for (const peerId of peerIds) {
        assert(stub.calledWith(peerId));
      }

      stub.restore();
    });
  });

  describe('disconnect', () => {
    let peer;
    let fakeIsOpen;
    beforeEach(() => {
      fakeIsOpen = true;
      socketInstanceStub.close = () => {
        fakeIsOpen = false;
      };

      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      sinon.stub(peer.socket, 'isOpen').get(() => fakeIsOpen);
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should emit "disconnected" event on peer', done => {
      peer.on('disconnected', id => {
        assert.equal(peer.id, id);
        done();
      });
      peer.disconnect();
    });

    it('should call socket.close', done => {
      let disconnectEventCount = 0;
      peer.on('disconnected', () => {
        assert.equal(++disconnectEventCount, 1);
        done();
      });
      peer.disconnect();
    });

    it('should not do anything the second time you call it', function(done) {
      let disconnectEventCount = 0;
      // eslint-disable-next-line no-invalid-this
      const beforeTestTimeout = this.timeout - 100;

      peer.on('disconnected', () => {
        assert.equal(++disconnectEventCount, 1);
        peer.disconnect();
      });

      setTimeout(() => {
        assert.equal(disconnectEventCount, 1);
        done();
      }, beforeTestTimeout);

      peer.disconnect();
    });
  });

  describe('reconnect', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it('should do nothing', () => {
        peer.reconnect();
        assert.equal(peer.socket.reconnect.callCount, 0);
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });
      it('should call socket.reconnect', () => {
        peer.reconnect();
        assert.equal(peer.socket.reconnect.callCount, 1);
      });
    });
  });

  describe('updateCredential', () => {
    it('should call socket.updateCredential()', () => {
      const credential = {
        timestamp: 100,
        ttl: 1000,
        authToken: 'hogehoge',
      };
      const peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      peer.updateCredential(credential);
      assert(peer.socket.updateCredential.calledWith(credential));
    });
  });

  describe('listAllPeers', () => {
    let peer;
    let requests = [];
    let xhr;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      const protocol = peer.options.secure ? 'https://' : 'http://';
      peer.socket.signalingServerUrl = `${protocol}${signalingHost}:${signalingPort}`;

      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function(request) {
        requests.push(request);
      };
    });

    afterEach(() => {
      xhr.restore();
      requests = [];

      peer.destroy();
    });

    describe('when its socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });

      it('should send a "GET" request to the right URL', () => {
        peer.listAllPeers();
        assert.equal(requests.length, 1);

        const protocol = peer.options.secure ? 'https://' : 'http://';
        const url =
          `${protocol}${peer.options.host}:` +
          `${peer.options.port}/api/apikeys/${apiKey}/clients/`;
        assert(requests[0].url === url);
        assert(requests[0].method === 'get');
      });

      it('should call the callback with the response as the argument', () => {
        const spy = sinon.spy();
        peer.listAllPeers(spy);
        assert.equal(requests.length, 1);

        const peerList = ['peerId1', 'peerId2', 'peerId3'];
        requests[0].respond(200, {}, JSON.stringify(peerList));

        assert.equal(spy.callCount, 1);
        assert(spy.calledWith(peerList));
      });

      it('should throw an error when the status is 401', () => {
        try {
          peer.listAllPeers();
          requests.respond(401);
        } catch (e) {
          assert(e instanceof Error);
          return;
        }

        assert.fail("Didn't throw an error");
      });

      it('should call the callback with an empty array any other status', () => {
        const spy = sinon.spy();
        const peerList = JSON.stringify(['peerId1', 'peerId2', 'peerId3']);
        const responseCodes = [202, 400, 403, 404, 408, 500, 503];

        for (
          let codeIndex = 0;
          codeIndex <= responseCodes.length;
          codeIndex++
        ) {
          peer.listAllPeers(spy);
          requests[codeIndex].respond(responseCodes[codeIndex], {}, peerList);
        }

        assert.equal(spy.withArgs([]).callCount, responseCodes.length);
      });

      it("should not throw an error if cb isn't provided", () => {
        try {
          peer.listAllPeers();
          requests[0].respond(200, {}, JSON.stringify([]));
        } catch (e) {
          assert.fail('Should not have thrown an error');
        }
      });

      // onerror testing is unstable. Wait for sinonjs2 to be released
      it.skip('should throw an error on peer if http request fails', done => {
        peer.on('error', err => {
          assert(err instanceof Error);
          assert.equal(err.type, 'server-error');
          done();
        });

        peer.listAllPeers();
        requests[0].abort();
      });
    });

    describe('when its socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });

      it('should emit error and return', done => {
        peer.on('error', err => {
          assert.equal(err.type, 'disconnected');
          done();
        });

        peer.listAllPeers();
      });
    });
  });

  describe('_checkOpenStatus', () => {
    const peerId = 'testPeerId';
    let peer;

    beforeEach(() => {
      peer = new Peer(peerId, {
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    describe('when socket is open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });
      it('should return open status', () => {
        assert.equal(peer._checkOpenStatus(), true);
      });
    });

    describe('when socket is not open', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => false);
      });
      it('should emit error', () => {
        try {
          peer._checkOpenStatus();
        } catch (e) {
          assert(e instanceof Error);
          return;
        }
      });
    });
  });

  describe('_emitNotConnectedError', () => {
    const peerId = 'testPeerId';
    let peer;

    beforeEach(() => {
      peer = new Peer(peerId, {
        key: apiKey,
      });
    });

    it('should emit error', () => {
      try {
        peer._emitNotConnectedError();
      } catch (e) {
        assert(e instanceof Error);
        return;
      }
    });
  });

  describe('_initializeSfuRoom', () => {
    const peerId = 'testPeerId';
    const roomName = 'testRoomName';
    const options = {};
    let peer;

    beforeEach(() => {
      peer = new Peer(peerId, {
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      peer.id = peerId;
    });

    it('should create and return SFURoom', () => {
      const sfuRoom = peer._initializeSfuRoom(roomName, options);

      assert.equal(SFURoomConstructorStub.callCount, 1);
      assert(SFURoomConstructorStub.calledWith(roomName, peerId, options));

      assert.equal(sfuRoom.constructor.name, 'SFURoom');
      assert.equal(peer.rooms[roomName], sfuRoom);
    });

    it('should set call _setupSFURoomMessageHandlers', () => {
      const setupSFUMessageHandlersSpy = sinon.spy(
        peer,
        '_setupSFURoomMessageHandlers'
      );
      const sfuRoom = peer._initializeSfuRoom(roomName, options);

      assert.equal(setupSFUMessageHandlersSpy.callCount, 1);
      assert(setupSFUMessageHandlersSpy.calledWith(sfuRoom));
    });

    it('should send a ROOM_JOIN message', () => {
      peer._initializeSfuRoom(roomName, options);

      assert.equal(peer.socket.send.callCount, 1);
      assert(
        peer.socket.send.calledWithMatch(
          config.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key,
          { roomName: roomName, roomType: 'sfu' }
        )
      );
    });

    it('should return the room if it exists', () => {
      const dummyRoom = {};
      peer.rooms[roomName] = dummyRoom;

      const sfuRoom = peer._initializeSfuRoom(roomName, options);

      assert.equal(sfuRoom, dummyRoom);
      assert.equal(SFURoomConstructorStub.callCount, 0);
    });
  });

  describe('_initializeFullMeshRoom', () => {
    const peerId = 'testPeerId';
    const roomName = 'testRoomName';
    const options = {};
    let peer;

    beforeEach(() => {
      peer = new Peer(peerId, {
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      peer.id = peerId;
    });

    it('should create and return MeshRoom', () => {
      const meshRoom = peer._initializeFullMeshRoom(roomName, options);

      assert.equal(MeshRoomConstructorStub.callCount, 1);
      assert(MeshRoomConstructorStub.calledWith(roomName, peerId, options));

      assert.equal(meshRoom.constructor.name, 'MeshRoom');
      assert.equal(peer.rooms[roomName], meshRoom);
    });

    it('should set call _setupMeshRoomMessageHandlers', () => {
      const setupSFUMessageHandlersSpy = sinon.spy(
        peer,
        '_setupMeshRoomMessageHandlers'
      );
      const meshRoom = peer._initializeFullMeshRoom(roomName, options);

      assert.equal(setupSFUMessageHandlersSpy.callCount, 1);
      assert(setupSFUMessageHandlersSpy.calledWith(meshRoom));
    });

    it('should send a ROOM_JOIN message', () => {
      peer._initializeFullMeshRoom(roomName, options);

      assert.equal(peer.socket.send.callCount, 1);
      assert(
        peer.socket.send.calledWithMatch(
          config.MESSAGE_TYPES.CLIENT.ROOM_JOIN.key,
          { roomName: roomName, roomType: 'mesh' }
        )
      );
    });

    it('should return the room if it exists', () => {
      const dummyRoom = {};
      peer.rooms[roomName] = dummyRoom;

      const meshRoom = peer._initializeFullMeshRoom(roomName, options);

      assert.equal(meshRoom, dummyRoom);
      assert.equal(MeshRoomConstructorStub.callCount, 0);
    });
  });

  describe('_setupMessageHandlers', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    describe('general peer messages', () => {
      describe('OPEN', () => {
        it('should set peer.id and peer.open', () => {
          assert.equal(peer.id, undefined);

          const peerId = 'testId';
          const openMessage = { peerId: peerId };
          peer.socket.emit(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage);

          assert.equal(peer.id, peerId);
        });

        it('should add turn servers if credentials are defined', () => {
          assert.equal(peer.id, undefined);

          const openMessage = { peerId: peerId, turnCredential: 'password' };

          const defaultIceServersLength =
            config.defaultConfig.iceServers.length;
          assert.equal(
            peer.options.config.iceServers.length,
            defaultIceServersLength
          );
          assert.equal(peer._pcConfig, undefined);

          peer.socket.emit(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage);

          // 3 servers added: 'turn-udp', 'turn-tcp', 'turns-tcp'
          assert.equal(
            peer._pcConfig.iceServers.length,
            defaultIceServersLength + 3
          );
        });

        it("should not add turn servers if credentials aren't defined", () => {
          assert.equal(peer.id, undefined);

          const openMessage = { peerId: peerId };

          const defaultIceServersLength =
            config.defaultConfig.iceServers.length;
          assert.equal(
            peer.options.config.iceServers.length,
            defaultIceServersLength
          );
          assert.equal(peer._pcConfig, undefined);

          peer.socket.emit(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage);

          // 3 servers added: 'turn-udp', 'turn-tcp', 'turns-tcp'
          assert.equal(
            peer._pcConfig.iceServers.length,
            defaultIceServersLength
          );
        });

        it('should emit an open event', done => {
          const openMessage = { peerId: peerId };
          peer.on(Peer.EVENTS.open.key, newPeerId => {
            assert.equal(newPeerId, peerId);
            done();
          });

          peer.socket.emit(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage);
        });
      });

      describe('AUTH_EXPIRES_IN', () => {
        let logSpy;

        beforeEach(() => {
          logSpy = sinon.spy(logger, 'log');
        });
        afterEach(() => {
          logSpy.restore();
        });

        it('should emit expires_in', done => {
          const remainingSec = 100;
          peer.on(Peer.EVENTS.expiresin.key, sec => {
            assert.equal(logSpy.callCount, 1);
            assert.equal(sec, remainingSec);
            assert(logSpy.calledWith(`Credential expires in ${remainingSec}`));
            done();
          });
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.AUTH_EXPIRES_IN.key,
            remainingSec
          );
        });
      });

      describe('ERROR', () => {
        it('should call emitError with error type', done => {
          const error = new Error('error message');
          error.type = 'error-type';

          peer.on(Peer.EVENTS.error.key, err => {
            assert(err instanceof Error);
            assert.equal(err.type, 'error-type');
            assert.equal(err.message, 'error message');
            done();
          });
          peer.socket.emit(config.MESSAGE_TYPES.SERVER.ERROR.key, error);
        });
      });
    });

    describe('signaling messages', () => {
      beforeEach(() => {
        sinon.stub(peer.socket, 'isOpen').get(() => true);
      });
      describe('LEAVE', () => {
        let logSpy;

        beforeEach(() => {
          logSpy = sinon.spy(logger, 'log');
        });
        afterEach(() => {
          logSpy.restore();
        });

        it('should log a message', () => {
          peer.socket.emit(config.MESSAGE_TYPES.SERVER.LEAVE.key, peerId);

          assert.equal(logSpy.callCount, 1);
          assert(logSpy.calledWith(`Received leave message from ${peerId}`));
        });

        it('should call _cleanupPeer', () => {
          const cleanupStub = sinon.stub(peer, '_cleanupPeer');

          peer.socket.emit(config.MESSAGE_TYPES.SERVER.LEAVE.key, peerId);

          assert.equal(cleanupStub.callCount, 1);
          assert(cleanupStub.calledWith(peerId));
        });
      });

      describe('OFFER', () => {
        const roomName = 'testRoomName';
        const offerMessage = {
          roomName: roomName,
        };

        describe('MeshRoom', () => {
          it('should call handleOffer if room exists', () => {
            peer.rooms[roomName] = meshRoomInstanceStub;

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.OFFER.key,
              offerMessage
            );

            assert.equal(meshRoomInstanceStub.handleOffer.callCount, 1);
            assert(meshRoomInstanceStub.handleOffer.calledWith(offerMessage));
          });

          it("should not call handleOffer if room doesn't exist", () => {
            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.OFFER.key,
              offerMessage
            );

            assert.equal(meshRoomInstanceStub.handleOffer.callCount, 0);
          });
        });

        describe('p2p', () => {
          it('should create MediaConnection on media OFFER events', done => {
            const connectionId = util.randomToken();
            peer.on(Peer.EVENTS.call.key, connection => {
              assert(connection);
              assert.equal(connection.constructor.name, 'MediaConnection');
              assert.equal(connection._options.connectionId, connectionId);
              assert.equal(Object.keys(peer.connections[peerId]).length, 1);
              assert.equal(
                peer.getConnection(peerId, connection.id),
                connection
              );
              done();
            });

            const offerMsg = {
              connectionType: 'media',
              connectionId: connectionId,
              src: peerId,
              metadata: {},
              offer: {},
            };
            peer.socket.emit(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMsg);
          });

          it('should create DataConnection on data OFFER events', done => {
            const connectionId = util.randomToken();

            peer.on(Peer.EVENTS.connection.key, connection => {
              assert.equal(DataConnectionConstructorSpy.callCount, 1);

              assert(connection);
              assert(connection instanceof DataConnection);
              assert.equal(connection._options.connectionId, connectionId);
              assert.equal(Object.keys(peer.connections[peerId]).length, 1);
              assert.equal(
                peer.getConnection(peerId, connection.id),
                connection
              );

              done();
            });

            const offerMsg = {
              connectionType: 'data',
              connectionId: connectionId,
              src: peerId,
              metadata: {},
              offer: {},
            };
            peer.socket.emit(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMsg);
          });

          it('should not create a connection if connectType is invalid', () => {
            const connectionId = util.randomToken();

            const offerMsg = {
              connectionType: undefined,
              connectionId: connectionId,
              src: peerId,
              metadata: {},
              offer: {},
            };
            peer.socket.emit(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMsg);

            assert.equal(peer.connections[peerId], undefined);
          });

          it('should not create a connection if connectionId already exists', done => {
            const connectionId = util.randomToken();

            const offerMsg = {
              connectionType: 'media',
              connectionId: connectionId,
              src: peerId,
              metadata: {},
              offer: {},
            };
            peer.socket.emit(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMsg);
            peer.socket.emit(config.MESSAGE_TYPES.SERVER.OFFER.key, offerMsg);

            setTimeout(() => {
              assert.equal(Object.keys(peer.connections[peerId]).length, 1);
              done();
            });
          });
        });
      });

      describe('ANSWER', () => {
        describe('MeshRoom', () => {
          const roomName = 'testRoomName';
          const answerMessage = {
            roomName: roomName,
          };

          it('should call handleAnswer if room exists', () => {
            peer.rooms[roomName] = meshRoomInstanceStub;

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.ANSWER.key,
              answerMessage
            );

            assert.equal(meshRoomInstanceStub.handleAnswer.callCount, 1);
            assert(meshRoomInstanceStub.handleAnswer.calledWith(answerMessage));
          });

          it("should not call handleAnswer if room doesn't exist", () => {
            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.ANSWER.key,
              answerMessage
            );

            assert.equal(meshRoomInstanceStub.handleAnswer.callCount, 0);
          });
        });

        describe('p2p', () => {
          it('should call handleAnswer if connection exists', () => {
            // The connection type doesn't matter so just test one
            const mediaConnection = new MediaConnection('remoteId', {});
            const srcId = 'srcId';
            const mediaAnswerMessage = {
              src: srcId,
              dst: 'remoteId',
              answer: {},
              connectionId: mediaConnection.id,
              connectionType: 'media',
            };

            const stub = sinon.stub(mediaConnection, 'handleAnswer');

            peer._addConnection(srcId, mediaConnection);

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.ANSWER.key,
              mediaAnswerMessage
            );
            assert.equal(stub.callCount, 1);
            assert(stub.calledWith(mediaAnswerMessage));
          });

          it("should queue ANSWERs if connection doesn't exist", () => {
            const connId1 = 'connId1';
            const connId2 = 'connId2';
            const mediaAnswerMessage = {
              src: 'id1',
              dst: 'id2',
              answer: {},
              connectionId: connId1,
              connectionType: 'media',
            };
            const dataAnswerMessage = {
              src: 'id1',
              dst: 'id2',
              answer: {},
              connectionId: connId2,
              connectionType: 'data',
            };

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.ANSWER.key,
              mediaAnswerMessage
            );
            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.ANSWER.key,
              dataAnswerMessage
            );

            const messages1 = peer._queuedMessages[connId1];

            assert.equal(
              messages1[0].type,
              config.MESSAGE_TYPES.SERVER.ANSWER.key
            );
            assert.equal(messages1[0].payload, mediaAnswerMessage);

            const messages2 = peer._queuedMessages[connId2];

            assert.equal(
              messages2[0].type,
              config.MESSAGE_TYPES.SERVER.ANSWER.key
            );
            assert.equal(messages2[0].payload, dataAnswerMessage);
          });
        });
      });

      describe('CANDIDATE', () => {
        describe('MeshRoom', () => {
          const roomName = 'testRoomName';
          const candidateMessage = {
            roomName: roomName,
          };
          it('should call handleCandidate if room exists', () => {
            peer.rooms[roomName] = meshRoomInstanceStub;

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
              candidateMessage
            );

            assert.equal(meshRoomInstanceStub.handleCandidate.callCount, 1);
            assert(
              meshRoomInstanceStub.handleCandidate.calledWith(candidateMessage)
            );
          });

          it("should not call handleCandidate if room doesn't exist", () => {
            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
              candidateMessage
            );

            assert.equal(meshRoomInstanceStub.handleCandidate.callCount, 0);
          });
        });

        describe('p2p', () => {
          it('should call handleCandidate on CANDIDATE if connection exists', () => {
            // The connection type doesn't matter so just test one
            const dataConnection = new DataConnection('remoteId', {});
            const srcId = 'srcId';
            const dataCandidateMessage = {
              src: srcId,
              dst: 'remoteId',
              candidate: {},
              connectionId: dataConnection.id,
              connectionType: 'data',
            };

            const stub = sinon.stub(dataConnection, 'handleCandidate');

            peer._addConnection(srcId, dataConnection);

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
              dataCandidateMessage
            );
            assert.equal(stub.callCount, 1);
            assert(stub.calledWith(dataCandidateMessage));
          });

          it("should queue CANDIDATEs if connection doesn't exist", () => {
            const connId1 = 'connId1';
            const connId2 = 'connId2';
            const mediaCandidateMessage = {
              src: 'id1',
              dst: 'id2',
              candidate: {},
              connectionId: connId1,
              connectionType: 'media',
            };
            const dataCandidateMessage = {
              src: 'id1',
              dst: 'id2',
              candidate: {},
              connectionId: connId2,
              connectionType: 'data',
            };

            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
              mediaCandidateMessage
            );
            peer.socket.emit(
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
              dataCandidateMessage
            );

            const messages1 = peer._queuedMessages[connId1];

            assert.equal(
              messages1[0].type,
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key
            );
            assert.equal(messages1[0].payload, mediaCandidateMessage);

            const messages2 = peer._queuedMessages[connId2];

            assert.equal(
              messages2[0].type,
              config.MESSAGE_TYPES.SERVER.CANDIDATE.key
            );
            assert.equal(messages2[0].payload, dataCandidateMessage);
          });
        });
      });

      describe('FORCE_CLOSE', () => {
        it('should close the specified connection when received the message', () => {
          const connectionId = 'connId1';
          const srcId = 'srcId';
          const remoteId = 'remoteId';
          const mediaConnection = new MediaConnection(remoteId, {
            connectionId,
          });

          const forceCloseMessage = {
            src: remoteId,
            dst: srcId,
            connectionId,
          };
          const closeSpy = sinon.spy(mediaConnection, 'close');

          peer._addConnection(remoteId, mediaConnection);
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.FORCE_CLOSE.key,
            forceCloseMessage
          );

          assert(closeSpy.calledOnce);
          assert(closeSpy.calledWith(false));
        });
      });
    });

    describe('Room specific messages', () => {
      const roomName = 'testroom';

      describe('ROOM_USER_JOIN', () => {
        const joinMessage = {
          roomName: roomName,
        };

        it('should call handleJoin if room exists', () => {
          peer.rooms[roomName] = sfuRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USER_JOIN.key,
            joinMessage
          );

          assert.equal(sfuRoomInstanceStub.handleJoin.callCount, 1);
          assert(sfuRoomInstanceStub.handleJoin.calledWith(joinMessage));
        });

        it("should not call handleJoin if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USER_JOIN.key,
            joinMessage
          );

          assert.equal(sfuRoomInstanceStub.handleJoin.callCount, 0);
        });
      });

      describe('ROOM_USER_LEAVE', () => {
        const leaveMessage = {
          roomName: roomName,
        };
        it('should call handleLeave if room exists', () => {
          peer.rooms[roomName] = sfuRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USER_LEAVE.key,
            leaveMessage
          );

          assert.equal(sfuRoomInstanceStub.handleLeave.callCount, 1);
          assert(sfuRoomInstanceStub.handleLeave.calledWith(leaveMessage));
        });

        it("should not call handleLeave if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USER_LEAVE.key,
            leaveMessage
          );

          assert.equal(sfuRoomInstanceStub.handleLeave.callCount, 0);
        });
      });

      describe('ROOM_DATA', () => {
        const dataMessage = {
          roomName: roomName,
        };
        it('should call handleData if room exists', () => {
          peer.rooms[roomName] = sfuRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_DATA.key,
            dataMessage
          );

          assert.equal(sfuRoomInstanceStub.handleData.callCount, 1);
          assert(sfuRoomInstanceStub.handleData.calledWith(dataMessage));
        });

        it("should not call handleData if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_DATA.key,
            dataMessage
          );

          assert.equal(sfuRoomInstanceStub.handleData.callCount, 0);
        });
      });

      describe('ROOM_LOGS', () => {
        const logMessage = {
          roomName: roomName,
          log: [],
        };
        it('should call handleLog if room exists', () => {
          peer.rooms[roomName] = sfuRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_LOGS.key,
            logMessage
          );

          assert.equal(sfuRoomInstanceStub.handleLog.callCount, 1);
          assert(sfuRoomInstanceStub.handleLog.calledWith(logMessage.log));
        });

        it("should not call handleLog if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_LOGS.key,
            logMessage
          );

          assert.equal(sfuRoomInstanceStub.handleLog.callCount, 0);
        });
      });

      describe('ROOM_USERS', () => {
        const userList = ['peer1', 'peer2', 'peer3'];
        const mediaUsersMessage = {
          roomName: roomName,
          userList: userList,
          type: 'media',
        };
        const dataUsersMessage = {
          roomName: roomName,
          userList: userList,
          type: 'data',
        };

        it('should call makeMediaConnections if type is media', () => {
          peer.rooms[roomName] = meshRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USERS.key,
            mediaUsersMessage
          );

          assert.equal(meshRoomInstanceStub.makeMediaConnections.callCount, 1);
          assert(
            meshRoomInstanceStub.makeMediaConnections.calledWith(userList)
          );

          assert.equal(meshRoomInstanceStub.makeDataConnections.callCount, 0);
        });

        it('should call makeDataConnections if type is data', () => {
          peer.rooms[roomName] = meshRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USERS.key,
            dataUsersMessage
          );

          assert.equal(meshRoomInstanceStub.makeDataConnections.callCount, 1);
          assert(meshRoomInstanceStub.makeDataConnections.calledWith(userList));

          assert.equal(meshRoomInstanceStub.makeMediaConnections.callCount, 0);
        });

        it("should not call makeMediaConnections or makeDataConnections if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USERS.key,
            mediaUsersMessage
          );
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.ROOM_USERS.key,
            dataUsersMessage
          );

          assert.equal(meshRoomInstanceStub.makeMediaConnections.callCount, 0);
          assert.equal(meshRoomInstanceStub.makeDataConnections.callCount, 0);
        });
      });

      describe('SFU_OFFER', () => {
        const offerMessage = {
          roomName: roomName,
          msids: {},
          offer: {},
        };

        it('should call handleOffer and updateMsidMap if room exists', () => {
          peer.rooms[roomName] = sfuRoomInstanceStub;

          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.SFU_OFFER.key,
            offerMessage
          );

          assert.equal(sfuRoomInstanceStub.handleOffer.callCount, 1);
          assert(sfuRoomInstanceStub.handleOffer.calledWith(offerMessage));

          assert.equal(sfuRoomInstanceStub.updateMsidMap.callCount, 1);
          assert(
            sfuRoomInstanceStub.updateMsidMap.calledWith(offerMessage.msids)
          );
        });

        it("should not call handleOffer and updateMsidMap if room doesn't exist", () => {
          peer.socket.emit(
            config.MESSAGE_TYPES.SERVER.SFU_OFFER.key,
            offerMessage
          );

          assert.equal(sfuRoomInstanceStub.handleOffer.callCount, 0);
          assert.equal(sfuRoomInstanceStub.updateMsidMap.callCount, 0);
        });
      });
    });
  });

  describe('_setupConnectionMessageHandlers', () => {
    const message = {};
    let peer;
    let connectionStub;

    beforeEach(() => {
      connectionStub = new EventEmitter();

      sinon.spy(connectionStub, 'on');
      sinon.spy(connectionStub, 'emit');

      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      peer._setupConnectionMessageHandlers(connectionStub);
    });

    it('should set up handlers for Connection Message events', () => {
      assert(
        connectionStub.on.calledWith(
          MediaConnection.EVENTS.offer.key,
          sinon.match.func
        )
      );
      assert(
        connectionStub.on.calledWith(
          MediaConnection.EVENTS.answer.key,
          sinon.match.func
        )
      );
      assert(
        connectionStub.on.calledWith(
          MediaConnection.EVENTS.candidate.key,
          sinon.match.func
        )
      );
    });

    describe('offer', () => {
      it('should send OFFER message', () => {
        connectionStub.emit(MediaConnection.EVENTS.offer.key, message);
        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_OFFER.key,
            message
          )
        );
      });
    });

    describe('answer', () => {
      it('should send ANSWER message', () => {
        connectionStub.emit(MediaConnection.EVENTS.answer.key, message);
        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key,
            message
          )
        );
      });
    });

    describe('candidate', () => {
      it('should send CANDIDATE message', () => {
        connectionStub.emit(MediaConnection.EVENTS.candidate.key, message);
        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key,
            message
          )
        );
      });
    });

    describe('forceClose', () => {
      it('should send SEND_FORCE_CLOSE message', () => {
        connectionStub.emit(MediaConnection.EVENTS.forceClose.key);
        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_FORCE_CLOSE.key
          )
        );
      });
    });
  });

  describe('_setupRoomMessageHandlers', () => {
    const roomName = 'testRoomName';
    const message = {};

    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      sfuRoomInstanceStub.name = roomName;

      peer.rooms[roomName] = sfuRoomInstanceStub;
      peer._setupRoomMessageHandlers(sfuRoomInstanceStub);
    });

    it('should set up handlers for Room Message events', () => {
      assert(
        sfuRoomInstanceStub.on.calledWith(
          Room.MESSAGE_EVENTS.broadcast.key,
          sinon.match.func
        )
      );
      assert(
        sfuRoomInstanceStub.on.calledWith(
          Room.MESSAGE_EVENTS.getLog.key,
          sinon.match.func
        )
      );
      assert(
        sfuRoomInstanceStub.on.calledWith(
          Room.MESSAGE_EVENTS.leave.key,
          sinon.match.func
        )
      );
    });

    describe('broadcast', () => {
      it('should send ROOM_SEND_DATA message', () => {
        sfuRoomInstanceStub.emit(SFURoom.MESSAGE_EVENTS.broadcast.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.ROOM_SEND_DATA.key,
            message
          )
        );
      });
    });

    describe('getLog', () => {
      it('should send ROOM_GET_LOGS message', () => {
        sfuRoomInstanceStub.emit(SFURoom.MESSAGE_EVENTS.getLog.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.ROOM_GET_LOGS.key,
            message
          )
        );
      });
    });

    describe('leave', () => {
      it('should send ROOM_LEAVE message', () => {
        sfuRoomInstanceStub.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.ROOM_LEAVE.key,
            message
          )
        );
      });

      it('should delete room from peer.rooms', () => {
        sfuRoomInstanceStub.emit(SFURoom.MESSAGE_EVENTS.leave.key, message);

        assert.equal(peer.rooms[roomName], undefined);
      });
    });
  });

  describe('_setupSFURoomMessageHandlers', () => {
    const roomName = 'testRoomName';
    const message = {};

    let peer;
    let roomMessageHandlerStub;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      sfuRoomInstanceStub.name = roomName;

      peer.rooms[roomName] = sfuRoomInstanceStub;

      roomMessageHandlerStub = sinon.stub(peer, '_setupRoomMessageHandlers');
      peer._setupSFURoomMessageHandlers(sfuRoomInstanceStub);
    });

    it('should call _setupRoomMessageHandlers', () => {
      assert.equal(roomMessageHandlerStub.callCount, 1);
      assert(roomMessageHandlerStub.calledWith(sfuRoomInstanceStub));
    });

    it('should set up handlers for SFURoom Message events', () => {
      peer._setupSFURoomMessageHandlers(sfuRoomInstanceStub);
      assert(
        sfuRoomInstanceStub.on.calledWith(
          SFURoom.MESSAGE_EVENTS.offerRequest.key,
          sinon.match.func
        )
      );
      assert(
        sfuRoomInstanceStub.on.calledWith(
          SFURoom.MESSAGE_EVENTS.answer.key,
          sinon.match.func
        )
      );
    });

    describe('offerRequest', () => {
      it('should send SFU_GET_OFFER message', () => {
        peer._setupSFURoomMessageHandlers(sfuRoomInstanceStub);

        sfuRoomInstanceStub.emit(
          SFURoom.MESSAGE_EVENTS.offerRequest.key,
          message
        );

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SFU_GET_OFFER.key,
            message
          )
        );
      });
    });

    describe('answer', () => {
      it('should send SFU_ANSWER message', () => {
        peer._setupSFURoomMessageHandlers(sfuRoomInstanceStub);

        sfuRoomInstanceStub.emit(SFURoom.MESSAGE_EVENTS.answer.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SFU_ANSWER.key,
            message
          )
        );
      });
    });
  });

  describe('_setupMeshRoomMessageHandlers', () => {
    const roomName = 'testRoomName';
    const message = {};

    let peer;
    let roomMessageHandlerStub;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
      meshRoomInstanceStub.name = roomName;

      peer.rooms[roomName] = meshRoomInstanceStub;

      roomMessageHandlerStub = sinon.stub(peer, '_setupRoomMessageHandlers');
      peer._setupMeshRoomMessageHandlers(meshRoomInstanceStub);
    });

    it('should call _setupRoomMessageHandlers', () => {
      assert.equal(roomMessageHandlerStub.callCount, 1);
      assert(roomMessageHandlerStub.calledWith(meshRoomInstanceStub));
    });

    it('should set up handlers for MeshRoom Message events', () => {
      assert(
        meshRoomInstanceStub.on.calledWith(
          MeshRoom.MESSAGE_EVENTS.offer.key,
          sinon.match.func
        )
      );
      assert(
        meshRoomInstanceStub.on.calledWith(
          MeshRoom.MESSAGE_EVENTS.answer.key,
          sinon.match.func
        )
      );
      assert(
        meshRoomInstanceStub.on.calledWith(
          MeshRoom.MESSAGE_EVENTS.candidate.key,
          sinon.match.func
        )
      );
      assert(
        meshRoomInstanceStub.on.calledWith(
          MeshRoom.MESSAGE_EVENTS.getPeers.key,
          sinon.match.func
        )
      );
    });

    describe('offer', () => {
      it('should send OFFER message', () => {
        meshRoomInstanceStub.emit(MeshRoom.MESSAGE_EVENTS.offer.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_OFFER.key,
            message
          )
        );
      });
    });

    describe('answer', () => {
      it('should send ANSWER message', () => {
        meshRoomInstanceStub.emit(MeshRoom.MESSAGE_EVENTS.answer.key, message);

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_ANSWER.key,
            message
          )
        );
      });
    });

    describe('candidate', () => {
      it('should send CANDIDATE message', () => {
        meshRoomInstanceStub.emit(
          MeshRoom.MESSAGE_EVENTS.candidate.key,
          message
        );

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.SEND_CANDIDATE.key,
            message
          )
        );
      });
    });

    describe('getPeers', () => {
      it('should send MESH_USER_LIST_REQUEST message', () => {
        meshRoomInstanceStub.emit(
          MeshRoom.MESSAGE_EVENTS.getPeers.key,
          message
        );

        assert(
          peer.socket.send.calledWith(
            config.MESSAGE_TYPES.CLIENT.ROOM_GET_USERS.key,
            message
          )
        );
      });
    });
  });

  describe('_abort', () => {
    const type = 'testType';
    const message = 'testMessage';

    let peer;
    let errorSpy;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });

      // prevent error from breaking tests
      peer.on(Peer.EVENTS.error.key, () => {});

      errorSpy = sinon.spy(logger, 'error');
    });

    afterEach(() => {
      errorSpy.restore();
    });

    it('should call disconnect', () => {
      const disconnectStub = sinon.stub(peer, 'disconnect');

      peer._abort(type, message);

      assert.equal(disconnectStub.callCount, 1);
    });

    it('should call logger.error', () => {
      peer._abort(type, message);

      assert(errorSpy.calledWith('Aborting!'));
    });

    it('should cause peer to emit an error', done => {
      peer.on(Peer.EVENTS.error.key, err => {
        assert.equal(err.type, type);
        assert.equal(err.message, message);
        done();
      });

      peer._abort(type, message);
    });
  });

  describe('_addConnection', () => {
    describe('_storeMessage', () => {
      const connection = {};

      let peer;
      let setupConnectionMessageHandlerStub;
      beforeEach(() => {
        peer = new Peer({
          key: apiKey,
        });

        setupConnectionMessageHandlerStub = sinon.stub(
          peer,
          '_setupConnectionMessageHandlers'
        );
      });

      it("should create an array in connections for the peerId if it doesn't exist", () => {
        assert.equal(peer.connections[peerId], undefined);

        peer._addConnection(peerId, connection);

        assert.equal(peer.connections[peerId].constructor.name, 'Array');
        assert.equal(peer.connections[peerId].length, 1);
        assert.equal(peer.connections[peerId][0], connection);
      });

      it('should append an entry to connections if the array exists', () => {
        peer.connections[peerId] = [{}];

        peer._addConnection(peerId, connection);

        assert.equal(peer.connections[peerId].constructor.name, 'Array');
        assert.equal(peer.connections[peerId].length, 2);
        assert.equal(peer.connections[peerId][1], connection);
      });

      it('should call _setupConnectionHandlers on the added connection', () => {
        peer._addConnection(peerId, connection);

        assert.equal(setupConnectionMessageHandlerStub.callCount, 1);
        assert(setupConnectionMessageHandlerStub.calledWith(connection));
      });
    });
  });

  describe('_storeMessage', () => {
    const connectionId = 'testConnectionId';
    const message = { connectionId: connectionId };
    const type = 'testType';

    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
      });
    });

    it("should create an array in _queuedMessages for the connection if it doesn't exist", () => {
      assert.equal(peer._queuedMessages[connectionId], undefined);

      peer._storeMessage(type, message);

      assert.equal(
        peer._queuedMessages[connectionId].constructor.name,
        'Array'
      );
      assert.equal(peer._queuedMessages[connectionId].length, 1);
      assert.deepEqual(peer._queuedMessages[connectionId][0], {
        type: type,
        payload: message,
      });
    });

    it('should append an entry to _queuedMessages if the array exists', () => {
      peer._queuedMessages[connectionId] = [{}];

      peer._storeMessage(type, message);

      assert.equal(
        peer._queuedMessages[connectionId].constructor.name,
        'Array'
      );
      assert.equal(peer._queuedMessages[connectionId].length, 2);
      assert.deepEqual(peer._queuedMessages[connectionId][1], {
        type: type,
        payload: message,
      });
    });
  });

  describe('_cleanup', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
      });
    });

    it('should call cleanupPeer for all connections', () => {
      const cleanupPeerStub = sinon.stub(peer, '_cleanupPeer');
      const peers = ['peer1', 'peer2', 'peer3'];

      for (const peerId of peers) {
        peer.connections[peerId] = {};
      }

      peer._cleanup();

      assert.equal(cleanupPeerStub.callCount, peers.length);
      for (const peerId of peers) {
        assert(cleanupPeerStub.calledWith(peerId));
      }
    });

    it('should emit a close event', done => {
      peer.on(Peer.EVENTS.close.key, () => {
        done();
      });

      peer._cleanup();
    });
  });

  describe('_cleanupPeer', () => {
    let peer;
    beforeEach(() => {
      peer = new Peer({
        key: apiKey,
        host: signalingHost,
        port: signalingPort,
      });
    });

    afterEach(() => {
      peer.destroy();
    });

    it('should call close for each connection in the peer', () => {
      const peerId = util.randomToken();
      peer.connections[peerId] = [];

      const spies = [];
      const numConns = 5;
      for (let connIndex = 0; connIndex < numConns; connIndex++) {
        const spy = sinon.spy();
        spies.push(spy);
        peer.connections[peerId].push({ close: spy });
      }

      assert.equal(spies.length, numConns);
      assert.equal(peer.connections[peerId].length, numConns);

      peer._cleanupPeer(peerId);
      for (const spy of spies) {
        assert.equal(spy.callCount, 1);
      }
    });
  });
});
