'use strict';

const assert     = require('power-assert');
const proxyquire = require('proxyquire');
const sinon      = require('sinon');

let Connection;
let DataConnection;

describe('DataConnection', () => {
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
    DataConnection = proxyquire(
      '../src/dataConnection',
      {'./connection': Connection}
    );
  });

  describe('Constructor', () => {
    it('should call negotiator\'s startConnection method when created', () => {
      const dc = new DataConnection({});

      assert(dc);
      assert(startSpy.calledOnce);
    });
  });
});
