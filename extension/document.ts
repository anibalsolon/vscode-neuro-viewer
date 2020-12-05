import * as zlib from 'zlib';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { v4 } from 'uuid';
import { Disposable } from './dispose';

const nifti = require('nifti-reader-js');

const _round = (x: number): number => x + 0.5 << 0;

interface NiftiHeader {
    datatypeCode: number,
    dims: number[],
}

export class NiftiDocument extends Disposable implements vscode.CustomDocument {
    private readonly _uri: vscode.Uri;
    private readonly _uuid: string;
    private _header: NiftiHeader | null;

    constructor(
        uri: vscode.Uri
    ) {
        super();
        this._uri = uri;
        this._uuid = v4();
        this._header = null;
    }

    public get uri() { return this._uri; }
    public get uuid() { return this._uuid; }
    public get header(): NiftiHeader | null { return this._header; }

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    public readonly onDidDispose = this._onDidDispose.event;

    dispose(): void {
        this._onDidDispose.fire();
        super.dispose();
    }

    async readHeader(): Promise<NiftiHeader> {
        if (this._header !== null) {
            return this._header;
        }

        const document = this;
        return new Promise<NiftiHeader>(function (resolve, reject) {
            function _parseChunk(parseableChunk: Buffer) {
                const buffer = parseableChunk.buffer;
                if (!nifti.isNIFTI(buffer)) {
                    throw new Error("Not a NIFTI file");
                }
                return nifti.readHeader(buffer);
            }

            const decompressStream = zlib.createGunzip()
                .on('data', function (zlibChunk: Buffer) {
                    let resolved = false;
                    try {
                        resolve(_parseChunk(zlibChunk));
                    } catch (e) {
                        reject(e);
                    } finally {
                        decompressStream.pause();
                        if (!resolved) {
                            reject();
                        }
                    }
                })
                .on('error', function (e) {
                    reject(e);
                });

            const stream = fs.createReadStream(document.uri.path)
            stream.pause()
            stream.on('readable', () => {
                const chunk = stream.read(348);
                if (nifti.isCompressed(chunk.buffer)) {
                    decompressStream.write(chunk)
                } else {
                    try {
                        resolve(_parseChunk(chunk));
                    } catch (e) {
                        reject(e);
                    } finally {
                        decompressStream.pause();
                    }
                }
            });
        }).then((header: NiftiHeader) => {
            header.dims = header.dims.map((v) => Math.abs(v));
            this._header = header;
            return header;
        });
    }

    async readData(): Promise<Buffer> {
        const buffer = fs.readFileSync(this.uri.path);

        let arbuffer = buffer.buffer;
        if (nifti.isCompressed(arbuffer)) {
            arbuffer = nifti.decompress(arbuffer);
        }
        if (!nifti.isNIFTI(arbuffer)) {
            throw new Error();
        }
        const header = await this.readHeader();

        const arrayType = {
            [nifti.NIFTI1.TYPE_UINT8]: Uint8Array,
            [nifti.NIFTI1.TYPE_INT16]: Int16Array,
            [nifti.NIFTI1.TYPE_INT32]: Int32Array,
            [nifti.NIFTI1.TYPE_FLOAT32]: Float32Array,
            [nifti.NIFTI1.TYPE_FLOAT64]: Float64Array,
            [nifti.NIFTI1.TYPE_INT8]: Int8Array,
            [nifti.NIFTI1.TYPE_UINT16]: Uint16Array,
            [nifti.NIFTI1.TYPE_UINT32]: Uint32Array,
        };
        const image = new arrayType[header.datatypeCode](nifti.readImage(header, arbuffer));
        
        let min: number = image[0];
        let max: number = image[0];
        for (let i: number = 1; i < image.length; i++) {
            const v = Math.abs(image[i]);
            if (v < min) {
                min = v;
            }
            if (v > max) {
                max = v;
            }
        }

        const castBuffer = new ArrayBuffer(image.length);
        const normImage = new Uint8Array(castBuffer);
        const _abs = Math.abs;
        for (let i: number = 0; i < image.length; i++) {
            normImage[i] = _round(_abs(image[i] / max) * 255);
        }

        return Buffer.from(normImage);
    }

    async save(cancellation: vscode.CancellationToken): Promise<void> {
    }

    async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    }

    async revert(_cancellation: vscode.CancellationToken): Promise<void> {
    }

    async backup(destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        return {
            id: destination.toString(),
            delete: async () => {
            }
        };
    }
}
