import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--skip-welcome',
        '--skip-release-notes',
        '--enable-proposed-api',
        '--timeout', '5000',
        '--verbose',
      ]
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();