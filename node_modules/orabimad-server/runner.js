'use strict';

var packageInfo = require('./package.json');

var ejs = require('ejs');
var fs = require('fs');
var path = require('path');


BIMADServer.MIME_MAPPING = {
  '.js': 'application/javascript',
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.xml': 'text/xml',
  '.csv': 'text/csv',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.otf': 'application/x-opentype',
  '.woff': 'application/font-woff'
}

BIMADServer.resourceFileExpression = /^\/io\/viewer\/get-plugin-asset/;
BIMADServer.csvFileExpression = /\.csv$/;
BIMADServer.cssFileExpression = /\.css$/;

/**
 * node js server engine
 */
function BIMADServer(pluginFile, sdkDir)
{

  this.pluginFile = pluginFile;
  this.sdkDir = sdkDir;

  this.pathMapping = {
    '/': this.serveIndex,
    '/plugin.js': this.servePlugin,
    '/pluginrunner.js': this.serveRunner,
    '/bimadcore.js': this.serveCore,
    '/css/jqm.theme.2.0.0.min.css': this.serveTheme,
    '/css/images/ajax-loader.gif': this.serveImage
  };
}

BIMADServer.prototype.createMiddleware = function ()
{
  var _this = this;
  return function (req, res, next) {
    _this.handleRequest(req, res, next);
  };
}


BIMADServer.prototype.handleRequest = function(req, res, next)
{
  var urlModule = require('url');

  // dispatch
  var requestURL = urlModule.parse(req.url);
  var handler = this.pathMapping[requestURL.pathname];

  if (handler === undefined) {
    var pathName = requestURL.pathname;

    if (BIMADServer.csvFileExpression.test(pathName)
        && !BIMADServer.resourceFileExpression.test(pathName)) {
      // handle data
      this.serveData(req, res, next);
      return;
    }

    if (BIMADServer.resourceFileExpression.test(pathName)) {
      // hanlde plugin resource
      this.serveAsset(req, res, next);
      return;
    }

    // 404 Not found
    this.notFound(req, res, next);
    return;
  }

  // call dispatcher
  handler.apply(this, arguments);
}

BIMADServer.prototype.notFound = function(req, res, next)
{
  var body = '<h1>404 Not found</h1><p>No resource found</p>';
  res.statusCode = 404;
  res.writeHead(404, {
    'Content-Type': 'text/html; charset=UTF-8',
    'Content-Length': body.length
  });

  res.end(body);
}

BIMADServer.prototype._dataFiles = function()
{
  // csv file list under data dir
  var files = fs.readdirSync(path.join(this.sdkDir, 'data'));

  // pick up csv files
  var csvFileExpression = /\.csv$/;
  var dataFiles = [];
  for (var i=0, len=files.length; i<len; i++) {
    if (csvFileExpression.test(files[i])) {
      dataFiles.push(files[i]);
    }
  }

  return dataFiles.sort();
}

BIMADServer.prototype.serveData = function(req, res, next)
{
  var urlModule = require('url');

  // dispatch
  var requestURL = urlModule.parse(req.url);
  var dataFileName = requestURL.pathname.substr(1);

  // parse csv file
  var csv = require('csv');
  var dataDir = path.join(this.sdkDir, 'data');
  var csvFilePath = path.join(dataDir, dataFileName);

  if (!fs.existsSync(csvFilePath)) {
    // not found
    this.notFound(req, res, next);
    return;
  }

  try
  {
    csv().from.path(path.join(dataDir, dataFileName),
                    {delimiter: ',', comment: '#', escape: '"'})
                    .to.array(function(data) {
                      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
                      // need to add sorting here? but no plugin definition is sent to the server right now
                      res.end(JSON.stringify(data));
                    });
  } catch (e) {
    // not found
    this.notFound(req, res, next);
  }
}

BIMADServer.prototype.serveAsset = function(req, res, next)
{
  var urlModule = require('url');

  // dispatch
  var requestURL = urlModule.parse(req.url);
  var pathParts = requestURL.pathname.split('/');
  var assetFileName = pathParts.slice(5, pathParts.length).join('/');
  if (assetFileName.length === 0) {
    this.notFound(req, res, next);
    return;
  }

  // set mime header
  var extension = path.extname(assetFileName);
  var mimeType = BIMADServer.MIME_MAPPING[extension];
  if (mimeType === undefined) {
    mimeType = 'text/plain';
  }

  var assetDir = path.join(this.sdkDir, 'assets');
  try
  {
    var assetFilePath = path.join(assetDir, assetFileName);
    if (!fs.existsSync(assetFilePath)) {
      // not found
      this.notFound(req, res, next);
      return;
    }

    res.writeHead(200, {'Content-Type': mimeType});

    fs.createReadStream(assetFilePath).pipe(res);
  } catch (e) {
    console.log(e);
    // not found
    this.notFound(req, res, next);
  }
}

BIMADServer.prototype.serveImage = function(req, res, next)
{
  var urlModule = require('url');

  var requestURL = urlModule.parse(req.url);
  var imageFile = requestURL.pathname.replace('/css/images/', '');

  // set mime header
  var extension = path.extname(imageFile);
  res.setHeader('Content-Type', BIMADServer.MIME_MAPPING[extension]);

  // just serves static js file
  var template = fs.readFileSync(__dirname + '/css/images/'+imageFile);
  res.end(template);
}

BIMADServer.prototype.serveIndex = function(req, res, next)
{
  // load index template
  var template = fs.readFileSync(__dirname + '/lib/index.ejs', 'utf8');
  var index = ejs.render(template, {
    'version': packageInfo.version
  });

  res.end(index);
}

BIMADServer.prototype.servePlugin = function(req, res, next)
{
  // set mime header
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');

  var path = require('path');

  // load real plugin file
  var plugin = fs.readFileSync(path.join(this.sdkDir, this.pluginFile), 'utf8');

  // load plugin tempalte
  var pluginWrapper = fs.readFileSync(__dirname + '/lib/pluginWrapper.ejs', 'utf8');

  var pluginScript = ejs.render(pluginWrapper, {
    'plugin': plugin
  });

  // make a wrapper to load
  res.end(pluginScript);
}

BIMADServer.prototype.serveRunner = function(req, res, next)
{
  // set mime header
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');

  // just serves static js file
  var template = fs.readFileSync(__dirname + '/lib/pluginrunner.js', 'utf8');

  var pluginrunner = ejs.render(template, {
    dataFiles: this._dataFiles()
  });

  res.end(pluginrunner);
}

BIMADServer.prototype.serveTheme = function(req, res, next)
{
  // set mime header
  res.setHeader('Content-Type', 'text/css; charset=UTF-8');

  // just serves static js file
  var template = fs.readFileSync(__dirname + '/css/jqm.theme.2.0.0.min.css', 'utf8');
  res.end(template);
}

BIMADServer.prototype.serveCore = function(req, res, next)
{
  // set mime header
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');

  // just serves static js file
  var template = fs.readFileSync(__dirname + '/lib/bimadcore.js', 'utf8');
  res.end(template);
}

module.exports.server = BIMADServer;

// bind web service
module.exports.ws = require('./lib/webservice');

