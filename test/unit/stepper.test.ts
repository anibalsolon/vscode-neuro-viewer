import { expect } from 'chai';
import { Stepper } from '../../extension/fs-utils';

suite('Stepper', () => {
  test('should step data', async () => {
    const step = 3;
    const slicer = new Stepper(step);
    slicer.write(Buffer.from('abcde'));
    slicer.write(Buffer.from('fghij'));
    slicer.write(Buffer.from('klmno'));
    slicer.write(Buffer.from('pqrst'));
    slicer.write(Buffer.from('uvwxy'));
    slicer.write(Buffer.from('z'));
    slicer.end();
    let res = '';
    for await (const chunk of slicer) {
      expect(chunk.length % step === 0, chunk.length);
      res += chunk.toString('ascii');
    }
    expect(res).to.equal('abcdefghijklmnopqrstuvwx');
  });
  test('should fail on build', async () => {
    try {
      new Stepper(-1);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.equal('Invalid step');
      }
    }
    try {
      new Stepper(0);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.equal('Invalid step');
      }
    }
    try {
      new Stepper(0.1);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).to.equal('Invalid step');
      }
    }
  });
});
