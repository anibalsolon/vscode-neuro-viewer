import { expect } from 'chai';
import { Bufferizer } from '../../extension/utils';

describe('Bufferizer', () => {
  it('should transform data into buffer', async () => {
    const stream = new Bufferizer();
    stream.write([0, 10, 5, NaN]);
    stream.end();
    const res = [];
    for await (const chunk of stream) {
      const int16view = new Int16Array(chunk.buffer);
      res.push(...int16view);
    }
    expect(res).to.deep.equal([0, 10, 5, 0]);
  });
});
