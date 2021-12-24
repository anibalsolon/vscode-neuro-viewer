import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { disposeAll } from './dispose';
import { getNonce } from './utils';
import { NiftiDocument } from './document';
import { FileServer } from './fileserver';

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
  private readonly _ws;

  constructor(
        private readonly _context: vscode.ExtensionContext
  ) {
    this._ws = new FileServer();
  }

  async openCustomDocument(
    uri: vscode.Uri
  ): Promise<NiftiDocument> {
    console.log(`Open document ${uri}`);
    const document: NiftiDocument = new NiftiDocument(uri);

    try {
      await document.metadata();
    } catch (error) {
      console.log('Error reading metadata', error);
      throw error;
    }

    this._ws.serve(document);
    const listeners: vscode.Disposable[] = [];
    document.onDidDispose(() => {
      disposeAll(listeners);
      this._ws.dispose(document);
    });

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
        webviewPanel.webview.postMessage({
          type: 'init',
          body: {
            ws: this._ws.uri?.toString(),
            header: await document.metadata(),
            uuid: document.uuid,
          }
        });
      }
    });
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(
      path.join(this._context.extensionPath, 'dist', 'webview', 'nifti', 'index.js')
    ));
    const nonce = getNonce();
    const context = this._context;
    const data = fs.readFileSync(
      path.join(context.extensionPath, 'dist', 'webview', 'nifti', 'index.html'),
      { encoding: 'utf-8' }
    );
    return data
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