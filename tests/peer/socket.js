import assert from 'power-assert';
import SocketIO from 'socket.io-client';
import sinon from 'sinon';

import socketInjector from 'inject-loader!../../src/peer/socket';
import config from '../../src/shared/config';

describe('Socket', () => {
  const serverPort = 5080;
  let Socket;
  let socket;
  let socketIoClientStub;
  let eventSpy;

  const apiKey = 'apiKey';
  const token = 'token';
  const peerId = 'peerId';

  beforeEach(() => {
    socketIoClientStub = sinon.stub(SocketIO, 'Socket');
    eventSpy = sinon.spy();

    socketIoClientStub.returns({
      // socket.io is not standard eventEmitter API
      // fake messages by calling io._fakeMessage[messagetype](data)
      on: function(event, callback) {
        if (!this._fakeMessage) {
          this._fakeMessage = {};
        }
        this._fakeMessage[event] = callback;
      },
      emit: eventSpy,
      disconnect: eventSpy,
      connected: true,
      io: { opts: { query: '' } },
    });

    Socket = socketInjector({
      'socket.io-client': socketIoClientStub,
    }).default;

    socket = new Socket(apiKey, {
      host: 'localhost',
      port: serverPort,
    });
  });

  afterEach(() => {
    socketIoClientStub.restore();
    eventSpy.resetHistory();
  });

  describe('Connecting to the server', () => {
    const openMessage = { peerId: peerId };
    describe("when credential isn't given", () => {
      describe('when host and port are specified', () => {
        it('should be able to connect to a server', done => {
          socket.start(undefined, token).then(() => {
            assert(socketIoClientStub.called);
            socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
              openMessage
            );
            assert.equal(socket.isOpen, true);
            done();
          });
        });

        it('should be able to connect to a server with a PeerID', done => {
          socket.start(peerId, token).then(() => {
            assert(socketIoClientStub.called);
            socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
              openMessage
            );
            assert.equal(socket.isOpen, true);
            done();
          });
        });
      });
    });

    describe('when credential is given', () => {
      it('should be able to connect to a server with credential', done => {
        socket
          .start(peerId, token, {
            timestamp: 1491285508,
            ttl: 1000,
            credential: 'Credential',
          })
          .then(() => {
            assert(socketIoClientStub.called);
            socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
              openMessage
            );
            assert.equal(socket.isOpen, true);
            done();
          });
      });
    });

    describe('when dispatcher host and port are specified', () => {
      const dispatcherHost = 'dispatcher.io';
      const dispatcherPort = 443;
      const dispatcherSecure = true;

      const signalingHost = 'signaling.io';
      const signalingPort = 443;
      const signalingSecure = true;
      let getSignalingServerStub;

      beforeEach(() => {
        socket = new Socket(apiKey, {
          dispatcherHost: dispatcherHost,
          dispatcherPort: dispatcherPort,
          dispatcherSecure: dispatcherSecure,
        });

        getSignalingServerStub = sinon.stub(socket, '_getSignalingServer');
        getSignalingServerStub.returns(
          Promise.resolve({
            host: signalingHost,
            port: signalingPort,
            secure: signalingSecure,
          })
        );
      });

      afterEach(() => {
        getSignalingServerStub.restore();
      });

      it('should set _dispatcherUrl', () => {
        assert.equal(
          socket._dispatcherUrl,
          `https://${dispatcherHost}:${dispatcherPort}/signaling`
        );
      });

      it('should get set the signalingServerUrl from _getSignalingServer', done => {
        socket.start(null, token).then(() => {
          const httpProtocol = signalingSecure ? 'https://' : 'http://';
          const signalingServerUrl = `${httpProtocol}${signalingHost}:${signalingPort}`;
          assert.equal(socket.signalingServerUrl, signalingServerUrl);

          done();
        });
      });
    });
  });

  describe('updateCredential', () => {
    beforeEach(done => {
      socket.start(peerId, token).then(() => done());
    });
    it('should update queryString in this._io and send message to the server', () => {
      const openMessage = { peerId: peerId };
      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );
      const newCredential = {
        timestamp: 100,
        ttl: 1000,
        authToken: 'newCredential',
      };
      // set current queryString manually
      socket._io.io.opts.query = `apiKey=${apiKey}&peerId=${peerId}&credential=hogehoge`;
      socket.updateCredential(newCredential);
      // Make sure the queryString contains new credential.
      assert(
        socket._io.io.opts.query.indexOf(
          encodeURIComponent(newCredential.authToken)
        ) !== -1
      );
      // Also sure the socket.send() is called
      assert(
        eventSpy.calledWith(
          config.MESSAGE_TYPES.CLIENT.UPDATE_CREDENTIAL.key,
          newCredential
        )
      );
    });
  });

  describe('close', () => {
    it('should close socket and have disconnect status set', done => {
      const openMessage = { peerId: peerId };

      socket.start(peerId, token).then(() => {
        assert.equal(socket.isOpen, false);

        socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
          openMessage
        );
        assert.equal(socket.isOpen, true);

        socket.close();
        assert.equal(socket.isOpen, false);

        done();
      });
    });

    it('should close socket and stop pings', done => {
      const apiKey = 'apiKey';
      const peerId = 'peerId';
      const token = 'token';
      const openMessage = { peerId: peerId };

      const socket = new Socket(apiKey, {
        host: 'localhost',
        port: serverPort,
      });
      const stopPingsSpy = sinon.spy(socket, '_stopPings');

      socket.start(peerId, token).then(() => {
        socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
          openMessage
        );
        assert.equal(stopPingsSpy.callCount, 0);

        socket.close();
        assert.equal(stopPingsSpy.callCount, 1);

        done();
      });
    });
  });

  describe('Sending data', () => {
    beforeEach(done => {
      socket.start(undefined, token).then(() => done());
    });

    it('should be able to send some data', () => {
      const openMessage = { peerId: peerId };
      const data = { type: 'MSG', message: 'hello world' };

      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );
      socket.send(data.type, data.message);
      assert(eventSpy.calledWith(data.type, data.message));
    });

    it('should not send data without a type set', () => {
      const openMessage = { peerId: peerId };
      const data = { message: 'hello world' };

      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );
      socket.send(undefined, data.message);
      assert.deepEqual(eventSpy.args[0], ['error', 'Invalid message']);
    });

    it.skip('should send queued messages upon connecting', () => {
      const openMessage = { peerId: peerId };
      const data1 = { type: 'MSG', message: 'hello world' };
      const data2 = { type: 'MSG', message: 'goodbye world' };

      assert.equal(socket.isOpen, false);

      // First pass - No peerID
      socket.send(data1.type, data1.message);
      assert.deepEqual(socket._queue, [data1]);

      // Second pass - peerID set, queued messages sent
      // TODO: Headache zone. This invocation of fakeMessage causes a freeze.
      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );
      assert.deepEqual(socket._queue, []);
      assert.deepEqual(eventSpy.args[0], ['MSG', data1.message]);

      // Third pass - additional send() invocation
      socket.send(data2.type, data2.message);
      assert.deepEqual(socket._queue, []);
      assert.deepEqual(eventSpy.args[1], ['MSG', data2.message]);
    });
  });

  describe('_setupMessageHandlers', () => {
    let emitSpy;
    const openMessage = { peerId: peerId };
    let startPingsStub;

    beforeEach(done => {
      emitSpy = sinon.spy(socket, 'emit');

      startPingsStub = sinon.stub(socket, '_startPings');
      socket.start(undefined, token).then(() => done());
    });

    afterEach(() => {
      startPingsStub.restore();
      emitSpy.restore();
    });

    it("should set _isOpen and emit peerId on _io 'OPEN' messages", () => {
      assert.equal(eventSpy.callCount, 0);

      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );

      assert(socket._isOpen);
      assert.equal(emitSpy.callCount, 1);
      assert(
        emitSpy.calledWith(config.MESSAGE_TYPES.SERVER.OPEN.key, openMessage)
      );
    });

    it("should update the _io query on 'OPEN' messages", () => {
      const openMessage = { peerId: peerId };

      const peerIdRegex = new RegExp(`&peerId=${peerId}`);

      let query = socket._io.io.opts.query;
      assert.equal(socket._isPeerIdSet, false);
      assert.equal(peerIdRegex.test(query), false);

      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );

      query = socket._io.io.opts.query;
      assert(socket._isPeerIdSet);
      assert(peerIdRegex.test(query));
    });

    it("should start sending pings on 'OPEN' messages", () => {
      const peerId = 'peerId';
      const openMessage = { peerId: peerId };

      socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
        openMessage
      );

      assert.equal(startPingsStub.callCount, 1);
    });

    it('should emit all non-OPEN message types on socket', () => {
      assert.equal(emitSpy.callCount, 0);

      config.MESSAGE_TYPES.SERVER.enums.forEach(type => {
        if (type.key === config.MESSAGE_TYPES.SERVER.OPEN.key) {
          return;
        }

        const message = Symbol();
        socket._io._fakeMessage[type.key](message);

        assert(emitSpy.calledWith(type.key, message));
      });

      assert.equal(
        emitSpy.callCount,
        config.MESSAGE_TYPES.SERVER.enums.length - 1
      );
    });
  });

  describe('pings', () => {
    let socket;
    const peerId = 'peerId';
    const token = 'token';
    let clock;
    const openMessage = { peerId: peerId };

    beforeEach(done => {
      clock = sinon.useFakeTimers();
      const apiKey = 'apiKey';
      socket = new Socket(apiKey, {
        host: 'localhost',
        port: serverPort,
      });

      socket.start(peerId, token).then(() => {
        socket._io._fakeMessage[config.MESSAGE_TYPES.SERVER.OPEN.key](
          openMessage
        );
        done();
      });
    });

    afterEach(() => {
      clock.restore();
      clearInterval(socket._pingIntervalId);
    });

    describe('_startPings', () => {
      it('should send a ping message every ping interval', () => {
        const numberOfChecks = 5;

        socket._startPings();

        assert.equal(eventSpy.callCount, 0);
        for (let i = 0; i < numberOfChecks; i++) {
          clock.tick(config.pingInterval);

          assert(
            eventSpy.getCall(i).calledWith(config.MESSAGE_TYPES.CLIENT.PING.key)
          );
          assert.equal(eventSpy.callCount, i + 1);
        }
      });
    });

    describe('_stopPings', () => {
      it('should clear the interval and set it to undefined', function() {
        socket._startPings();
        socket._stopPings();

        assert.equal(socket._pingIntervalId, undefined);

        clock.tick(config.pingInterval * 10);

        assert.equal(eventSpy.callCount, 0);
      });
    });
  });

  describe('_getSignalingServer', () => {
    let requests = [];
    let xhr;
    const fakeDomain = 'fake.domain';
    beforeEach(done => {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = request => {
        requests.push(request);
      };

      socket.start(undefined, apiKey).then(() => done());

      socket._dispatcherUrl = `https://${config.DISPATCHER_HOST}:${config.DISPATCHER_PORT}`;
    });

    afterEach(() => {
      xhr.restore();
      requests = [];
    });

    it('should send a "GET" request to the dispatcher URL', done => {
      const result = { domain: fakeDomain };

      socket
        ._getSignalingServer()
        .then(() => {
          assert.equal(requests.length, 1);

          // TODO: Headache zone. Comparing vs the variable `url` causes a freeze.
          // let url = `https://${config.DISPATCHER_HOST}:${config.DISPATCHER_PORT}/signaling`;
          // assert.equal(requests[0].url, url);
          assert.equal(requests[0].method, 'GET');
          done();
        })
        .catch(err => {
          assert.fail(
            'Failed to get signaling server options from dispatcher.',
            err
          );
          done();
        });

      requests[0].respond(200, {}, JSON.stringify(result));
    });

    describe('when response from dispatcher is including server domain', () => {
      it('it should resolve with object including host', done => {
        const result = { domain: fakeDomain };

        socket
          ._getSignalingServer()
          .then(res => {
            assert.deepEqual(res, {
              host: fakeDomain,
              port: 443,
              secure: true,
            });
            done();
          })
          .catch(err => {
            assert.fail(err);
            done();
          });

        requests[0].respond(200, {}, JSON.stringify(result));
      });
    });

    describe('when response from dispatcher is empty', () => {
      it('should reject', done => {
        const result = {};

        socket
          ._getSignalingServer()
          .then(() => {
            assert.fail('This should be rejected.');
            done();
          })
          .catch(err => {
            assert(err);
            done();
          });

        requests[0].respond(200, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 500', () => {
      it('should reject', done => {
        const result = {
          error: {
            code: 500,
            message: 'Connection failed. Unexpected response: 500',
          },
        };

        socket
          ._getSignalingServer()
          .then(() => {
            assert.fail('This should be rejected.');
            done();
          })
          .catch(err => {
            assert(err);
            assert.equal(
              err.message,
              'Connection failed. Unexpected response: 500'
            );
            done();
          });

        requests[0].respond(500, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 404', () => {
      it('should reject', done => {
        const result = {
          error: {
            code: 404,
            message: 'Connection failed. Unexpected response: 404',
          },
        };
        socket
          ._getSignalingServer()
          .then(() => {
            assert.fail('This should be rejected.');
            done();
          })
          .catch(err => {
            assert(err);
            assert.equal(
              err.message,
              'Connection failed. Unexpected response: 404'
            );
            done();
          });

        requests[0].respond(404, {}, JSON.stringify(result));
      });
    });

    describe('when status code from dispatcher is 405', () => {
      it('should reject', done => {
        const result = {
          error: {
            code: 405,
            message: 'Connection failed. Unexpected response: 405',
          },
        };

        socket
          ._getSignalingServer()
          .then(() => {
            assert.fail('This should be rejected.');
            done();
          })
          .catch(err => {
            assert(err);
            assert.equal(
              err.message,
              'Connection failed. Unexpected response: 405'
            );
            done();
          });

        requests[0].respond(405, {}, JSON.stringify(result));
      });
    });
  });
});
