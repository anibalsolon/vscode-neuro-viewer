const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const dist = path.resolve(__dirname, 'dist');

const general = {
  mode: 'development',
  output: {
    path: dist,
    filename: '[name].js',
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  devtool: 'source-map',
  experiments: {
    syncWebAssembly: true,
    asyncWebAssembly: true,
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.m?js/,
        type: "javascript/auto",
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.html$/i,
        loader: 'html-loader',
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
};

const extension = {
  ...general,
  target: 'node',
  entry: {
    'extension-vscode': './extension/index.ts',
  },
  output: {
    ...general.output,
    libraryTarget: 'commonjs2',
  }
};

const webextension = {
  ...general,
  target: 'webworker',
  entry: {
    'extension-web': './extension/index.ts',
  },
  output: {
    ...general.output,
    libraryTarget: 'commonjs2',
  },
  resolve: {
    ...general.resolve,
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js'],
    fallback: {
      buffer: require.resolve('buffer/'),
      assert: require.resolve("assert/"),
      util: require.resolve("util/"),
      stream: require.resolve('stream-browserify'),
      zlib: require.resolve('browserify-zlib'),
      fs: false,
    },
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ],
};

const webview = {
  ...general,
  target: 'web',
  entry: {
    webview_nifti: './webview/nifti/index.ts'
  },
  output: {
    ...general.output,
    filename: 'webview/nifti/index.js',
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'webview/nifti/index.html', to: 'webview/nifti/index.html' },
        { from: './extension/codec-openjpeg/openjpegjs.js.mem', to: 'openjpegjs.js.mem' },
        { from: './extension/codec-openjpeg/openjpegjs_decode.js.mem', to: 'openjpegjs_decode.js.mem' },
        { from: './extension/codec-openjpeg/openjpegwasm.wasm', to: 'openjpegwasm.wasm' },
        { from: './extension/codec-openjpeg/openjpegwasm_decode.wasm', to: 'openjpegwasm_decode.wasm' },
      ],
    }),
  ],
};

module.exports = [extension, webextension, webview];