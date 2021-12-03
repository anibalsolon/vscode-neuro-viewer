const fs = require('fs');
const assert = require('assert');

const utils = require('../../extension/utils');

describe('Normalizer', () => {
  it('should normalize (!) data', async () => {
    const stream = new utils.Normalizer(0, 10, -5, 5);
    stream.write([0, 10, 5]);
    stream.end();
    let res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    assert(`${res}` === '-5,5,0', res);
  });
  it('should normalize data, with absolute values', async () => {
    const stream = new utils.Normalizer(0, 10, 0, 100, true);
    stream.write([-10, 0, 10]);
    stream.end();
    let res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    assert(`${res}` === '100,0,100', res);
  });
  it('should normalize data, with absolute values', async () => {
    const stream = new utils.Normalizer(5, 10, 0, 100, true);
    stream.write([-10, 5, -5, 10]);
    stream.end();
    let res = [];
    for await (const chunk of stream) {
      res.push(...chunk);
    }
    assert(`${res}` === '100,0,0,100', res);
  });
});
