import * as vscode from 'vscode';
import { NiftiEditorProvider } from './viewer';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(NiftiEditorProvider.register(context));
}

export function deactivate() {
  return;
}