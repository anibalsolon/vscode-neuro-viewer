import { Nifti, NiftiDataType } from './base';

export class Nifti2 extends Nifti {

  protected static HEADER_SIZE = 540;
  protected static MAGIC_COOKIE = 540;

  protected _magiccookie(buffer: Buffer) {
    let cookie = this.read(buffer, NiftiDataType.UINT32, 0);
    if (cookie !== Nifti2.MAGIC_COOKIE) {
      this._endianness = 'LE';
      cookie = this.read(buffer, NiftiDataType.UINT32, 0);
      if (cookie !== Nifti2.MAGIC_COOKIE) {
        throw new Error("Invalid format");
      }
    }
  }

  protected _dims(buffer: Buffer): number[] {
    const ndims = this.read(buffer, NiftiDataType.UINT32, 16);
    const dims: [number] = <[number]> new Array(ndims + 1);
    dims[0] = ndims;
    for (let d = 1; d <= ndims; d++) {
      const index = 16 + (d * 8);
      dims[d] = Number(this.read(buffer, NiftiDataType.UINT64, index));
    }
    return dims;
  }

  protected _pixelSizes(buffer: Buffer, ndims: number): number[] {
    const pixelSizes = <[number]> new Array(ndims + 1);
    for (let d = 1; d <= ndims; d++) {
      const index = 104 + (d * 8);
      pixelSizes[d] = this.read(buffer, NiftiDataType.FLOAT64, index);
    }
    return pixelSizes;
  }

  protected _affine(buffer: Buffer): number[][] {
    const affine = [[1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 4; j++) {
        const index = 400 + (((i * 4) + j) * 8);
        affine[i][j] = this.read(buffer, NiftiDataType.FLOAT64, index);
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
      x: this.read(buffer, NiftiDataType.FLOAT64, 376),
      y: this.read(buffer, NiftiDataType.FLOAT64, 384),
      z: this.read(buffer, NiftiDataType.FLOAT64, 392),
    };
  }

  protected _dataInfo(buffer: Buffer) {
    const dataTypeCode = this.read(buffer, NiftiDataType.UINT16, 12);
    const dataType = NiftiDataType.from(dataTypeCode);
    const offset = Number(this.read(buffer, NiftiDataType.UINT64, 168));
    const bits = this.read(buffer, NiftiDataType.UINT16, 14);

    const max = this.read(buffer, NiftiDataType.FLOAT64, 192);
    const min = this.read(buffer, NiftiDataType.FLOAT64, 200);

    const scalingSlope = this.read(buffer, NiftiDataType.FLOAT32, 176);
    const scalingIntercept = this.read(buffer, NiftiDataType.FLOAT32, 184);

    return {
      dataType,
      offset,
      bits,
      min, max,
      scalingSlope, scalingIntercept
    };
  }
}
