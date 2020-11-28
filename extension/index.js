import vscode from 'vscode';
import { NiftiEditorProvider } from './viewer';

/**
 * @param {vscode.ExtensionContext} context
 */
export function activate(context) {
  console.log("EEEEEI")
  context.subscriptions.push(NiftiEditorProvider.register(context));
}

export function deactivate() {}