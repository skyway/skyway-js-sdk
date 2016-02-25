'use strict';

const assert     = require('power-assert');

const Negotiator      = require('../src/negotiator');
const DataConnection  = require('../src/dataConnection');
const MediaConnection = require('../src/mediaConnection');

describe('Negotiator', () => {
  describe('Constructor', () => {
    it('should create a Negotiator object', () => {
      const negotiator = new Negotiator();

      assert(negotiator);
      assert(negotiator instanceof Negotiator);
    });
  });
});
