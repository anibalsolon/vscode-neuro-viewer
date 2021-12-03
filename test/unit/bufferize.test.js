const fs = require('fs');
const assert = require('assert');

const util = require('../../extension/utils');

describe('Bufferizer', () => {
  it('should transform data into buffer', async () => {
    const stream = new util.Bufferizer();
    stream.write([0, 10.2, 5.2, NaN]);
    stream.end();
    let res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    assert(`${res}` === '0,10,5,0', res);
  });
});
