const fs = require('fs');
const assert = require('assert');

const nifti = require('../../extension/formats/nifti');
const util = require('../../extension/util');

describe('Nifti Format', () => {
    it('should give Nifti header', async () => {
        const fd = fs.openSync('test/data/custom.nii');
        const nii = new nifti.Nifti1(fd);
        const header = await nii.header();
        assert(header.dataType === nifti.NiftiDataType.INT8);
        assert(header.dimensions.toString() === [4, 3, 3, 2, 4].toString());
        assert(header.values.min === 1);
        assert(header.values.max === 4);
        assert(header.affine.toString() === [[1, 0, 0, 0],
                                             [0, 1, 0, 0],
                                             [0, 0, 1, 0],
                                             [0, 0, 0, 1]].toString());
    });
    it('should give Nifti header (gz)', async () => {
        const fd = fs.openSync('test/data/custom.nii.gz');
        const nii = new nifti.Nifti1(fd);
        const header = await nii.header();
        assert(header.dataType === nifti.NiftiDataType.INT8);
        assert(header.dimensions.toString() === [4, 3, 3, 2, 4].toString());
        assert(header.values.min === 1);
        assert(header.values.max === 4);
    });

    it('should give Nifti2 header', async () => {
        const fd = fs.openSync('test/data/custom_v2.nii');
        const nii = new nifti.Nifti2(fd);
        const header = await nii.header();
        assert(header.dataType === nifti.NiftiDataType.INT8);
        assert(header.dimensions.toString() === [4, 3, 3, 2, 4].toString());
        assert(header.values.min === 1);
        assert(header.values.max === 4);
        assert(header.affine.toString() === [[1, 0, 0, 0],
                                             [0, 1, 0, 0],
                                             [0, 0, 1, 0],
                                             [0, 0, 0, 1]].toString());
    });

    it('Bufferizing v1', async () => {
        const fd = fs.openSync('test/data/custom.nii');
        const nii = new nifti.Nifti1(fd);
        const { values: { min, max } } = await nii.header();
        const stream = await nii.values();

        let values = [];
        for await (const chunk of stream.pipe(new util.Normalizer(min, max, 0, 3))) {
            values.push(...chunk);
        }

        assert(values.filter((v) => v === 0).length === 18);
        assert(values.filter((v) => v === 1).length === 18);
        assert(values.filter((v) => v === 2).length === 18);
        assert(values.filter((v) => v === 3).length === 18);
    });

    it('Bufferizing v2', async () => {
        const fd = fs.openSync('test/data/custom_v2.nii');
        const nii = new nifti.Nifti2(fd);
        const { values: { min, max } } = await nii.header();
        const stream = await nii.values();

        let values = [];
        for await (const chunk of stream.pipe(new util.Normalizer(min, max, 0, 3))) {
            values.push(...chunk);
        }

        assert(values.filter((v) => v === 0).length === 18);
        assert(values.filter((v) => v === 1).length === 18);
        assert(values.filter((v) => v === 2).length === 18);
        assert(values.filter((v) => v === 3).length === 18);
    });
});
