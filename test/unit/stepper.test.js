const fs = require('fs');
const assert = require('assert');

const util = require('../../extension/util');

describe('Slicer', () => {
    it('should step data', async () => {
        const step = 3;
        const slicer = new util.Stepper(step);
        slicer.write(Buffer.from('abcde'));
        slicer.write(Buffer.from('fghij'));
        slicer.write(Buffer.from('klmno'));
        slicer.write(Buffer.from('pqrst'));
        slicer.write(Buffer.from('uvwxy'));
        slicer.write(Buffer.from('z'));
        slicer.end();
        let res = '';
        for await (const chunk of slicer) {
            assert(chunk.length % step === 0, chunk.length);
            res += chunk.toString('ascii');
        }
        assert(res === 'abcdefghijklmnopqrstuvwx', res);
    });
});
