const fs = require('fs');
const assert = require('assert');

const util = require('../../extension/util');

describe('Util', () => {
    it('fast round', async () => {
        assert(util.round(10.2) === 10, util.round(10.2));
        assert(util.round(10.5) === 11, util.round(10.5));
        assert(util.round(-10.2) === -9, util.round(-10.2));
        assert(util.round(-10.5) === -10, util.round(-10.5));
    });

    it('ensure buffer', async () => {
        const buffer = util.ensureBuffer('abc');
        assert(buffer.toString() === 'abc');
        assert(util.ensureBuffer(buffer).toString() === 'abc');
    });
});
