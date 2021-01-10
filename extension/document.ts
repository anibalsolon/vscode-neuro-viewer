import * as zlib from 'zlib';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { v4 } from 'uuid';
import { Disposable } from './dispose';
import { round, Normalizer, Bufferizer } from './util';
import { Nifti, NiftiFactory } from './formats/nifti';

export class NiftiDocument extends Disposable implements vscode.CustomDocument {
    private readonly _uri: vscode.Uri;
    private readonly _uuid: string;
    private readonly _fd: number;
    private _doc?: Nifti;

    constructor(
        uri: vscode.Uri
    ) {
        super();
        this._uri = uri;
        this._uuid = v4();
        this._fd = fs.openSync(uri.path, 'r');
    }

    public get uri() { return this._uri; }
    public get uuid() { return this._uuid; }
    
    public async metadata(): Promise<object> {
        if (!this._doc) {
            this._doc = await NiftiFactory.build(this._fd);
        }
        return this._doc.header();
    }
    public async data(offset?: number, length?: number): Promise<NodeJS.ReadableStream> {
        if (!this._doc) {
            this._doc = await NiftiFactory.build(this._fd);
        }
        const { values: { min, max } } = await this._doc.header();
        const stream = await this._doc.values(offset, length);
        return stream.pipe(new Normalizer(min, max, 0, 255, true)).pipe(new Bufferizer());
    }

    private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
    public readonly onDidDispose = this._onDidDispose.event;

    dispose(): void {
        this._onDidDispose.fire();
        super.dispose();
        fs.closeSync(this._fd);
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
