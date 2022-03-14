import { expect } from 'chai';
import { Normalizer } from '../../extension/utils';

suite('Normalizer', () => {
  test('should normalize (!) data', async () => {
    const stream = new Normalizer(0, 10, -5, 5);
    stream.write([0, 10, 5]);
    stream.end();
    const res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    expect(res).to.deep.equal([-5, 5, 0]);
  });
  test('should normalize data, with symmetric values', async () => {
    const stream = new Normalizer(0, 10, 0, 100);
    stream.write([-10, 0, 10]);
    stream.end();
    const res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    expect(res).to.deep.equal([-100, 0, 100]);
  });
});
