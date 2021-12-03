const fs = require('fs');
const assert = require('assert');

const utils = require('../../extension/utils');

describe('Slicer', () => {
  it('should slice data', async () => {
    const slicer = new utils.Slicer(3, 10);
    slicer.write(Buffer.from('abcde'));
    slicer.write(Buffer.from('fghij'));
    slicer.write(Buffer.from('klmno'));
    slicer.write(Buffer.from('pqrst'));
    slicer.write(Buffer.from('uvwxy'));
    slicer.write(Buffer.from('z'));
    slicer.end();
    let res = '';
    for await (const chunk of slicer) {
      res += chunk.toString('ascii');
    }
    assert(res === 'defghijklm', res)
  });
  it('should slice data to the end', async () => {
    const slicer = new utils.Slicer(5);
    slicer.write(Buffer.from('abcde'));
    slicer.write(Buffer.from('fghij'));
    slicer.write(Buffer.from('klmno'));
    slicer.write(Buffer.from('pqrst'));
    slicer.write(Buffer.from('uvwxy'));
    slicer.write(Buffer.from('z'));
    slicer.end();
    let res = '';
    for await (const chunk of slicer) {
      res += chunk.toString('ascii');
    }
    assert(res === 'fghijklmnopqrstuvwxyz')
  });
  it('should slice data, skipping some chunks', async () => {
    const slicer = new utils.Slicer(11, 10);
    slicer.write(Buffer.from('abcde'));
    slicer.write(Buffer.from('fghij'));
    slicer.write(Buffer.from('klmno'));
    slicer.write(Buffer.from('pqrst'));
    slicer.write(Buffer.from('uvwxy'));
    slicer.write(Buffer.from('z'));
    slicer.end();
    let res = '';
    for await (const chunk of slicer) {
      res += chunk.toString('ascii');
    }
    assert(res === 'lmnopqrstu', res)
  });
});
