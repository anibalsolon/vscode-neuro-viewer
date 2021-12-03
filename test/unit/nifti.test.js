const fs = require('fs');
const assert = require('assert');

const nifti = require('../../extension/formats/nifti');
const utils = require('../../extension/utils');

describe('Nifti Format', () => {

  it('should get the correct Nifti version', async () => {
    let fd, inst;
    fd = fs.openSync('test/data/custom.nii');
    inst = await nifti.NiftiFactory.build(fd);
    assert(inst instanceof nifti.Nifti1);
    fs.closeSync(fd);

    fd = fs.openSync('test/data/custom.nii.gz');
    inst = await nifti.NiftiFactory.build(fd);
    assert(inst instanceof nifti.Nifti1);
    fs.closeSync(fd);

    fd = fs.openSync('test/data/custom_v2.nii');
    inst = await nifti.NiftiFactory.build(fd);
    assert(inst instanceof nifti.Nifti2);
    fs.closeSync(fd);

    try {
      fd = fs.openSync('test/data/notanifti.nii');
      inst = await nifti.NiftiFactory.build(fd);
      fs.closeSync(fd);
    } catch (error) {
      assert(error.message === 'Invalid file format')
    }

    try {
      fd = fs.openSync('test/data/notanifti_long.nii');
      inst = await nifti.NiftiFactory.build(fd);
      fs.closeSync(fd);
    } catch (error) {
      assert(error.message === 'Invalid file format')
    }
  });
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
    fs.closeSync(fd);
  });
  it('should give Nifti header (gz)', async () => {
    const fd = fs.openSync('test/data/custom.nii.gz');
    const nii = new nifti.Nifti1(fd);
    const header = await nii.header();
    assert(header.dataType === nifti.NiftiDataType.INT8);
    assert(header.dimensions.toString() === [4, 3, 3, 2, 4].toString());
    assert(header.values.min === 1);
    assert(header.values.max === 4);
    fs.closeSync(fd);
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
    fs.closeSync(fd);
  });

  it('bufferizing v1', async () => {
    const fd = fs.openSync('test/data/custom.nii');
    const nii = new nifti.Nifti1(fd);
    const { values: { min, max } } = await nii.header();
    const stream = await nii.values();

    let values = [];
    for await (const chunk of stream.pipe(new utils.Normalizer(min, max, 0, 3))) {
      values.push(...chunk);
    }

    assert(values.filter((v) => v === 0).length === 18);
    assert(values.filter((v) => v === 1).length === 18);
    assert(values.filter((v) => v === 2).length === 18);
    assert(values.filter((v) => v === 3).length === 18);
    fs.closeSync(fd);
  });

  it('bufferizing v2', async () => {
    const fd = fs.openSync('test/data/custom_v2.nii');
    const nii = new nifti.Nifti2(fd);
    const { values: { min, max } } = await nii.header();
    const stream = await nii.values();

    let values = [];
    for await (const chunk of stream.pipe(new utils.Normalizer(min, max, 0, 3))) {
      values.push(...chunk);
    }

    assert(values.length === 72);
    assert(values.filter((v) => v === 0).length === 18);
    assert(values.filter((v) => v === 1).length === 18);
    assert(values.filter((v) => v === 2).length === 18);
    assert(values.filter((v) => v === 3).length === 18);
    fs.closeSync(fd);
  });

  it('reading volumes', async () => {
    const fd = fs.openSync('test/data/custom.nii');
    const nii = new nifti.Nifti1(fd);
    const stream = await nii.values(0, 1);

    let values = [];
    for await (const chunk of stream) {
      values.push(...chunk);
    }

    assert(values.length === 18);
    assert(values.filter((v) => v === 1).length === 18);
    fs.closeSync(fd);
  });

  it('using pre-computed min/max', async () => {
    const fd = fs.openSync('test/data/custom_minmax.nii');
    const nii = new nifti.Nifti1(fd);
    const { values: { min, max } } = await nii.header();
    assert(min === 1);
    assert(max === 5);
    fs.closeSync(fd);
  });
});
