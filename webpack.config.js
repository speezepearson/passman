var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

var config = {
  'target': 'web',
  'entry': './src/index.js',
  'output': {
    'path': path.resolve(__dirname, 'dist'),
    'filename': 'index.js'
  },

  'module': {
    'rules': [
      {
        'test': /\.js$/,
        'exclude': /node_modules/,
        'use': {
          'loader': 'babel-loader'
        }
      },
      {
        'test': /\.html$/,
        'exclude': /node_modules/,
        'use': {
          'loader': 'html-loader'
        }
      }
    ]
  },

  'plugins': [
    new HtmlWebpackPlugin({
      'template': 'src/index.html',
      'inject': 'head',
      'inlineSource': '.(js|css)$'
    }),
    new HtmlWebpackInlineSourcePlugin()
  ]

}
module.exports = [ config ];
