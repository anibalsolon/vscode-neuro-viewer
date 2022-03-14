import * as fs from 'fs';
import { expect } from 'chai';
import { NiftiFactory, Nifti1, Nifti2, NiftiDataType } from '../../extension/formats/nifti';
import { Normalizer } from '../../extension/utils';

suite('Nifti Format', () => {

  test('should get the correct Nifti version', async () => {
    let fd, inst;
    fd = fs.openSync('test/data/custom.nii', 'r');
    inst = await NiftiFactory.build(fd);
    expect(inst).to.be.instanceOf(Nifti1);
    fs.closeSync(fd);

    fd = fs.openSync('test/data/custom.nii.gz', 'r');
    inst = await NiftiFactory.build(fd);
    expect(inst).to.be.instanceOf(Nifti1);
    fs.closeSync(fd);

    fd = fs.openSync('test/data/custom_v2.nii', 'r');
    inst = await NiftiFactory.build(fd);
    expect(inst).to.be.instanceOf(Nifti2);
    fs.closeSync(fd);

    try {
      fd = fs.openSync('test/data/notanifti.nii', 'r');
      inst = await NiftiFactory.build(fd);
      fs.closeSync(fd);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.equal('Invalid file format');
      }
    }

    try {
      fd = fs.openSync('test/data/notanifti_long.nii', 'r');
      inst = await NiftiFactory.build(fd);
      fs.closeSync(fd);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.equal('Invalid file format');
      }
    }
  });
  test('should give Nifti header', async () => {
    const fd = fs.openSync('test/data/custom.nii', 'r');
    const nii = new Nifti1(fd);
    const header = await nii.header();
    expect(header.dataType).to.equal(NiftiDataType.INT8);
    expect(header.dimensions.toString()).to.deep.equal([3, 3, 2, 4].toString());
    expect(header.values.min).to.equal(1);
    expect(header.values.max).to.equal(4);
    expect(header.affine.toString()).to.deep.equal([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ].toString());
    fs.closeSync(fd);
  });
  test('should give Nifti header (gz)', async () => {
    const fd = fs.openSync('test/data/custom.nii.gz', 'r');
    const nii = new Nifti1(fd);
    const header = await nii.header();
    expect(header.dataType).to.equal(NiftiDataType.INT8);
    expect(header.dimensions.toString()).to.deep.equal([3, 3, 2, 4].toString());
    expect(header.values.min).to.equal(1);
    expect(header.values.max).to.equal(4);
    fs.closeSync(fd);
  });

  test('should give Nifti2 header', async () => {
    const fd = fs.openSync('test/data/custom_v2.nii', 'r');
    const nii = new Nifti2(fd);
    const header = await nii.header();
    expect(header.dataType).to.equal(NiftiDataType.INT8);
    expect(header.dimensions.toString()).to.deep.equal([3, 3, 2, 4].toString());
    expect(header.values.min).to.equal(1);
    expect(header.values.max).to.equal(4);
    expect(header.affine.toString()).to.deep.equal([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ].toString());
    fs.closeSync(fd);
  });

  test('bufferizing v1', async () => {
    const fd = fs.openSync('test/data/custom.nii', 'r');
    const nii = new Nifti1(fd);
    const { values: { min, max } } = await nii.header();
    const stream = await nii.values();

    const values = [];
    for await (const chunk of stream.pipe(new Normalizer(min, max, 0, 3))) {
      values.push(...chunk);
    }

    expect(values.filter((v) => v === 0).length).to.equal(18);
    expect(values.filter((v) => v === 1).length).to.equal(18);
    expect(values.filter((v) => v === 2).length).to.equal(18);
    expect(values.filter((v) => v === 3).length).to.equal(18);
    fs.closeSync(fd);
  });

  test('bufferizing v2', async () => {
    const fd = fs.openSync('test/data/custom_v2.nii', 'r');
    const nii = new Nifti2(fd);
    const { values: { min, max } } = await nii.header();
    const stream = await nii.values();

    const values = [];
    for await (const chunk of stream.pipe(new Normalizer(min, max, 0, 3))) {
      values.push(...chunk);
    }

    expect(values.length).to.equal(72);
    expect(values.filter((v) => v === 0).length).to.equal(18);
    expect(values.filter((v) => v === 1).length).to.equal(18);
    expect(values.filter((v) => v === 2).length).to.equal(18);
    expect(values.filter((v) => v === 3).length).to.equal(18);
    fs.closeSync(fd);
  });

  test('reading volumes', async () => {
    const fd = fs.openSync('test/data/custom.nii', 'r');
    const nii = new Nifti1(fd);
    const stream = await nii.values(0, 1);

    const values = [];
    for await (const chunk of stream) {
      values.push(...chunk);
    }

    expect(values.length).to.equal(18);
    expect(values.filter((v) => v === 1).length).to.equal(18);
    fs.closeSync(fd);
  });

  test('using pre-computed min/max', async () => {
    const fd = fs.openSync('test/data/custom_minmax.nii', 'r');
    const nii = new Nifti1(fd);
    const { values: { min, max } } = await nii.header();
    expect(min).to.equal(1);
    expect(max).to.equal(5);
    fs.closeSync(fd);
  });
});
