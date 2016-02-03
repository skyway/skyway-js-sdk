var assert    = require('assert');
var Skyway    = require('../src/peer');

describe('SkyWay', function() {
  it('should have parameter test=lalala', function() {
    assert.equal(new Skyway().test, 'lalala');
  });
});
