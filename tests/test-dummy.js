require('rootpath')();

var assert    = require('assert');
var Skyway    = require('src/skyway');

describe('SkyWay', function() {
  it('should have parameter test=lalala', function() {
    assert.equal(new Skyway().test, 'lalala');
  });
});
