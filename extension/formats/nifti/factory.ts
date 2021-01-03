import { Nifti } from './base';
import { Nifti1 } from './nifti1';
import { Nifti2 } from './nifti2';

export class NiftiFactory {
    static async build(fd: number): Promise<Nifti> {
        const v: number | undefined = await Nifti.version(fd);
        switch (v) {
            default:
            case 1:
                return new Nifti1(fd);
            case 2:
                return new Nifti2(fd);
        }
    }
}