import zlib from 'zlib';
import { Readable } from 'stream';
import { Buffer } from 'buffer';
import { FileReference, Slicer, Stepper, Caster, createReadableStream, awaitReadableStream, isGzipped } from '../../fs-utils';
import { affineOrientation } from '../../utils';

export enum NiftiDataType {
    NONE = 'NONE',
    BINARY = 'BINARY',
    UINT8 = 'UINT8',
    INT16 = 'INT16',
    INT32 = 'INT32',
    FLOAT32 = 'FLOAT32',
    COMPLEX64 = 'COMPLEX64',
    FLOAT64 = 'FLOAT64',
    RGB24 = 'RGB24',
    INT8 = 'INT8',
    UINT16 = 'UINT16',
    UINT32 = 'UINT32',
    INT64 = 'INT64',
    UINT64 = 'UINT64',
    FLOAT128 = 'FLOAT128',
    COMPLEX128 = 'COMPLEX128',
    COMPLEX256 = 'COMPLEX256',
}

type NiftiDataTypeNumber = NiftiDataType.NONE | NiftiDataType.BINARY |
                            NiftiDataType.UINT8 | NiftiDataType.INT16 |
                            NiftiDataType.INT32 | NiftiDataType.FLOAT32 |
                            NiftiDataType.COMPLEX64 | NiftiDataType.FLOAT64 |
                            NiftiDataType.RGB24 | NiftiDataType.INT8 |
                            NiftiDataType.UINT16 | NiftiDataType.UINT32 |
                            NiftiDataType.INT64 | NiftiDataType.UINT64 |
                            NiftiDataType.FLOAT128 | NiftiDataType.COMPLEX128 |
                            NiftiDataType.COMPLEX256;

type NiftiDataTypeBigInt = NiftiDataType.INT64 | NiftiDataType.UINT64;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace NiftiDataType {
    export function from(code: number): NiftiDataType {
      const dataTypeMapping: { [s: number]: NiftiDataType } = {
        0: NiftiDataType.NONE,
        1: NiftiDataType.BINARY,
        2: NiftiDataType.UINT8,
        4: NiftiDataType.INT16,
        8: NiftiDataType.INT32,
        16: NiftiDataType.FLOAT32,
        32: NiftiDataType.COMPLEX64,
        64: NiftiDataType.FLOAT64,
        128: NiftiDataType.RGB24,
        256: NiftiDataType.INT8,
        512: NiftiDataType.UINT16,
        768: NiftiDataType.UINT32,
        1024: NiftiDataType.INT64,
        1280: NiftiDataType.UINT64,
        1536: NiftiDataType.FLOAT128,
        1792: NiftiDataType.COMPLEX128,
        2048: NiftiDataType.COMPLEX256,
      };
      return dataTypeMapping[code];
    }
    export function bytes(type: NiftiDataType): number {
      const dataTypeMapping = {
        [NiftiDataType.NONE]: 0,
        [NiftiDataType.BINARY]: 1,
        [NiftiDataType.UINT8]: 1,
        [NiftiDataType.INT16]: 2,
        [NiftiDataType.INT32]: 4,
        [NiftiDataType.FLOAT32]: 4,
        [NiftiDataType.COMPLEX64]: 8,
        [NiftiDataType.FLOAT64]: 8,
        [NiftiDataType.RGB24]: 3,
        [NiftiDataType.INT8]: 1,
        [NiftiDataType.UINT16]: 2,
        [NiftiDataType.UINT32]: 4,
        [NiftiDataType.INT64]: 8,
        [NiftiDataType.UINT64]: 8,
        [NiftiDataType.FLOAT128]: 16,
        [NiftiDataType.COMPLEX128]: 16,
        [NiftiDataType.COMPLEX256]: 32,
      };
      return dataTypeMapping[type];
    }
}

export interface NiftiHeader {
    endianness: 'BE' | 'LE',
    dimensions: number[],
    pixelSizes: number[],
    affine: number[][],
    dataType: NiftiDataType,
    dataOffset: number,
    dataBits: number,
    values: {
        min: number, max: number,
        scaling: {
            slope: number,
            intercept: number,
        }
    },
    quatern: { b: number, c: number, d: number },
    qOffset: { x: number, y: number, z: number },
    formCodes: { qForm?: string, sForm?: string },
    orientation: number[],
    intentName: string,
}

function getFirstAndLast(
  buffer: Buffer,
  offset: number,
): { first: number; last: number } {
  const first = buffer[offset] as number | undefined;
  const last = buffer[offset + 7] as number | undefined;
  return { first: first || 0, last: last || 0 };
}

function readBigInt64BE(buffer: Buffer, offset = 0): bigint {
  const { first, last } = getFirstAndLast(buffer, offset);

  const val =
      (first << 24) + // Overflow
      buffer[++offset] * 2 ** 16 +
      buffer[++offset] * 2 ** 8 +
      buffer[++offset];
  return (
    (BigInt(val) << BigInt(32)) +
      BigInt(
        buffer[++offset] * 2 ** 24 +
              buffer[++offset] * 2 ** 16 +
              buffer[++offset] * 2 ** 8 +
              last,
      )
  );
}

