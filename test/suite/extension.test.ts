import { expect } from 'chai';
import * as utils from '../../webview/utils';
// import vscode from 'vscode';
// import path from 'path';
// import * as extension from '../../extension';
// import { NiftiEditorProvider } from '../../extension/viewer';

suite('Extension Test Suite', () => {
  test('Sample test', async () => {
    const c1 = utils.hexToRgb('#ff0000');
    expect(c1).to.deep.equal([255, 0, 0, 255]);

    // const ext = vscode.extensions.getExtension('vscode.nifti-viewer');
    // const uri = vscode.Uri.file(
    //   path.join(__dirname + '/../data/custom.nii')
    // );
  });
});
