const fs = require('fs');
const assert = require('assert');

const util = require('../../extension/util');

describe('Stepper', () => {
    it('should slice data', async () => {
        const slicer = new util.Slicer(3, 10);
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
        const slicer = new util.Slicer(5);
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
});
