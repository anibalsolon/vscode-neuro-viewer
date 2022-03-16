import { expect } from 'chai';
import { Slicer } from '../../extension/fs-utils';

suite('Slicer', () => {
  test('should slice data', async () => {
    const slicer = new Slicer(3, 10);
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
    expect(res).to.equal('defghijklm', res);
  });
  test('should slice data to the end', async () => {
    const slicer = new Slicer(5);
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
    expect(res).to.equal('fghijklmnopqrstuvwxyz');
  });
  test('should slice data, skipping some chunks', async () => {
    const slicer = new Slicer(11, 10);
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
    expect(res).to.equal('lmnopqrstu', res);
  });
});
