import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, disposeAll } from './dispose';
import { getNonce } from './util';
import { promises as fs } from 'fs';

const nifti = require('nifti-reader-js');

class NiftiDocument extends Disposable implements vscode.CustomDocument {

  static async create(
    uri: vscode.Uri,
  ): Promise<NiftiDocument> {

    console.log("LOADINGGGGG")

    let buffer = Buffer.alloc(348); 

    let fp;
    try {
      fp = await fs.open(uri.path, 'r');
      fp.read(buffer, 0, 348);
      let arbuffer = buffer.buffer
      if (nifti.isCompressed(arbuffer)) {
        arbuffer = nifti.decompress(arbuffer);
      }
  
      if (!nifti.isNIFTI(arbuffer)) {
        throw new Error();
      }
      const niftiHeader = nifti.readHeader(arbuffer);
      return new NiftiDocument(uri, niftiHeader, null);
    } catch (e) {
    } finally {
      if (fp !== undefined)
        await fp.close();
    }
    return new NiftiDocument(uri, {}, null);
  }

  private readonly _uri: vscode.Uri;
  private _header: Object;
  private _data: any;

  private constructor(
    uri: vscode.Uri,
    header: Object,
    data: any,
  ) {
    super();
    this._uri = uri;
    this._header = header;
    this._data = data;
  }

  public get uri() { return this._uri; }
  public get header(): Object { return this._header; }
  public get data(): any { return this._data; }

  private readonly _onDidDispose = this._register(new vscode.EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  async readData(): Promise<Object|null> {
    try {
      const buffer = await fs.readFile(this.uri.path);
      let arbuffer = buffer.buffer
      if (nifti.isCompressed(arbuffer)) {
        arbuffer = nifti.decompress(arbuffer);
      }
  
      if (!nifti.isNIFTI(arbuffer)) {
        throw new Error();
      }
      const header = nifti.readHeader(arbuffer);
      let image = nifti.readImage(header, arbuffer);
      if (header.datatypeCode === nifti.NIFTI1.TYPE_UINT8) {
        image = new Uint8Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_INT16) {
        image = new Int16Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_INT32) {
        image = new Int32Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_FLOAT32) {
        image = new Float32Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_FLOAT64) {
        image = new Float64Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_INT8) {
        image = new Int8Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_UINT16) {
        image = new Uint16Array(image)
      } else if (header.datatypeCode === nifti.NIFTI1.TYPE_UINT32) {
        image = new Uint32Array(image)
      }
      image = Array.from(image)
      let extension = null;
      if (nifti.hasExtension(header)) {
        extension = nifti.readExtensionData(header, arbuffer);
      }
      return {
        header,
        image,
        extension,
      }
    } catch (e) {
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

  private static newNiftiFileId = 1;

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      NiftiEditorProvider.viewType,
      new NiftiEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
        supportsMultipleEditorsPerDocument: false,
      });
  }

  private static readonly viewType = 'nifti-viewer.Nifti';

  private readonly webviews = new WebviewCollection();

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) { }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<NiftiDocument> {
    const document: NiftiDocument = await NiftiDocument.create(uri);
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
          header: document.header
        });
      }
    });
  }

  /**
   * Get the static HTML used for in our editor's webviews.
   */
  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {

    const scriptUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this._context.extensionPath, 'dist', 'webview.js')
    ));
    const styleUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this._context.extensionPath, 'webview', 'index.css')
    ));

    const nonce = getNonce();
    const context = this._context;

    const data = await fs.readFile(path.join(context.extensionPath, 'webview', 'index.html'), { encoding: 'utf-8' });

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
      case 'data':
        {
          document.readData().then(
            (data) => {
              for (const webviewPanel of this.webviews.get(document.uri)) {
                webviewPanel.webview.postMessage({ type, body: data });
              }
            }
          )
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