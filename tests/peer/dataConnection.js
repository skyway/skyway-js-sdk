import assert from 'power-assert';
import sinon from 'sinon';
import BinaryPack from 'js-binarypack';

import util from '../../src/shared/util';
import config from '../../src/shared/config';
import Negotiator from '../../src/peer/negotiator';

import connectionInjector from 'inject-loader!../../src/peer/connection';
import dataConnectionInjector from 'inject-loader!../../src/peer/dataConnection';

let Connection;
let DataConnection;

describe('DataConnection', () => {
  let negotiatorStub;
  let startSpy;
  let cleanupSpy;
  let answerSpy;
  let candidateSpy;

  beforeEach(() => {
    // Negotiator stub and spies
    negotiatorStub = sinon.stub();
    startSpy = sinon.spy();
    cleanupSpy = sinon.spy();
    answerSpy = sinon.spy();
    candidateSpy = sinon.spy();

    negotiatorStub.returns({
      on: function(event, callback) {
        this[event] = callback;
      },
      emit: function(event, arg) {
        this[event](arg);
      },
      startConnection: startSpy,
      cleanup: cleanupSpy,
      handleAnswer: answerSpy,
      handleCandidate: candidateSpy,
    });
    // hoist statics
    negotiatorStub.EVENTS = Negotiator.EVENTS;

    Connection = connectionInjector({ './negotiator': negotiatorStub }).default;
    DataConnection = dataConnectionInjector({ './connection': Connection })
      .default;
  });

  afterEach(() => {
    startSpy.resetHistory();
    cleanupSpy.resetHistory();
    answerSpy.resetHistory();
    candidateSpy.resetHistory();
  });

  describe('Constructor', () => {
    it('should store any messages passed in when created', () => {
      const dc = new DataConnection('remoteId', {
        queuedMessages: ['message'],
      });
      assert.deepEqual(dc._options.queuedMessages, ['message']);
    });

    it('should set properties from arguments properly', () => {
      const id = 'remoteId';
      const label = 'label';
      const dcInit = { ordered: false };
      const serialization = 'binary';
      const metadata = 'meta';
      const options = {
        label: label,
        dcInit: dcInit,
        serialization: serialization,
        metadata: metadata,
      };

      const dc = new DataConnection(id, options);
      assert.equal(dc.type, 'data');
      assert.equal(dc.remoteId, id);
      assert.equal(dc.peer, id);
      assert.equal(dc.label, label);
      assert.equal(dc.dcInit, dcInit);
      assert.equal(dc.serialization, serialization);
      assert.equal(dc.metadata, metadata);
      assert.equal(dc._options, options);
    });

    it('should throw an error if serialization is not valid', done => {
      let dc;
      try {
        dc = new DataConnection('remoteId', { serialization: 'foobar' });
      } catch (e) {
        assert(dc === undefined);
        done();
      }
    });

    it('default serialization should be binary', () => {
      const dc = new DataConnection('remoteId', {});

      assert(dc.serialization === 'binary');
    });
  });

  describe('Initialize', () => {
    it('should appropriately set and configure dc upon intialization', () => {
      const dcObj = { test: 'foobar' };

      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, dcObj);

      assert(dc._dc === dcObj);
      assert(dc._dc.onopen);
      assert(dc._dc.onmessage);
      assert(dc._dc.onclose);
    });

    it('should open the DataConnection and emit upon _dc.onopen()', () => {
      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

      const spy = sinon.spy(dc, 'emit');

      assert.equal(dc.open, false);
      dc._dc.onopen();
      assert.equal(dc.open, true);
      assert(spy.calledOnce);

      spy.resetHistory();
    });

    it('should handle a message upon _dc.onmessage()', () => {
      const message = 'foobar';

      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

      const spy = sinon.spy(dc, '_handleDataMessage');

      dc._dc.onmessage({ data: message });
      assert(spy.calledOnce);
      assert.deepEqual(spy.args[0][0], { data: message });

      spy.resetHistory();
    });

    it('should close the DataConnection upon _dc.onclose()', () => {
      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

      const spy = sinon.spy(dc, 'close');
      dc._dc.readyState = 'closed';
      dc._dc.onclose();
      assert(spy.calledOnce);

      spy.resetHistory();
    });
  });

  describe('startConnection', () => {
    it('should process any queued messages after startConnection is called', async () => {
      const messages = [
        { type: config.MESSAGE_TYPES.SERVER.ANSWER.key, payload: 'message' },
      ];

      const spy = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer').callsFake(spy);
      const dc = new DataConnection('remoteId', { queuedMessages: messages });
      await dc.startConnection();

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy.calledOnce, true);

      spy.resetHistory();
    });

    it('should correctly handle ALL of multiple queued messages after startConnection is called', async () => {
      const messages = [
        { type: config.MESSAGE_TYPES.SERVER.ANSWER.key, payload: 'message1' },
        {
          type: config.MESSAGE_TYPES.SERVER.CANDIDATE.key,
          payload: 'message2',
        },
      ];

      const spy1 = sinon.spy();
      const spy2 = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer').callsFake(spy1);
      sinon.stub(DataConnection.prototype, 'handleCandidate').callsFake(spy2);

      const dc = new DataConnection('remoteId', { queuedMessages: messages });
      await dc.startConnection();

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy1.calledOnce, true);
      assert.equal(spy2.calledOnce, true);
    });

    it('should not process any invalid queued messages', async () => {
      const messages = [{ type: 'WRONG', payload: 'message' }];

      const spy1 = sinon.spy();
      const spy2 = sinon.spy();
      sinon.stub(DataConnection.prototype, 'handleAnswer').callsFake(spy1);
      sinon.stub(DataConnection.prototype, 'handleCandidate').callsFake(spy2);

      const dc = new DataConnection('remoteId', { queuedMessages: messages });
      await dc.startConnection();

      assert.deepEqual(dc._queuedMessages, []);
      assert.equal(spy1.called, false);
      assert.equal(spy2.called, false);
    });
  });

  describe('_setupNegotiatorMessageHandlers', () => {
    let dc;
    beforeEach(() => {
      dc = new DataConnection('remoteId', {});
    });

    it("should emit 'candidate' on negotiator 'iceCandidate' event", done => {
      const candidate = Symbol();
      dc.on(Connection.EVENTS.candidate.key, connectionCandidate => {
        assert(connectionCandidate);
        assert.equal(connectionCandidate.candidate, candidate);
        assert.equal(connectionCandidate.dst, dc.remoteId);
        assert.equal(connectionCandidate.connectionId, dc.id);
        assert.equal(connectionCandidate.connectionType, dc.type);
        done();
      });

      dc._negotiator.emit(Negotiator.EVENTS.iceCandidate.key, candidate);
    });

    it("should emit 'answer' on negotiator 'answerCreated' event", done => {
      const answer = Symbol();
      dc.on(Connection.EVENTS.answer.key, connectionCandidate => {
        assert(connectionCandidate);
        assert.equal(connectionCandidate.answer, answer);
        assert.equal(connectionCandidate.dst, dc.remoteId);
        assert.equal(connectionCandidate.connectionId, dc.id);
        assert.equal(connectionCandidate.connectionType, dc.type);
        done();
      });

      dc._negotiator.emit(Negotiator.EVENTS.answerCreated.key, answer);
    });

    it("should emit 'offer' on negotiator 'offerCreated' event", done => {
      const offer = Symbol();
      dc.on(Connection.EVENTS.offer.key, connectionOffer => {
        assert(connectionOffer);
        assert.equal(connectionOffer.offer, offer);
        assert.equal(connectionOffer.dst, dc.remoteId);
        assert.equal(connectionOffer.connectionId, dc.id);
        assert.equal(connectionOffer.connectionType, dc.type);
        assert.equal(connectionOffer.serialization, dc.serialization);
        assert.equal(connectionOffer.label, dc.label);
        assert.equal(connectionOffer.dcInit, dc.dcInit);
        assert.equal(connectionOffer.metadata, dc.metadata);
        done();
      });

      dc._negotiator.emit(Negotiator.EVENTS.offerCreated.key, offer);
    });

    it("should cleanup the connection on negotiator 'iceConnectionFailed' event", () => {
      dc.open = true;
      const spy = sinon.spy(dc, 'close');

      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});
      dc._dc.readyState = 'closed';
      dc._negotiator.emit(Negotiator.EVENTS.iceConnectionFailed.key);

      assert(spy.calledOnce);
      assert.equal(dc.open, false);
    });
  });

  describe('_isUnreliableDCInit', () => {
    let dc;
    beforeEach(() => {
      dc = new DataConnection('remoteId', {});
    });

    it('should enable unreliable mode with valid props', () => {
      const res = dc._isUnreliableDCInit({ maxRetransmits: 100 });
      assert(res);

      const res2 = dc._isUnreliableDCInit({ maxPacketLifeTime: 100 });
      assert(res2);
    });

    it('should not enable unreliable mode with invalid props', () => {
      const res = dc._isUnreliableDCInit({ ordered: false });
      assert.equal(res, false);

      const res2 = dc._isUnreliableDCInit({ foo: 100 });
      assert.equal(res2, false);
    });
  });

  describe('Handle Message', () => {
    describe('when serialization is binary', () => {
      it('should correctly unpack a string message', done => {
        const message = 'foobar.　ほげホゲ文字化け。éü£ (ಠل͜ಠ)( ͡° ͜ʖ ͡°)(ง◕ᴥ◕)ง';
        const dataMeta = {
          id: 'test',
          index: 0,
          totalParts: 1,
          data: BinaryPack.pack(message),
          type: typeof message,
        };

        const dc = new DataConnection('remoteId');
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          assert.equal(data, message);
          done();
        });

        util.blobToArrayBuffer(BinaryPack.pack(dataMeta), ab => {
          dc._handleDataMessage({ data: ab });
        });
      });

      it('should correctly unpack an empty string message', done => {
        const message = '';
        const dataMeta = {
          id: 'test',
          index: 0,
          totalParts: 1,
          data: BinaryPack.pack(message),
          type: typeof message,
        };

        const dc = new DataConnection('remoteId');
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          assert.equal(data, message);
          done();
        });

        util.blobToArrayBuffer(BinaryPack.pack(dataMeta), ab => {
          dc._handleDataMessage({ data: ab });
        });
      });

      it('should correctly unpack JSON messages', done => {
        const jsonObj = { name: 'testObject' };
        // JSON data is binary packed for compression purposes
        const packedJson = BinaryPack.pack(jsonObj);

        const dataMeta = {
          id: 'test',
          index: 0,
          totalParts: 1,
          data: packedJson,
          type: 'json',
        };

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          assert.deepEqual(data, jsonObj);
          done();
        });

        util.blobToArrayBuffer(BinaryPack.pack(dataMeta), ab => {
          dc._handleDataMessage({ data: ab });
        });
      });

      it('should correctly handle Blob messages', done => {
        const message = 'foobar';
        const blob = new Blob([message], { type: 'text/plain' });

        const dataMeta = {
          id: 'test',
          index: 0,
          totalParts: 1,
          data: BinaryPack.pack(blob),
          type: blob.type,
        };

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          // We want to check that the received data is an ArrayBuffer
          assert.deepEqual(data, blob);
          done();
        });

        util.blobToArrayBuffer(BinaryPack.pack(dataMeta), ab => {
          dc._handleDataMessage({ data: ab });
        });
      });

      it('should be able to recombine chunked messages', done => {
        // Chunk size is 16300
        // Each char is 2 bytes
        const len = config.maxChunkSize + 1000;
        const string = new Array(len + 1).join('a');
        const packedString = BinaryPack.pack(string);

        const slice1 = packedString.slice(0, config.maxChunkSize);
        const slice2 = packedString.slice(
          config.maxChunkSize,
          config.maxChunkSize * 2
        );

        const dataMeta1 = {
          id: 'test',
          index: 0,
          totalParts: 2,
          data: slice1,
          type: typeof slice1,
        };
        const dataMeta2 = {
          id: 'test',
          index: 1,
          totalParts: 2,
          data: slice2,
          type: typeof slice2,
        };

        const dc = new DataConnection('remoteId');
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          // Receives the reconstructed string after all chunks have been handled
          assert.deepEqual(data, string);
          done();
        });

        util.blobToArrayBuffer(BinaryPack.pack(dataMeta1), ab1 => {
          dc._handleDataMessage({ data: ab1 });
        });
        util.blobToArrayBuffer(BinaryPack.pack(dataMeta2), ab2 => {
          dc._handleDataMessage({ data: ab2 });
        });
      });
    });

    describe('when serialization is json', () => {
      it('should correctly parse JSON messages', done => {
        const jsonObj = { name: 'testObject' };

        const dc = new DataConnection('remoteId', { serialization: 'json' });
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          assert.deepEqual(data, jsonObj);
          done();
        });

        dc._handleDataMessage({ data: JSON.stringify(jsonObj) });
      });
    });

    describe('when serialization is none', () => {
      it('should receive objects exactly as received with no processing', done => {
        const message = Symbol();

        const dc = new DataConnection('remoteId', { serialization: 'none' });
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});

        dc.on(DataConnection.EVENTS.data.key, data => {
          assert.equal(data, message);
          done();
        });

        dc._handleDataMessage({ data: message });
      });
    });
  });

  describe('Send', () => {
    it('should emit an error if send() is called while DC is not open', done => {
      const dc = new DataConnection('remoteId', {});
      assert.equal(dc.open, false);

      dc.on(DataConnection.EVENTS.error.key, error => {
        assert(error instanceof Error);
        done();
      });

      dc.send('foobar');
    });

    it('should not call dc.send if called with no arguments', done => {
      const sendSpy = sinon.spy();

      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
      dc._dc.onopen();

      setTimeout(() => {
        assert(sendSpy.callCount === 0);
        done();
      }, 100);

      dc.send(null);
      dc.send(undefined);
      dc.send();
    });

    describe('when serialization is binary', () => {
      it('should correctly send string messages', done => {
        const message = 'foobar.　ほげホゲ文字化け。éü£ (ಠل͜ಠ)( ͡° ͜ʖ ͡°)(ง◕ᴥ◕)ง';
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const unpacked = BinaryPack.unpack(sendSpy.args[0][0]);
          const reconstructed = BinaryPack.unpack(unpacked.data);
          assert.equal(reconstructed, message);
          done();
        }, 100);

        dc.send(message);
      });

      it('should correctly send empty string', done => {
        const message = '';
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const unpacked = BinaryPack.unpack(sendSpy.args[0][0]);
          const reconstructed = BinaryPack.unpack(unpacked.data);
          assert.equal(reconstructed, message);
          done();
        }, 100);

        dc.send(message);
      });

      it('should correctly pack and send JSON data', done => {
        const jsonObj = { name: 'testObject' };
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const unpacked = BinaryPack.unpack(sendSpy.args[0][0]);
          const data = BinaryPack.unpack(unpacked.data);
          assert.deepEqual(data, jsonObj);
          done();
        }, 100);

        dc.send(jsonObj);
      });

      it('should correctly send Blob data', done => {
        const message = 'foobar';
        const blob = new Blob([message], { type: 'text/plain' });
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const unpacked = BinaryPack.unpack(sendSpy.args[0][0]);
          assert.deepEqual(unpacked.data, blob);
          done();
        }, 100);

        dc.send(blob);
      });

      it('should correctly send a File', done => {
        const mimeType = 'text/plain;charset=utf-8;';
        const file = new File(['foobar'], 'testfile', {
          type: mimeType,
        });

        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const unpacked = BinaryPack.unpack(sendSpy.args[0][0]);
          assert.deepEqual(unpacked.data, file);
          done();
        }, 100);

        dc.send(file);
      });

      it('should correctly chunk and send a large message', done => {
        const len = config.maxChunkSize + 1000;
        const string = new Array(len + 1).join('a');

        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledTwice);

          const unpacked1 = BinaryPack.unpack(sendSpy.args[0][0]);
          const unpacked2 = BinaryPack.unpack(sendSpy.args[1][0]);

          const ab = util.joinArrayBuffers([unpacked1.data, unpacked2.data]);
          const data = BinaryPack.unpack(ab);
          assert.deepEqual(data, string);
          done();
        }, 100);

        dc.send(string);
      });
    });

    describe('when serialization is json', () => {
      it('should correctly stringify and send JSON data', done => {
        const jsonObj = { name: 'testObject' };
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', { serialization: 'json' });
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const data = JSON.parse(sendSpy.args[0][0]);
          assert.deepEqual(data, jsonObj);
          done();
        }, 100);

        dc.send(jsonObj);
      });
    });

    describe('when serialization is none', () => {
      it('should send any data exactly as is with no processing', done => {
        const message = Symbol();
        const sendSpy = sinon.spy();

        const dc = new DataConnection('remoteId', { serialization: 'none' });
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, { send: sendSpy });
        dc._dc.onopen();

        setTimeout(() => {
          assert(sendSpy.calledOnce);

          const data = sendSpy.args[0][0];
          assert.equal(data, message);
          done();
        }, 100);

        dc.send(message);
      });
    });
  });

  describe('close', () => {
    it('should close the socket and call the negotiator to cleanup on close() when _dc is none', () => {
      const dc = new DataConnection('remoteId', {});

      // Force to be open
      dc.open = true;

      dc.close();
      assert.equal(dc.open, false);
      assert(cleanupSpy.called);
    });

    it('should dc.onclose be overridden and do nothing when the readyState of _dc is closing', () => {
      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {
        close: sinon.stub(),
      });
      dc._dc.onopen();
      dc._dc.readyState = 'closing';
      const dummyOnClose = { hoge: 'hoo' };
      dc._dc.onclose = dummyOnClose;

      dc.close();

      assert.notEqual(dc._dc.onclose, dummyOnClose);
      assert.equal(dc.open, true);
      assert.equal(dc._isOnOpenCalled, true);
      assert(dc._dc.close.notCalled);
    });

    it('should super.close be called and _isOnOpencalled should be false when the readyState of _dc is closed', () => {
      const dc = new DataConnection('remoteId', {});
      dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {});
      dc._dc.onopen();
      dc._dc.readyState = 'closed';

      dc.close();

      assert.equal(dc.open, false);
      assert.equal(dc._isOnOpenCalled, false);
    });

    it('should _dc.onclose has been overwritten and _dc.close() has been called, then super.close has been called and isonopencalled has been set to false when the readyState of _dc is open or connecting', () => {
      for (const readyState of ['open', 'connecting']) {
        const dc = new DataConnection('remoteId', {});
        dc._negotiator.emit(Negotiator.EVENTS.dcCreated.key, {
          close: sinon.stub(),
        });
        dc._dc.onopen();
        dc._dc.readyState = readyState;
        const dummyOnClose = { hoge: 'hoo' };
        dc._dc.onclose = dummyOnClose;

        dc.close();

        assert.notEqual(dc._dc.onclose, dummyOnClose);
        assert(dc._dc.close.calledOnce);

        dc._dc.onclose();

        assert.equal(dc.open, false);
        assert.equal(dc._isOnOpenCalled, false);
      }
    });
  });
});
