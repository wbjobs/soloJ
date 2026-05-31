const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
    workerPublicPath: '/',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.wasm'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.worker\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.json',
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new WasmPackPlugin({
      crateDirectory: path.resolve(__dirname, '../dicom-parser'),
      outDir: path.resolve(__dirname, './src/pkg'),
      args: '--log-level info --target web',
      forceMode: 'development',
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../dicom-parser/pkg'),
          to: path.resolve(__dirname, 'dist/pkg'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    client: {
      overlay: false,
    },
  },
};
