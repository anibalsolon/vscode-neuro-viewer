import { AddressInfo } from 'net';
import * as http from 'http';
import * as vscode from 'vscode';
import { NiftiDocument } from './document';

export class FileServer {

    private _ws: http.Server;
    private _wsPort: number | null = null;
    private _wsURI: vscode.Uri | null = null;

    private _documents: Record<string, NiftiDocument> = {};

    public get uri() { return this._wsURI; }

    constructor() {
        this._ws = http.createServer(this.requestListener.bind(this));
        this._ws.listen(0, async () => {
            this._wsPort = (this._ws.address() as AddressInfo).port;
            this._wsURI = await vscode.env.asExternalUri(vscode.Uri.parse(`http://localhost:${this._wsPort}`));
        });
    }

    private async requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            const url = req.url?.slice(1);
            if (url && url in this._documents) {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Request-Method', '*');
                res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
                res.setHeader('Access-Control-Allow-Headers', '*');
                if (req.method === 'OPTIONS') {
                    res.writeHead(200);
                    res.end();
                    return;
                }

                const data = await this._documents[url].data(0, 1);
                res.writeHead(200);
                data.pipe(res, { end: false });
                await new Promise<void>((resolve, reject) => {
                    data.once('end', function() {
                        res.end();
                        resolve();
                    });
                });
            } else {
                res.writeHead(404);
                res.end();
                return;
            }
        } catch (error) {
            res.writeHead(500);
            res.end(error);
        }
    }

    serve(doc: NiftiDocument) {
        this._documents[doc.uuid] = doc;
    }

    dispose(doc: NiftiDocument) {
        delete this._documents[doc.uuid];
    }
}