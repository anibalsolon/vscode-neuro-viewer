import * as vscode from 'vscode';
import { Buffer } from 'buffer';
import { getNonce } from './utils';
import { NiftiDocument } from './document';


export class NiftiEditorProvider implements vscode.CustomReadonlyEditorProvider<NiftiDocument> {

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      NiftiEditorProvider.viewType,
      new NiftiEditorProvider(context),
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private static readonly viewType = 'neuro-viewer.Nifti';
  private readonly webviews = new WebviewCollection();

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) {
  }

  async openCustomDocument(
    uri: vscode.Uri
  ): Promise<NiftiDocument> {
    console.log(`Open document ${uri}`);
    const data: Uint8Array = await vscode.workspace.fs.readFile(uri);
    const document: NiftiDocument = new NiftiDocument(uri, data);
    return document;
  }

  async resolveCustomEditor(
    document: NiftiDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    this.webviews.add(document.uri, webviewPanel);
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = await this.getHtmlForWebview(webviewPanel.webview);
    webviewPanel.webview.onDidReceiveMessage(async (e) => {
      if (e.type === 'ready') {

        // TODO is there a way to simplify this?
        const stream = await document.data(0, 1);
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const length = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const data = new Int16Array(length);
        chunks.reduce((acc, chunk) => {
          data.set(chunk, acc);
          return acc + chunk.length;
        }, 0);

        webviewPanel.webview.postMessage({
          type: 'init',
          body: {
            data: data,
            header: await document.metadata(),
          }
        });
      }
    });
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const ext = vscode.extensions.getExtension('anibalsolon.neuro-viewer');
    if (!ext) {
      throw new Error('Unable to find extension');
    }

    const nonce = getNonce();
    const scriptUri = ext.extensionUri.with({
      path: ext.extensionUri.path + '/dist/webview/nifti/index.js',
    });
    const uri = ext.extensionUri.with({
      path: ext.extensionUri.path + '/dist/webview/nifti/index.html',
    });
    const html = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(html).toString('utf8')
      .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{scriptUri\}/g, scriptUri.toString());
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