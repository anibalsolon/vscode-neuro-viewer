const fs = require('fs');
const assert = require('assert');

const nifti = require('../../extension/formats/nifti');
const util = require('../../extension/util');

describe('Caster', () => {
    it('Must parse Nifti data', async () => {
        const fd = fs.openSync('test/data/custom.nii');
        const nii = new nifti.Nifti1(fd);
        const header = await nii.header()
        const data = await nii.data();
        const casted = data
            .pipe(new util.Caster(header.dataType, header.endianness));

        let values = [];
        for await (let chunk of casted) {
            values = values.concat(chunk);
        }

        assert(values.filter((v) => v === 0).length === 0);
        assert(values.filter((v) => v === 1).length === 18);
        assert(values.filter((v) => v === 2).length === 18);
        assert(values.filter((v) => v === 3).length === 18);
        assert(values.filter((v) => v === 4).length === 18);
    });
});
