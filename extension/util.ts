import * as fs from 'fs';
import { Transform, TransformCallback } from 'stream';

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

export function isGzipped(fd: number): boolean {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    const bytes = fs.readSync(fd, view, 0, 2, 0);
    if (bytes < 2){
        throw new Error("Invalid file: empty")
    }
    return (
        view.getUint8(0) === GZIP_MAGIC_COOKIE[0] &&
        view.getUint8(1) === GZIP_MAGIC_COOKIE[1]
    );
}

export async function createReadableStream(path: fs.PathLike, options?: string | {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    emitClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
}): Promise<fs.ReadStream> {
    const stream = fs.createReadStream(path, options);
    await awaitReadableStream(stream);
    return stream;
}

export function awaitReadableStream(stream: NodeJS.ReadableStream): Promise<void> {
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
        };
        stream.on('readable', listener);
        stream.on('error', error);
    });
}

export class Slicer extends Transform {
    private _offset: number = 0;
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

    _transform(chunk: any, encoding: string, callback: TransformCallback) {
        if (this._passedThrough + chunk.length < this._offset) {
            callback();
            return;
        }
        if (this._offset_end !== null && this._passedThrough >= this._offset_end) {
            callback();
            return
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
    };
}

export class Stepper extends Transform {
    private _step: number = 1;
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
    };
}

export class Normalizer extends Transform {
    private _min: number = 0;
    private _max: number;
    private _diff: number;
    private _oldmin: number = 0;
    private _oldmax: number;
    private _olddiff: number;
    private _abs: boolean;

    constructor(oldmin: number, oldmax: number, min: number, max: number, abs: boolean = false) {
        super({ objectMode: true });
        this._min = min;
        this._max = max;
        this._diff = this._max - this._min;

        this._oldmin = oldmin;
        this._oldmax = oldmax;
        if (abs) {
            this._oldmin = Math.min(0, Math.abs(oldmin));
            this._olddiff = Math.abs(this._oldmax - this._oldmin);
        } else {
            this._olddiff = this._oldmax - this._oldmin;
        }
        this._abs = abs;
    }

    _transform(chunk: [number], encoding: string, callback: TransformCallback) {
        const _abs = Math.abs;
        for (let i = 0; i < chunk.length; i++) {
            if (this._abs) {
                chunk[i] = _abs(chunk[i]);
            }
            chunk[i] = (((chunk[i] - this._oldmin) * this._diff) / this._olddiff) + this._min;
        }
        this.push(chunk);
        callback();
    };
}
export class Bufferize extends Transform {
    constructor() {
        super({ objectMode: true });
    }

    _transform(chunk: [number], encoding: string, callback: TransformCallback) {
        this.push(Buffer.from(chunk));
        callback();
    };
}

type CasterOptions = { scaling?: { slope: number, intercept: number } };

export class Caster extends Transform {
    private _type: string;
    private _endianness: string;
    private _options?: CasterOptions;
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
    }

    private _readFunction() {
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
        const fn = this._readFunction();
        let readingOffset = 0;
        let i = 0;
        const values = new Array(chunk.length / readingStep);
        const scaling = !!(this._options?.scaling);
        const slope = this._options?.scaling?.slope || 1.0;
        const intercept = this._options?.scaling?.intercept || 0.0;
        while (readingOffset < chunk.length) {
            const v = chunk[fn](readingOffset);
            values[i] = scaling ? slope * v + intercept : v;
            readingOffset += readingStep;
            i++;
        }
        this.push(values);
        callback();
    };
}