function readBigInt64LE(buffer: Buffer, offset = 0): bigint {
  const { first, last } = getFirstAndLast(buffer, offset);

  const val =
      buffer[offset + 4] +
      buffer[offset + 5] * 2 ** 8 +
      buffer[offset + 6] * 2 ** 16 +
      (last << 24); // Overflow
  return (
    (BigInt(val) << BigInt(32)) +
      BigInt(
        first +
              buffer[++offset] * 2 ** 8 +
              buffer[++offset] * 2 ** 16 +
              buffer[++offset] * 2 ** 24,
      )
  );
}

export abstract class Nifti {

  protected readonly _fd: FileReference;
  protected readonly _gzipped: boolean;

  protected _endianness: 'BE' | 'LE' = 'BE';
  protected _header: NiftiHeader | null = null;

  protected static HEADER_SIZE = 348;
  protected static MAGIC_COOKIE = 348;

  constructor (fd: FileReference) {
    this._fd = fd;
    this._gzipped = isGzipped(fd);
  }

  public static async readStream(fd: FileReference, offset: number, length?: number, steps?: number, gzipped?: boolean): Promise<Readable> {
    if (gzipped === undefined) {
      gzipped = isGzipped(fd);
    }
    const stream = await createReadableStream(fd, { start: 0, autoClose: false });
    const slicer = new Slicer(offset, length);
    let pipe: Readable;
    if (gzipped) {
      const decompressStream = zlib.createGunzip();
      pipe = stream.pipe(decompressStream).pipe(slicer);
    } else {
      pipe = stream.pipe(slicer);
    }
    if (steps) {
      pipe = pipe.pipe(new Stepper(steps));
    }
    await awaitReadableStream(pipe);
    return pipe;
  }

  private async readStream(offset: number, length?: number, steps?: number, gzipped?: boolean): Promise<Readable> {
    return Nifti.readStream(this._fd, offset, length, steps, gzipped);
  }

