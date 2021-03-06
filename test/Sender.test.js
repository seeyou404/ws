'use strict';

const assert = require('assert');

const PerMessageDeflate = require('../lib/PerMessageDeflate');
const Sender = require('../lib/Sender');

describe('Sender', function () {
  describe('#ctor', function () {
    it('throws TypeError when called without new', function () {
      assert.throws(Sender, TypeError);
    });
  });

  describe('#frameAndSend', function () {
    it('does not modify a masked binary buffer', function () {
      const sender = new Sender({ write: () => {} });
      const buf = Buffer.from([1, 2, 3, 4, 5]);

      sender.frameAndSend(2, buf, true, true);

      assert.ok(buf.equals(Buffer.from([1, 2, 3, 4, 5])));
    });

    it('does not modify a masked text buffer', function () {
      const sender = new Sender({ write: () => {} });
      const text = Buffer.from('hi there');

      sender.frameAndSend(1, text, true, true);

      assert.ok(text.equals(Buffer.from('hi there')));
    });

    it('sets RSV1 bit if compressed', function (done) {
      const sender = new Sender({
        write: (data) => {
          assert.strictEqual(data[0] & 0x40, 0x40);
          done();
        }
      });

      sender.frameAndSend(1, Buffer.from('hi'), true, false, true);
    });
  });

  describe('#send', function () {
    it('compresses data if compress option is enabled', function (done) {
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });
      const sender = new Sender({
        write: (data) => {
          assert.strictEqual(data[0] & 0x40, 0x40);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('hi', { compress: true });
    });

    it('does not compress data for small payloads', function (done) {
      const perMessageDeflate = new PerMessageDeflate();
      const sender = new Sender({
        write: (data) => {
          assert.notStrictEqual(data[0] & 0x40, 0x40);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('hi', { compress: true });
    });

    it('compresses all frames in a fragmented message', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 3 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x40);
          assert.strictEqual(fragments[0].length, 16);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 11);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('123', { compress: true, fin: false });
      sender.send('12', { compress: true, fin: true });
    });

    it('compresses no frames in a fragmented message', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 3 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x00);
          assert.strictEqual(fragments[0].length, 4);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 5);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('12', { compress: true, fin: false });
      sender.send('123', { compress: true, fin: true });
    });

    it('compresses null as first fragment', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x40);
          assert.strictEqual(fragments[0].length, 3);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 13);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send(null, { compress: true, fin: false });
      sender.send('data', { compress: true, fin: true });
    });

    it('compresses empty buffer as first fragment', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x40);
          assert.strictEqual(fragments[0].length, 3);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 13);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send(Buffer.alloc(0), { compress: true, fin: false });
      sender.send('data', { compress: true, fin: true });
    });

    it('compresses null last fragment', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x40);
          assert.strictEqual(fragments[0].length, 17);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 3);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('data', { compress: true, fin: false });
      sender.send(null, { compress: true, fin: true });
    });

    it('compresses empty buffer as last fragment', function (done) {
      const fragments = [];
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });
      const sender = new Sender({
        write: (data) => {
          fragments.push(data);
          if (fragments.length !== 2) return;

          assert.strictEqual(fragments[0][0] & 0x40, 0x40);
          assert.strictEqual(fragments[0].length, 17);
          assert.strictEqual(fragments[1][0] & 0x40, 0x00);
          assert.strictEqual(fragments[1].length, 3);
          done();
        }
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('data', { compress: true, fin: false });
      sender.send(Buffer.alloc(0), { compress: true, fin: true });
    });

    it('handles many send calls while processing without crashing on flush', function (done) {
      const maxMessages = 5000;
      let messageCount = 0;

      const sender = new Sender({
        write: (data) => {
          messageCount++;
          if (messageCount > maxMessages) return done();
        }
      });

      for (let i = 0; i < maxMessages; i++) {
        sender.processing = true;
        sender.send('hi', { compress: false, fin: true, binary: false, mask: false });
      }

      sender.processing = false;
      sender.send('hi', { compress: false, fin: true, binary: false, mask: false });
    });
  });

  describe('#close', function () {
    it('should consume all data before closing', function (done) {
      const perMessageDeflate = new PerMessageDeflate({ threshold: 0 });

      let count = 0;
      const sender = new Sender({
        write: (data) => count++
      }, {
        'permessage-deflate': perMessageDeflate
      });

      perMessageDeflate.accept([{}]);

      sender.send('foo', { compress: true });
      sender.send('bar', { compress: true });
      sender.send('baz', { compress: true });

      sender.close(1000, null, false, (err) => {
        assert.strictEqual(count, 4);
        done(err);
      });
    });
  });
});
