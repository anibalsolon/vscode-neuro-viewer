import { expect } from 'chai';
import { round, ensureBuffer } from '../../extension/fs-utils';

suite('Util', () => {
  test('fast round', async () => {
    expect(round(10.2)).to.equal(10);
    expect(round(10.5)).to.equal(11);
    expect(round(-10.2)).to.equal(-9);
    expect(round(-10.5)).to.equal(-10);
  });

  test('ensure buffer', async () => {
    const buffer = ensureBuffer('abc');
    expect(buffer.toString()).to.equal('abc');
    expect(ensureBuffer(buffer).toString()).to.equal('abc');
  });
});
