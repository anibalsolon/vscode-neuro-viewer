import { Nifti, NiftiDataType } from './base';

export class Nifti1 extends Nifti {

  protected static HEADER_SIZE = 348;
  protected static MAGIC_COOKIE = 348;
    
  protected _magiccookie(buffer: Buffer) {
    let cookie = this.read(buffer, NiftiDataType.UINT32, 0);
    if (cookie !== Nifti.MAGIC_COOKIE) {
      this._endianness = 'LE';
      cookie = this.read(buffer, NiftiDataType.UINT32, 0);
      if (cookie !== Nifti.MAGIC_COOKIE) {
        throw new Error("Invalid format");
      }
    }
  }

  protected _dims(buffer: Buffer): number[] {
    const ndims = this.read(buffer, NiftiDataType.UINT16, 40);
    const dims: [number] = <[number]> new Array(ndims + 1);
    dims[0] = ndims;
    for (let d = 1; d <= ndims; d++) {
      const index = 40 + (d * 2);
      dims[d] = this.read(buffer, NiftiDataType.UINT16, index);
    }
    return dims;
  }

  protected _pixelSizes(buffer: Buffer, ndims: number): number[] {
    const pixelSizes = <[number]> new Array(ndims + 1);
    for (let d = 1; d <= ndims; d++) {
      const index = 76 + (d * 4);
      pixelSizes[d] = this.read(buffer, NiftiDataType.FLOAT32, index);
    }
    return pixelSizes;
  }

  protected _affine(buffer: Buffer): number[][] {
    const affine = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        const index = 280 + (((i * 4) + j) * 4);
        affine[i][j] = this.read(buffer, NiftiDataType.FLOAT32, index);
      }
    }
    affine[3][0] = 0;
    affine[3][1] = 0;
    affine[3][2] = 0;
    affine[3][3] = 1;
    return affine;
  }

  protected _qOffset(buffer: Buffer): { x: number, y: number, z: number } {
    return {
      x: this.read(buffer, NiftiDataType.FLOAT32, 268),
      y: this.read(buffer, NiftiDataType.FLOAT32, 272),
      z: this.read(buffer, NiftiDataType.FLOAT32, 276),
    };
  }

  protected _dataInfo(buffer: Buffer) {
    const dataTypeCode = this.read(buffer, NiftiDataType.UINT16, 70);
    const dataType = NiftiDataType.from(dataTypeCode);
    const offset = this.read(buffer, NiftiDataType.FLOAT32, 108);
    const bits = this.read(buffer, NiftiDataType.UINT16, 72);

    const max = this.read(buffer, NiftiDataType.FLOAT32, 124);
    const min = this.read(buffer, NiftiDataType.FLOAT32, 128);

    const scalingSlope = this.read(buffer, NiftiDataType.FLOAT32, 112);
    const scalingIntercept = this.read(buffer, NiftiDataType.FLOAT32, 116);

    return {
      dataType,
      offset,
      bits,
      min, max,
      scalingSlope, scalingIntercept
    };
  }
}