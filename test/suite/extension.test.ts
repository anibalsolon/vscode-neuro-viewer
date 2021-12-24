import { expect } from 'chai';
import vscode from 'vscode';
import path from 'path';
// import * as extension from '../../extension';
import * as utils from '../../webview/utils';

suite('Extension Test Suite', () => {
  test('Sample test', async () => {
    expect(-1).to.equal([1, 2, 3].indexOf(5));
    expect(-1).to.equal([1, 2, 3].indexOf(0));

    const c1 = utils.hexToRgb('#ff0000');
    expect(c1).to.deep.equal([255, 0, 0, 255]);

    const uri = vscode.Uri.file(
      path.join(__dirname + '/../data/custom.nii')
    );
  });
});
