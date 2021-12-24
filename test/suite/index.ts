import path from 'path';
import Mocha from 'mocha';
import NYC from 'nyc';
import glob from 'glob';

export async function run(): Promise<void> {
  const nyc = new NYC({
    extends: "@istanbuljs/nyc-config-typescript",
    exclude: [
      "**/*.d.ts",
      "**/*.test.js",
      "coverage",
      "test",
      ".vscode-test",
      "webpack.config.js"
    ],
    reporter: [
      "html",
      "text",
      "text-summary"
    ],
    all: true,
    cache: false,
    sourceMap: true,
    hookRequire: true,
    hookRunInContext: true,
    hookRunInThisContext: true,
    instrument: true,
    require: ["ts-node/register"],
  });
  await nyc.createTempDirectory();
  await nyc.reset();
  await nyc.wrap();

  const mocha = new Mocha({
    ui: 'tdd',
  });

  const testsRoot = path.resolve(__dirname, '..');
  const files: Array<string> = await new Promise((resolve, reject) =>
    glob(
      'suite/**.test.js',
      {
        cwd: testsRoot,
      },
      (err, files) => {
        console.error("err", err, files);
        if (err) reject(err);
        else resolve(files);
      }
    )
  );
  files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

  const failures: number = await new Promise(resolve => mocha.run(resolve));
  await nyc.writeCoverageFile();

  if (failures > 0) {
    throw new Error(`${failures} tests failed.`);
  }
}