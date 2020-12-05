import * as path from 'path';
import * as vscode from 'vscode';
import * as zlib from 'zlib';
import * as http from 'http';
import * as fs from 'fs';
import { Disposable, disposeAll } from './dispose';
import { getNonce } from './util';
import { v4 } from 'uuid';

const nifti = require('nifti-reader-js');

class NiftiDocument extends Disposable implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private readonly _uuid: string;
  private _header: Object | null;
  private _data: any;

  constructor(
    uri: vscode.Uri
  ) {
    super();
    this._uri = uri;
    this._uuid = v4();
    this._header = null;
    this._data = null;
  }

  public get uri() { return this._uri; }
  public get uuid() { return this._uuid; }
  public get header(): Object | null { return this._header; }
  public get data(): any { return this._data; }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  async readHeader(): Promise<Object|null> {
    if (this._header !== null) {
      return this._header;
    }

    const document = this;
    return new Promise<object>(function (resolve, reject) {
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
    }).then((header: Object) => {
      this._header = header;
      return header;
    });
  }

  async readData(): Promise<Buffer|null> {
    try {
      const buffer = fs.readFileSync(this.uri.path);
      let arbuffer = buffer.buffer
      if (nifti.isCompressed(arbuffer)) {
        arbuffer = nifti.decompress(arbuffer);
      }
      if (!nifti.isNIFTI(arbuffer)) {
        throw new Error();
      }
      const header = nifti.readHeader(arbuffer);
      let image = nifti.readImage(header, arbuffer);

      // const arrayType = {
      //   [nifti.NIFTI1.TYPE_UINT8]: Uint8Array,
      //   [nifti.NIFTI1.TYPE_INT16]: Int16Array,
      //   [nifti.NIFTI1.TYPE_INT32]: Int32Array,
      //   [nifti.NIFTI1.TYPE_FLOAT32]: Float32Array,
      //   [nifti.NIFTI1.TYPE_FLOAT64]: Float64Array,
      //   [nifti.NIFTI1.TYPE_INT8]: Int8Array,
      //   [nifti.NIFTI1.TYPE_UINT16]: Uint16Array,
      //   [nifti.NIFTI1.TYPE_UINT32]: Uint32Array,
      // };
      // image = new arrayType[header.datatypeCode](image);
      image = new Uint8Array(image);
      image = Array.from(image);

      let extension = null;
      if (nifti.hasExtension(header)) {
        extension = nifti.readExtensionData(header, arbuffer);
      }

      return Buffer.from(image);
      // return {
      //   header,
      //   image,
      //   extension,
      // }
    } catch (e) {
      console.log(e)
    }
    return null;
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

export class NiftiEditorProvider implements vscode.CustomReadonlyEditorProvider<NiftiDocument> {

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      NiftiEditorProvider.viewType,
      new NiftiEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private static readonly viewType = 'neuro-viewer.Nifti';

  private readonly webviews = new WebviewCollection();
  private _documents: Record<string, NiftiDocument> = {};
  private _ws: http.Server | null = null;
  private _wsURI: vscode.Uri | null = null;

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) {
}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<NiftiDocument> {
    
    const document: NiftiDocument = new NiftiDocument(uri);
    try {
      await document.readHeader();
    } catch (error) {
      console.log('Error here', error);
      throw error;
    }

    this._documents[document.uuid] = document;

    if (!this._ws) {
      const provider = this;
      this._ws = http.createServer(async function (req, res) {
        try {
          if (req.url && req.url.slice(1) in provider._documents) {
            console.log('Request', req.method, req.url);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Request-Method', '*');
            res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
              res.writeHead(200);
              res.end();
              return;
            }
            res.writeHead(200);
            const data = await provider._documents[req.url.slice(1)].readData();
            res.end(data);
          } else {
            res.writeHead(404);
            res.end();
            return;
          }
        } catch (error) {
          res.writeHead(500);
          res.end(error);
        }
      })
      this._ws.listen(12345);
      this._wsURI = await vscode.env.asExternalUri(vscode.Uri.parse(`http://localhost:12345`));
      console.log(`Listening ${this._wsURI}`);
    }

    const listeners: vscode.Disposable[] = [];
    document.onDidDispose(() => disposeAll(listeners));
    return document;
  }

  async resolveCustomEditor(
    document: NiftiDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.webviews.add(document.uri, webviewPanel);
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = await this.getHtmlForWebview(webviewPanel.webview);
    webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));
    webviewPanel.webview.onDidReceiveMessage(e => {
      if (e.type === 'ready') {
        this.postMessage(webviewPanel, 'init', {
          ws: this._wsURI?.toString(),
          header: document.header,
          uuid: document.uuid,
        });
      }
    });
  }

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this._context.extensionPath, 'dist', 'webview', 'nifti', 'index.js')
    ));
    const styleUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this._context.extensionPath, 'dist', 'webview', 'nifti', 'index.css')
    ));

    const nonce = getNonce();
    const context = this._context;

    const data = fs.readFileSync(path.join(context.extensionPath, 'dist', 'webview', 'nifti', 'index.html'), { encoding: 'utf-8' });

    return data
      .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{styleUri\}/g, styleUri.toString())
      .replace(/\$\{scriptUri\}/g, scriptUri.toString());

  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(panel: vscode.WebviewPanel, type: string, body: any): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>(resolve => this._callbacks.set(requestId, resolve));
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(panel: vscode.WebviewPanel, type: string, body: any): void {
    panel.webview.postMessage({ type, body });
  }

  private onMessage(document: NiftiDocument, message: any) {
    const { type } = message;
    switch (type) {
      case 'response':
        {
          const callback = this._callbacks.get(message.requestId);
          callback?.(message.body);
          return;
        }
    }
  }
}

class WebviewCollection {
  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
  }
}