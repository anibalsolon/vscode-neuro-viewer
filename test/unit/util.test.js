const fs = require('fs');
const assert = require('assert');

const utils = require('../../extension/utils');

describe('Util', () => {
  it('fast round', async () => {
    assert(utils.round(10.2) === 10, utils.round(10.2));
    assert(utils.round(10.5) === 11, utils.round(10.5));
    assert(utils.round(-10.2) === -9, utils.round(-10.2));
    assert(utils.round(-10.5) === -10, utils.round(-10.5));
  });

  it('ensure buffer', async () => {
    const buffer = utils.ensureBuffer('abc');
    assert(buffer.toString() === 'abc');
    assert(utils.ensureBuffer(buffer).toString() === 'abc');
  });
});
