// @ts-nocheck
import * as vscode from 'vscode';
import { Buffer } from 'buffer';
import { NiftiDocument } from '../extension/document';
import { dirname } from 'path';
import daikon from 'daikon';
import { appendFileSync, readFileSync, renameSync, existsSync } from 'fs';
import { v4 } from 'uuid';
import * as temp from 'temp';
import { assert } from 'console';
import glob from 'fast-glob';
temp.track();

function toArrayBuffer(buffer: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return arrayBuffer;
}

async function dcm2nii(uri: vscode.Uri, outUri: vscode.Uri): Promise<vscode.Uri>{
  const dirUri = vscode.Uri.parse(dirname(uri.path));
  const seriesUID = daikon.Series.parseImage(new DataView(toArrayBuffer(await vscode.workspace.fs.readFile(vscode.Uri.parse(uri))))).getSeriesInstanceUID();
  const images = (await glob([dirUri.path + "/**/*.dcm"]).then(async (dcms) => {
    return dcms.map(async (dcm) => {
      return daikon.Series.parseImage(new DataView(toArrayBuffer(await vscode.workspace.fs.readFile(vscode.Uri.parse(dcm)))));
    });
  }).then((promises) => Promise.all(promises))).filter((img) => img.getSeriesInstanceUID() === seriesUID).sort((a, b) => {
    const a_slic = a.getSliceLocation();
    const b_slic = b.getSliceLocation();
    return a_slic < b_slic ? -1 : a_slic > b_slic ? 1 : 0;
  });
  const imgPath = outUri.path + "/" + v4();
  const series = new daikon.Series();
  let minVal = images[0].getInterpretedData()[0];
  let maxVal = images[0].getInterpretedData()[0];
  const l = images[0].getInterpretedData().length;
  for (const image of images){
    if (image === null) {
      console.error(daikon.Series.parserError);
    } else if (image.hasPixelData()) {
      const {data, max, maxIndex, min, minIndex, numCols, numRows} = image.getInterpretedData(true, true);
      if (max > maxVal){maxVal = max;}
      if (min < minVal){minVal = min;}
      assert(l === data.length);
      appendFileSync(imgPath, new Uint8Array(new Float32Array(data).buffer));
      series.addImage(image);
    }
  }
  series.buildSeries();
  const ori = images[0].getTag(0x0020,0x0037).value;
  const firstPos = images[0].getTag(0x0020,0x0032).value;
  const lastPos = images[images.length - 1].getTag(0x0020,0x0032).value;
  const thi = images[0].getTag(0x0018,0x0050).value;
  const n = images.length;
  // https://brainder.org/2015/04/03/the-nifti-2-file-format/
  // https://core.ac.uk/download/pdf/79518053.pdf
  const bytes = [
    new Uint8Array(new Int32Array([540]).buffer), // sizeof_hdr
    Buffer.from("n+2"), // magic[0-2]
    new Uint8Array(5),
    new Uint8Array(new Int16Array([16]).buffer), // data_type
    new Uint8Array(new Int16Array([32]).buffer), // bitpix
    new Uint8Array(new BigInt64Array([
      BigInt(3), // dim[0]
      BigInt(series.images[0].getRows()), // dim[1]
      BigInt(series.images[0].getCols()), // dim[2]
      BigInt(series.images.length), // dim[3]
      BigInt(1), // dim[4]
      BigInt(1), // dim[5]
      BigInt(1), // dim[6]
      BigInt(1), // dim[7]
    ]).buffer),
    new Uint8Array(new Float64Array([
      0, // intent_p1
      0, // intent_p2
      0, // intent_p3
    ]).buffer),
    new Uint8Array(new Float64Array([
      0, // pixdim[0] 
      ...series.images[0].getPixelSpacing(), // pixdim[1] pixdim[2]
      series.images[0].getSliceThickness(), // pixdim[3]
      0, // pixdim[4]
      0, // pixdim[5]
      0, // pixdim[6]
      0, // pixdim[7]
    ]).buffer),
    new Uint8Array(new BigInt64Array([BigInt(544)]).buffer), // vox_offset
    new Uint8Array(new Float64Array([
      0, //1, // scl_slope
      0, //0, // scl_inter
      maxVal, // cal_max
      minVal, // cal_min
      0, // slice_duration
      0, // toffset
    ]).buffer),
    new Uint8Array(new BigInt64Array([
      BigInt(0), // slice_start
      BigInt(0) // slice_end
    ]).buffer),
    new Uint8Array(80), // descrip[80] // some
    new Uint8Array(24), // aux_file[24] // none
    new Uint8Array(new Int32Array([
      0, // qform_code
      4, // sform_code
    ]).buffer),
    new Uint8Array(new Float64Array([
      0, // quatern_b
      0, // quatern_c
      0, // quatern_d
      ...images[0].getImagePosition(), // qoffset_x qoffset_y qoffset_z
      //   -ori[0]*thi[0], -ori[3]*thi[1], -(lastPos[0] - firstPos[0]) / (n - 1), -firstPos[0], // srow_x[4]
      //   -ori[1]*thi[0], -ori[4]*thi[1], -(lastPos[1] - firstPos[1]) / (n - 1), -firstPos[1], // srow_y[4]
      //    ori[2]*thi[0],  ori[5]*thi[1],  (lastPos[2] - firstPos[2]) / (n - 1),  firstPos[2] // srow_z[4]
     -1 , 0, 0, 0, // srow_x[4]
      0 ,-1, 0, 0, // srow_y[4]
      0 , 0, 1, 0 // srow_z[4]
    ]).buffer),
    new Uint8Array(new Int32Array([
      0, // slice_code
      2, // xyzt_units
      0, // intent_code
    ]).buffer), 
    new Uint8Array(16), // intent_name[16]
    new Uint8Array(1), // dim_info
    new Uint8Array(15), // unused_str[15]
    new Uint8Array(4), // additional 4 bytes
  ];
  const hdrPath = outUri.path + "/" + v4();
  bytes.map((buf) => appendFileSync(hdrPath, buf));
//   const outcome = outUri.path + "/" + v4() + ".nii";
  console.log(new Uint8Array(readFileSync(imgPath)).length);
  appendFileSync(hdrPath, new Uint8Array(readFileSync(imgPath)));
  const outcome = hdrPath + ".nii";
  renameSync(hdrPath, outcome);
  return vscode.Uri.parse(outcome);
}

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

  private static readonly viewType = 'neuro-viewer-dicom.Nifti';
  private readonly webviews = new WebviewCollection();

  constructor(
    private readonly _context: vscode.ExtensionContext
  ) {
  }

  async openCustomDocument(
    uri: vscode.Uri
  ): Promise<NiftiDocument> {
    console.log(`Open document ${uri}`);
    let data: Uint8Array = await vscode.workspace.fs.readFile(uri);
    if (uri.path.endsWith(".dcm")){
      const seriesUID = daikon.Series.parseImage(new DataView(toArrayBuffer(await vscode.workspace.fs.readFile(vscode.Uri.parse(uri))))).getSeriesInstanceUID();
      let cache = this._context.globalState.get('neuro-viewer-dicom') || {};
      let uriNii = null;
      if (seriesUID in cache && existsSync(cache[seriesUID])){
        uriNii = vscode.Uri.parse(cache[seriesUID]);
      }
      else {
        const outDir = temp.mkdirSync(v4());
        uriNii = await dcm2nii(uri, vscode.Uri.parse(outDir));
        cache[seriesUID] = uriNii.path;
        this._context.globalState.update('neuro-viewer-dicom', cache);
      }
      data = await vscode.workspace.fs.readFile(uriNii);
    }
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
    const ext = vscode.extensions.getExtension('kubzoey95.neuro-viewer-dicom');
    if (!ext) {
      throw new Error('Unable to find extension');
    }
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        ext.extensionUri,
        "dist",
        "webview/nifti/index.js"
      )
    );
    const uri = ext.extensionUri.with({
      path: ext.extensionUri.path + '/dist/webview/nifti/index.html',
    });
    const html = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(html).toString('utf8')
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