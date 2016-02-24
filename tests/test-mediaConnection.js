'use strict';

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let MediaConnection;

describe('MediaConnection', () => {
  let stub;
  let startSpy;

  beforeEach(() => {
    stub = sinon.stub();
    startSpy = sinon.spy();

    stub.returns({
      startConnection: startSpy
    });

    Connection = proxyquire(
      '../src/connection',
      {'./negotiator': stub}
    );
    MediaConnection = proxyquire(
      '../src/mediaConnection',
      {'./connection': Connection}
    );
  });

  afterEach(() => {
    startSpy.reset();
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const mc = new MediaConnection({_stream: {}});

      assert(mc);
      assert(startSpy.calledOnce);
    });

    it('should store any messages passed in when created', () => {
      const mc = new MediaConnection(
        {_stream: {}, _queuedMessages: ['message']}
      );
      assert.deepEqual(mc.options._queuedMessages, ['message']);
    });
  });

  describe('Add Stream', () => {
    it('should set remoteStream upon addStream being invoked', () => {
      const mc = new MediaConnection({_stream: {}});

      let spy = sinon.spy(mc, 'addStream');

      mc.addStream('fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert.equal(mc.remoteStream, 'fakeStream');

      spy.restore();
    });

    it('should emit a \'stream\' event upon addStream being invoked', () => {
      const mc = new MediaConnection({_stream: {}});

      let spy = sinon.spy(mc, 'emit');

      mc.addStream('fakeStream');

      assert(mc);
      assert(spy.calledOnce);
      assert(spy.calledWith('stream', 'fakeStream') === true);

      spy.restore();
    });
  });
});
