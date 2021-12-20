import { expect } from 'chai';
import * as vscode from 'vscode';
// import * as extension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Sample test', () => {
    expect(-1).to.equal([1, 2, 3].indexOf(5));
    expect(-1).to.equal([1, 2, 3].indexOf(0));
  });
});
