import { Nifti } from './base';
import { Nifti1 } from './nifti1';
import { Nifti2 } from './nifti2';

// TODO move this to another place
import { FileReference } from '../../fs-utils';

export class NiftiFactory {
  static async build(fd: FileReference): Promise<Nifti> {
    const v: 1 | 2 = await Nifti.version(fd);
    switch (v) {
      case 1:
        return new Nifti1(fd);
      case 2:
        return new Nifti2(fd);
    }
  }
}