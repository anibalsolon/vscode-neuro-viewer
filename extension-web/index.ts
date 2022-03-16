import * as vscode from 'vscode';
import { NiftiEditorProvider } from '../extension/provider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(NiftiEditorProvider.register(context));
}

export function deactivate() {
  return;
}