import * as fs from 'fs';
import { Buffer } from 'buffer';
import { Readable, Transform, TransformCallback } from 'stream';

export type FileReference = number | Uint8Array;

export function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function round(x: number): number { return x + 0.5 << 0; }

export function ensureBuffer(chunk: Buffer | string): Buffer {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
}

export const GZIP_MAGIC_COOKIE = [31, 139];

export function isGzipped(fd: FileReference): boolean {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  if (typeof fd === 'number') {
    const bytes = fs.readSync(fd, view, 0, 2, 0);
    if (bytes < 2){
      throw new Error("Invalid file: empty");
    }
  } else {
    const bytes = fd.slice(0, 2);
    if (bytes.length < 2){
      throw new Error("Invalid file: empty");
    }
    view.setUint8(0, bytes[0]);
    view.setUint8(1, bytes[1]);
  }

  return (
    view.getUint8(0) === GZIP_MAGIC_COOKIE[0] &&
    view.getUint8(1) === GZIP_MAGIC_COOKIE[1]
  );
}

export async function createReadableStream(
  fd: FileReference,
  options?: {
    flags?: string | undefined;
    encoding?: BufferEncoding | undefined;
    mode?: number | undefined;
    autoClose?: boolean | undefined;
    emitClose?: boolean | undefined;
    start?: number | undefined;
    highWaterMark?: number | undefined;
    end?: number | undefined;
  }
): Promise<Readable> {
  if (typeof fd === 'number') {
    const stream = fs.createReadStream('', { ...options, fd });
    await awaitReadableStream(stream);
    return stream;
  } else {
    return new Readable({
      read: async function () {
        this.push(fd);
        this.push(null);
      }
    });
  }
}

export function awaitReadableStream(stream: Readable): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    function error(err: Error) {
      stream.removeListener('readable', listener);
      stream.removeListener('error', error);
      reject(err);
    }
    function listener() {
      stream.removeListener('readable', listener);
      stream.removeListener('error', error);
      resolve();
    }
    stream.on('readable', listener);
    stream.on('error', error);
  });
}

export class Slicer extends Transform {
  private _offset = 0;
  private _length?: number;
  private _offset_end: number | null = null;
  private _passedThrough: number;

  constructor(offset: number, length?: number) {
    super();
    this._offset = offset;
    this._length = length;
    if (length !== undefined) {
      this._offset_end = offset + length;
    }
    this._passedThrough = 0;
  }

  _transform(chunk: string | Buffer, encoding: string, callback: TransformCallback) {
    if (this._passedThrough + chunk.length < this._offset) {
      this._passedThrough += chunk.length;
      callback();
      return;
    }
    if (this._offset_end !== null && this._passedThrough >= this._offset_end) {
      callback();
      return;
    }
    const begin = this._passedThrough > this._offset ? 0 : this._offset - this._passedThrough;
    let end = undefined;
    if (this._offset_end !== null) {
      end = (
        this._passedThrough + chunk.length < this._offset_end ?
          undefined :
          this._offset_end - this._passedThrough
      );
    }
    const buffer = ensureBuffer(chunk).slice(begin, end);
    this.push(buffer);
    this._passedThrough += chunk.length;
    callback();
  }
}

export class Stepper extends Transform {
  private _step = 1;
  private _buffer: Buffer = Buffer.from([]);

  constructor(step: number) {
    super();
    if (step <= 0 || step % 1 != 0) {
      throw new Error('Invalid step');
    }
    this._step = step;
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const step = this._step;
    const fullSize = this._buffer.length + chunk.length;
    this._buffer = Buffer.concat([this._buffer, chunk]);
    const steps = Math.floor(fullSize / step);
    if (steps > 0) {
      this.push(this._buffer.slice(0, step * steps));
      this._buffer = this._buffer.slice(step * steps);
    }
    callback();
  }
}

export class Normalizer extends Transform {
  private _min = 0;
  private _max: number;
  private _diff: number;
  private _oldmin = 0;
  private _oldmax: number;
  private _olddiff: number;
  private _symmetric: boolean;

  constructor(oldmin: number, oldmax: number, min: number, max: number) {
    super({ objectMode: true });
    this._min = min;
    this._max = max;
    this._symmetric = oldmin >= 0;
    if (this._symmetric) {
      this._diff = Math.abs(this._max - this._min);
      this._oldmin = Math.min(oldmin, oldmax);
      this._oldmax = Math.max(oldmin, oldmax);
      this._olddiff = Math.abs(this._oldmax - this._oldmin);
    } else {
      this._diff = Math.max(Math.abs(this._min), Math.abs(this._max));
      this._oldmin = 0;
      this._oldmax = Math.max(Math.abs(oldmin), Math.abs(oldmax));
      this._olddiff = this._oldmax;
    }
  }

