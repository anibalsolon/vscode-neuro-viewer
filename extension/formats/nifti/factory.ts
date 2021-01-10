import { Nifti } from './base';
import { Nifti1 } from './nifti1';
import { Nifti2 } from './nifti2';

export class NiftiFactory {
    static async build(fd: number): Promise<Nifti> {
        const v: 1 | 2 = await Nifti.version(fd);
        switch (v) {
            case 1:
                return new Nifti1(fd);
            case 2:
                return new Nifti2(fd);
        }
    }
}