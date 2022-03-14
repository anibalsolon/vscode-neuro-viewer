import * as fs from 'fs';
import { expect } from 'chai';
import { Nifti1 } from '../../extension/formats/nifti';
import { Caster } from '../../extension/utils';

suite('Caster', () => {
  test('must parse Nifti data', async () => {
    const fd = fs.openSync('test/data/custom.nii', 'r');
    const nii = new Nifti1(fd);
    const header = await nii.header();
    const data = await nii.data();
    const casted = data
      .pipe(new Caster(header.dataType, header.endianness));

    let values: number[] = [];
    for await (const chunk of casted) {
      values = values.concat(chunk);
    }

    expect(values.filter((v) => v === 0).length).to.equal(0);
    expect(values.filter((v) => v === 1).length).to.equal(18);
    expect(values.filter((v) => v === 2).length).to.equal(18);
    expect(values.filter((v) => v === 3).length).to.equal(18);
    expect(values.filter((v) => v === 4).length).to.equal(18);
  });
});
