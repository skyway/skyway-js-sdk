'use strict';

const assert     = require('power-assert');

const Negotiator      = require('../src/negotiator');
const DataConnection  = require('../src/dataConnection');
const MediaConnection = require('../src/mediaConnection');

describe('Negotiator', () => {
  describe('Constructor', () => {
    it('should be initialized with a mediaConnection', () => {
      const mc = new MediaConnection({});
      const negotiator = new Negotiator(mc);

      assert(negotiator._connection === mc);
    });

    it('should be initialized with a socket and a dataConnection', () => {
      const dc = new DataConnection({});
      const negotiator = new Negotiator(dc);

      assert(negotiator._connection === dc);
    });

    it('should be fail when called without connection', () => {
      let negotiator;
      try {
        negotiator = new Negotiator();
      } catch (err) {
        assert(negotiator === undefined);
        assert(err);
      }
    });
  });
});