  _transform(chunk: [number], encoding: string, callback: TransformCallback) {
    const _abs = Math.abs;
    for (let i = 0; i < chunk.length; i++) {
      if (this._symmetric) {
        chunk[i] = (((chunk[i] - this._oldmin) * this._diff) / this._olddiff) + this._min;
      } else {
        const sign = chunk[i] < 0 ? -1 : 1;
        chunk[i] = _abs(chunk[i]);
        chunk[i] = (((chunk[i] - this._oldmin) * this._diff) / this._olddiff) + this._min;
        chunk[i] *= sign;
      }
    }
    this.push(chunk);
    callback();
  }
}

export class Bufferizer extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: number[], encoding: string, callback: TransformCallback) {
    const int16Array = Int16Array.from(chunk);
    this.push(Buffer.from(int16Array.buffer));
    callback();
  }
}

type CasterOptions = { scaling?: { slope: number, intercept: number } };

// TODO should it be here?
type ReadFunctions = 'readDoubleBE' | 'readDoubleLE' | 'readFloatBE' | 'readFloatLE' |
                     'readInt16BE' | 'readInt16LE' | 'readInt32BE' | 'readInt32LE' |
                     'readUInt16BE' | 'readUInt16LE' |
                     'readUInt32BE' | 'readUInt32LE' |
                    //  'readBigInt64BE' | 'readBigInt64LE' |
                    //  'readBigInt64BE' | 'readBigInt64LE' |
                     'readInt8' | 'readUInt8' | 'readUInt8';

export class Caster extends Transform {
  private _type: string;
  private _endianness: string;
  private _options?: CasterOptions;
  private _fn: ReadFunctions;
  private static _bytes: { [s: string]: number } = {
    'NONE': 0,
    'BINARY': 1,
    'UINT8': 1,
    'INT16': 2,
    'INT32': 4,
    'FLOAT32': 4,
    'COMPLEX64': 8,
    'FLOAT64': 8,
    'RGB24': 3,
    'INT8': 1,
    'UINT16': 2,
    'UINT32': 4,
    'INT64': 8,
    'UINT64': 8,
    'FLOAT128': 16,
    'COMPLEX128': 16,
    'COMPLEX256': 32,
  };

  constructor(type: string, endianness: 'BE' | 'LE', options?: CasterOptions) {
    super({ objectMode: true });
    this._type = type;
    this._endianness = endianness;
    this._options = options;
    this._fn = this._readFunction();
  }

  // TODO move readBigInt64LE fn from base to here
  private _readFunction(): ReadFunctions {
    switch (this._type) {
      case 'FLOAT64': return this._endianness === 'BE' ? 'readDoubleBE' : 'readDoubleLE';
      case 'FLOAT32': return this._endianness === 'BE' ? 'readFloatBE' : 'readFloatLE';
      case 'INT16': return this._endianness === 'BE' ? 'readInt16BE' : 'readInt16LE';
      case 'INT32': return this._endianness === 'BE' ? 'readInt32BE' : 'readInt32LE';
      // case 'INT64': return this._endianness === 'BE' ? 'readBigInt64BE' : 'readBigInt64LE';
      case 'UINT16': return this._endianness === 'BE' ? 'readUInt16BE' : 'readUInt16LE';
      case 'UINT32': return this._endianness === 'BE' ? 'readUInt32BE' : 'readUInt32LE';
      // case 'UINT64': return this._endianness === 'BE' ? 'readBigInt64BE' : 'readBigInt64LE';
      case 'INT8': return 'readInt8';
      case 'UINT8': return 'readUInt8';
      default: return 'readUInt8';
    }
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const readingStep = Caster._bytes[this._type];
    if (chunk.length % readingStep !== 0) {
      throw new Error('Invalid chunk size');
    }

    let readingOffset = 0, i = 0;
    const values = new Array(chunk.length / readingStep);
    const scaling = !!(this._options?.scaling);
    const slope = this._options?.scaling?.slope || 1.0;
    const intercept = this._options?.scaling?.intercept || 0.0;
    while (readingOffset < chunk.length) {
      const v = chunk[this._fn](readingOffset);
      values[i] = scaling ? slope * v + intercept : v;
      readingOffset += readingStep;
      i++;
    }
    this.push(values);
    callback();
  }
}