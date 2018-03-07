import assert from 'power-assert';
import util from '../../src/shared/util';

describe('Util', () => {
  describe('validateId', () => {
    it('should be valid when valid id is given', () => {
      const validIds = [
        'ABCD 0123',
        'ABCD_0123',
        'ABCD-0123-abcd-7890',
        'ABCD-0123------------abcd-7890',
      ];
      validIds.forEach(id => {
        assert(util.validateId(id));
      });
    });

    it('should be invalid when invalid id is given', () => {
      const invalidIds = [
        'あいうえお',
        '!@#$%^&&*()',
        'ABCD  0000 ',
        '><script>alert(1);</script>',
      ];
      invalidIds.forEach(id => {
        assert(util.validateId(id) === null);
      });
    });
  });

  describe('validateKey', () => {
    it('should be valid when valid key is given', () => {
      const validKeys = [
        '00000000-0000-0000-0000-000000000000',
        'abcdefgh-1234-5678-jklm-zxcvasdfqwrt',
      ];
      validKeys.forEach(key => {
        assert(util.validateKey(key));
      });
    });

    it('should be invalid when invalid key is given', () => {
      const validKeys = [
        '0-0-0-0',
        'あいうえお',
        '><script>alert(1);</script>',
        '00000000-0000-0000-0000-0000000000001',
      ];
      validKeys.forEach(key => {
        assert(util.validateKey(key) === null);
      });
    });
  });

  describe('randomToken', () => {
    it('should only contain alphanumeric characters', () => {
      assert(/^[a-zA-Z0-9]+$/.exec(util.randomToken()));
    });

    it('should produce distinct outputs when run multiple times', () => {
      // There's a very small possibility that this test will
      // fail because randomID could produce the same number twice
      assert.notEqual(util.randomToken(), util.randomToken());
    });
  });

  describe('Message type conversion', () => {
    it('should correctly convert a Blob to an ArrayBuffer', done => {
      const string = 'foobar';

      const arrayBuffer = new ArrayBuffer(string.length);
      const bufferView = new Uint8Array(arrayBuffer);
      for (let i = 0; i < string.length; i++) {
        bufferView[i] = string.charCodeAt(i);
      }
      const blob = new Blob([arrayBuffer], { type: 'text/plain' });

      util.blobToArrayBuffer(blob, result => {
        assert.deepEqual(result.constructor, ArrayBuffer);
        assert.deepEqual(arrayBuffer, result);
        done();
      });
    });
  });

  describe('isSecure', () => {
    // Test only 'HTTP' becauuse Karma only runs on 'HTTP'
    it('should return false if HTTP', () => {
      assert(util.isSecure(location.protocol) === false);
    });
  });

  describe('detectBrowser', () => {
    // Karma only runs on 'chrome'
    it('should return chrome', () => {
      assert(util.detectBrowser().name === 'chrome');
    });

    it('should return major, minor and patch versions', () => {
      const { major, minor, patch } = util.detectBrowser();
      assert(typeof major === 'number');
      assert(typeof minor === 'number');
      assert(typeof patch === 'number');
    });
  });
});