  static read(buffer: Buffer, type: NiftiDataTypeNumber, offset: number, endianness: 'BE' | 'LE'): number;
  static read(buffer: Buffer, type: NiftiDataTypeBigInt, offset: number, endianness: 'BE' | 'LE'): bigint;
  static read(buffer: Buffer, type: NiftiDataType, offset: number, endianness: 'BE' | 'LE'): bigint | number {

    const readBigInt64BEFn = buffer.readBigInt64BE ? buffer.readBigInt64BE.bind(buffer) : (offset: number) => readBigInt64BE(buffer, offset);
    const readBigInt64LEFn = buffer.readBigInt64LE ? buffer.readBigInt64LE.bind(buffer) : (offset: number): bigint => readBigInt64LE(buffer, offset);

    switch (type) {
      case NiftiDataType.FLOAT64: return endianness === 'BE' ? buffer.readDoubleBE(offset) : buffer.readDoubleLE(offset);
      case NiftiDataType.FLOAT32: return endianness === 'BE' ? buffer.readFloatBE(offset) : buffer.readFloatLE(offset);
      case NiftiDataType.INT16: return endianness === 'BE' ? buffer.readInt16BE(offset) : buffer.readInt16LE(offset);
      case NiftiDataType.INT32: return endianness === 'BE' ? buffer.readInt32BE(offset) : buffer.readInt32LE(offset);
      case NiftiDataType.INT64: return endianness === 'BE' ? readBigInt64BEFn(offset) : readBigInt64LEFn(offset);
      case NiftiDataType.UINT16: return endianness === 'BE' ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset);
      case NiftiDataType.UINT32: return endianness === 'BE' ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset);
      case NiftiDataType.UINT64: return endianness === 'BE' ? readBigInt64BEFn(offset) : readBigInt64LEFn(offset);
      case NiftiDataType.INT8: return buffer.readInt8(offset);
      case NiftiDataType.UINT8: return buffer.readUInt8(offset);
    }
    throw Error('Invalid data type');
  }

  read(buffer: Buffer, type: NiftiDataTypeNumber, offset: number): number;
  read(buffer: Buffer, type: NiftiDataTypeBigInt, offset: number): bigint;
  read(buffer: Buffer, type: NiftiDataType, offset: number): bigint | number {
    return Nifti.read(buffer, type, offset, this._endianness);
  }

    protected abstract _magiccookie(buffer: Buffer): void;

    protected abstract _dims(buffer: Buffer): number[];

    protected abstract _pixelSizes(buffer: Buffer, ndims: number): number[];

    protected abstract _affine(buffer: Buffer): number[][];

    protected abstract _formCodes(buffer: Buffer): { qForm?: string, sForm?: string };

    protected abstract _quatern(buffer: Buffer): { b: number, c: number, d: number };

    protected abstract _qOffset(buffer: Buffer): { x: number, y: number, z: number };

    protected abstract _intentName(buffer: Buffer): string;

    protected abstract _dataInfo(buffer: Buffer): {
        dataType: NiftiDataType,
        offset: number,
        bits: number,
        min: number, max: number,
        scalingSlope: number, scalingIntercept: number
    };

    async header(): Promise<NiftiHeader> {
      if (this._header !== null) {
        return this._header;
      }

      const stream = await this.readStream(0, (<typeof Nifti> this.constructor).HEADER_SIZE);
      const buffer = <Buffer> stream.read((<typeof Nifti> this.constructor).HEADER_SIZE);
      this._endianness = 'BE';

      this._magiccookie(buffer);

      const dims = this._dims(buffer);
      const ndims = dims[0];
      const dimensions = dims.slice(1, 1 + ndims);

      const pixelSizes = this._pixelSizes(buffer, ndims).slice(1, 1 + ndims);
      const affine = this._affine(buffer);
      const qOffset = this._qOffset(buffer);

      const quatern = this._quatern(buffer);
      const intentName = this._intentName(buffer);
      const formCodes = this._formCodes(buffer);

      const {
        dataType,
        offset,
        bits,
        min,
        max,
        scalingSlope,
        scalingIntercept
      } = this._dataInfo(buffer);

      const orientation = affineOrientation(affine);
        
      this._header = {
        endianness: this._endianness,
        dimensions,
        affine,
        quatern,
        qOffset,
        formCodes,
        orientation,
        intentName,
        pixelSizes,
        dataType,
        dataOffset: offset,
        dataBits: bits,
        values: {
          min: Number.MIN_VALUE, max: Number.MAX_VALUE,
          scaling: {
            slope: scalingSlope || 1,
            intercept: scalingIntercept,
          },
        }
      };

      if (min === max && min === 0) {
        const values = await this.values();
        let vmin = Number.MAX_VALUE;
        let vmax = Number.MIN_VALUE;
        const _min = Math.min;
        const _max = Math.max;
        for await (const chunk of values) {
          for (const value of chunk) {
            vmin = _min(vmin, value);
            vmax = _max(vmax, value);
          }
        }
        this._header.values.min = vmin;
        this._header.values.max = vmax;
      } else {
        this._header.values.min = min;
        this._header.values.max = max;
      }

      return this._header;
    }

    async data(volumeOffset = 0, volumes?: number): Promise<Readable> {
      const { dataType, dataOffset, dataBits, dimensions } = await this.header();
      const readingStep = NiftiDataType.bytes(dataType);
      const volumeSize = dimensions[0] * dimensions[1] * dimensions[2] * (dataBits / 8);
      const offset = dataOffset + volumeSize * volumeOffset;

      const stream = await this.readStream(
        offset,
        volumes !== undefined ? volumeSize * volumes : undefined,
        readingStep
      );
      return stream;
    }

    async values(volumeOffset = 0, volumes?: number): Promise<Readable> {
      const { dataType, endianness, values: { scaling: { slope, intercept } } } = await this.header();
      const stream = await this.data(volumeOffset, volumes);
      return stream
        .pipe(new Caster(dataType, endianness, { 
          scaling: { slope, intercept },
        }));
    }

    static async version(fd: FileReference): Promise<1 | 2> {
      const N1_MAGIC_NUMBER_LOCATION = 344;
      const N1_MAGIC_NUMBER = [0x6E, 0x2B, 0x31];

      const stream = await Nifti.readStream(fd, 0, Nifti.HEADER_SIZE);
      const buffer = <Buffer> stream.read(Nifti.HEADER_SIZE);
      if (buffer === null) {
        throw Error('Invalid file format');
      }

      if (
        (Nifti.read(buffer, NiftiDataType.UINT8, N1_MAGIC_NUMBER_LOCATION, 'LE') === N1_MAGIC_NUMBER[0]) &&
        (Nifti.read(buffer, NiftiDataType.UINT8, N1_MAGIC_NUMBER_LOCATION + 1, 'LE') === N1_MAGIC_NUMBER[1]) &&
        (Nifti.read(buffer, NiftiDataType.UINT8, N1_MAGIC_NUMBER_LOCATION + 2, 'LE') === N1_MAGIC_NUMBER[2])
      ) {
        return 1;
      }

      const N2_MAGIC_NUMBER_LOCATION = 4;
      const N2_MAGIC_NUMBER = [0x6E, 0x2B, 0x32, 0, 0x0D, 0x0A, 0x1A, 0x0A];

      if (
        (Nifti.read(buffer, NiftiDataType.UINT8, N2_MAGIC_NUMBER_LOCATION, 'LE') === N2_MAGIC_NUMBER[0]) &&
        (Nifti.read(buffer, NiftiDataType.UINT8, N2_MAGIC_NUMBER_LOCATION + 1, 'LE') === N2_MAGIC_NUMBER[1]) &&
        (Nifti.read(buffer, NiftiDataType.UINT8, N2_MAGIC_NUMBER_LOCATION + 2, 'LE') === N2_MAGIC_NUMBER[2])
      ) {
        return 2;
      }
        
      throw Error('Invalid file format');
    }
}
