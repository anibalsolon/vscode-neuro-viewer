import * as fs from 'fs';
import * as vscode from 'vscode';
import { v4 } from 'uuid';
import { Disposable } from './dispose';
import { Normalizer, FileReference } from './fs-utils';
import { Nifti, NiftiFactory } from './formats/nifti';
import { Readable } from 'stream';

export class NiftiDocument extends Disposable implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private readonly _uuid: string;
  private readonly _fd: FileReference;
  private _doc?: Nifti;

  constructor(
    uri: vscode.Uri,
    fd?: FileReference,
  ) {
    super();
    this._uri = uri;
    this._uuid = v4();
    this._fd = fd || fs.openSync(uri.path, 'r');
  }

  public get uri() { return this._uri; }
  public get uuid() { return this._uuid; }
    
  public async metadata(): Promise<object> {
    if (!this._doc) {
      this._doc = await NiftiFactory.build(this._fd);
    }
    return this._doc.header();
  }
  public async data(offset?: number, volumes?: number): Promise<Readable> {
    if (!this._doc) {
      this._doc = await NiftiFactory.build(this._fd);
    }
    const { values: { min, max } } = await this._doc.header();
    const stream = await this._doc.values(offset, volumes);
    return stream
      .pipe(new Normalizer(min, max, 0, 32767));
  }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
    if (typeof this._fd === 'number') {
      fs.closeSync(this._fd);
    }
  }

  async save(): Promise<void> {
    return;
  }

  async saveAs(): Promise<void> {
    return;
  }

  async revert(): Promise<void> {
    return;
  }

  async backup(destination: vscode.Uri,): Promise<vscode.CustomDocumentBackup> {
    return {
      id: destination.toString(),
      delete: async () => {
        return;
      }
    };
  }
}
