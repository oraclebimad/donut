var xml2js = require('xml2js');
var http = require('http');
var EventEmitter =  require('events').EventEmitter;
var fs = require('fs');
var URL = require('url');

function SecurityService(baseURL) {

  this._securityServiceOptions = {
    protocol: 'http',
    hostname: 'localhost',
    port: 8080,
    path: '/xmlpserver/services/v2/SecurityService',
    method: 'POST'
  }

  this.setURL(baseURL);

  this.em = new EventEmitter();
  this._curreentSession = null;
}

SecurityService.prototype.setURL = function(newURL)
{
  if (newURL === undefined) {
    return;
  }

  var url = URL.parse(newURL);
  this._securityServiceOptions.protocol = url.protocol;
  this._securityServiceOptions.hostname = url.hostname;
  this._securityServiceOptions.port = url.port;

  var path = (url.path.charAt(url.path.length-1) === '/')?url.path:url.path+'/';
  this._securityServiceOptions.path = path+'services/v2/SecurityService';
}

SecurityService.prototype.loadSession = function(token)
{
  if (this._currentSession === undefined)
  {
    try {
      this._currentSession = fs.readFileSync('.session', 'utf8');
    } catch (e) {
      return null;
    }
  }

  return this._currentSession;
}

SecurityService.prototype.saveSession = function(token)
{
  this._currentSession = token;

  // save token
  fs.writeFile('.session', token, function(err) {
    if (err !== null) {
      console.log('Error?'+err);
    }
  });
}

SecurityService.prototype.deleteSession = function()
{

  this._currentSession = null;

  // save token
  fs.unlinkSync('.session');
}

SecurityService.prototype.logout = function (sessionToken)
{
  var _this = this;

  var req = http.request(this._securityServiceOptions, function(response) {
    response.setEncoding('utf8');

    response.on('data', function(data) {
      xml2js.parseString(data, function(err, result) {
        var soapResponse = result['soapenv:Envelope']['soapenv:Body'][0];

        if (soapResponse['soapenv:Fault'] === undefined) {
          //
          // save token
          _this.deleteSession(sessionToken);

          // emit event
          _this.em.emit('success', sessionToken);

        } else {
          console.log('ERROR OCCURRED: ' + soapResponse['soapenv:Fault'][0]['faultstring']);
        }

      });
    });
  });

  req.on('error', function(err) {
    // emit event
    _this.em.emit('error', err);
  });

  var requestXML = ''
  requestXML += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">';
  requestXML += '  <soapenv:Header/>';
  requestXML += '  <soapenv:Body>';
  requestXML += '    <v2:logout>';
  requestXML += '      <v2:bipSessionToken>'+sessionToken+'</v2:bipSessionToken>';
  requestXML += '    </v2:logout>';
  requestXML += '   </soapenv:Body>';
  requestXML += '</soapenv:Envelope>\n\n';


  // add empty SOAPAction header
  req.setHeader('SOAPAction', '');
  req.setHeader('Content-type', 'text/xml;charset=UTF-8');
  req.setHeader('Content-Length', requestXML.length);

  req.write(requestXML, 'utf8');

  req.end();
}

SecurityService.prototype.login = function (user, pass)
{
  var _this = this;

  var req = http.request(this._securityServiceOptions, function(response) {
    response.setEncoding('utf8');

    response.on('data', function(data) {
      xml2js.parseString(data, function(err, result) {
        var soapResponse = result['soapenv:Envelope']['soapenv:Body'][0];

        if (soapResponse['soapenv:Fault'] === undefined) {
          var token = soapResponse['loginResponse'][0]['loginReturn'][0];

          // save token
          _this.saveSession(token);

          // emit event
          _this.em.emit('success', token);

        } else {
          console.log('ERROR OCCURRED: ' + soapResponse['soapenv:Fault'][0]['faultstring']);
        }

      });
    });
  });

  req.on('error', function(err) {
    // emit event
    _this.em.emit('error', err);
  });

  var requestXML = ''
  requestXML += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">';
  requestXML += '  <soapenv:Header/>';
  requestXML += '  <soapenv:Body>';
  requestXML += '    <v2:login>';
  requestXML += '      <v2:userID>'+user+'</v2:userID>';
  requestXML += '      <v2:password>'+pass+'</v2:password>';
  requestXML += '    </v2:login>';
  requestXML += '   </soapenv:Body>';
  requestXML += '</soapenv:Envelope>\n\n';


  // add empty SOAPAction header
  req.setHeader('SOAPAction', '');
  req.setHeader('Content-type', 'text/xml;charset=UTF-8');
  req.setHeader('Content-Length', requestXML.length);

  req.write(requestXML, 'utf8');

  req.end();
}

SecurityService.prototype.once = function(handler, listener) {
  this.em.once(handler, listener);
}


function PluginService(baseURL) {

  this._pluginServiceOptions = {
    protocol: 'http',
    hostname: 'localhost',
    port: 8080,
    path: '/xmlpserver/services/v2/PluginService',
    method: 'POST'
  }

  this.setURL(baseURL);

  this.em = new EventEmitter();
}

PluginService.prototype.setURL = function(newURL)
{
  if (newURL === undefined) {
    return;
  }

  var url = URL.parse(newURL);
  this._pluginServiceOptions.protocol = url.protocol;
  this._pluginServiceOptions.hostname = url.hostname;
  this._pluginServiceOptions.port = url.port;

  var path = (url.path.charAt(url.path.length-1) === '/')?url.path:url.path+'/';
  this._pluginServiceOptions.path = path+'services/v2/PluginService';
}

PluginService.prototype.deploy = function(token, appPath, pluginName, data) {
  var _this = this;

  var req = http.request(this._pluginServiceOptions, function(response) {
    response.setEncoding('utf8');

    response.on('data', function(data) {

      xml2js.parseString(data, function(err, result) {
        var soapResponse = result['soapenv:Envelope']['soapenv:Body'][0];

        if (soapResponse['soapenv:Fault'] === undefined) {
          var r = soapResponse['deployResponse'][0]['deployReturn'];

          // emit event
          _this.em.emit('success', r);

        } else {
          _this.em.emit('error', soapResponse['soapenv:Fault'][0]['faultstring']);
        }
      });
    });
  });

  req.on('error', function(err) {
    // emit event
    _this.em.emit('error', err);
  });

  // set timeout
  req.setTimeout(50000, function() {
    console.error('Request timed out');
    req.abort();
  });

  var requestXML = ''
  requestXML += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">';
  requestXML += '  <soapenv:Header/>';
  requestXML += '  <soapenv:Body>';
  requestXML += '    <v2:deploy>';
  requestXML += '      <v2:sessionToken>'+token+'</v2:sessionToken>';
  requestXML += '      <v2:appPath>'+appPath+'</v2:appPath>';
  requestXML += '      <v2:pluginName>'+pluginName+'</v2:pluginName>';
  requestXML += '      <v2:uploadedData>'+data+'</v2:uploadedData>';
  requestXML += '    </v2:deploy>';
  requestXML += '   </soapenv:Body>';
  requestXML += '</soapenv:Envelope>\n\n';


  // add empty SOAPAction header
  req.setHeader('SOAPAction', '');
  req.setHeader('Content-type', 'text/xml;charset=UTF-8');
  req.setHeader('Content-Length', requestXML.length);

  req.write(requestXML, 'utf8');

  req.end();
}

PluginService.prototype.undeploy = function(token, appPath, pluginName) {
  var _this = this;

  var req = http.request(this._pluginServiceOptions, function(response) {
    response.setEncoding('utf8');

    response.on('data', function(data) {

      xml2js.parseString(data, function(err, result) {
        var soapResponse = result['soapenv:Envelope']['soapenv:Body'][0];

        if (soapResponse['soapenv:Fault'] === undefined) {
          var r = soapResponse['undeployResponse'][0]['undeployReturn'];

          // emit event
          _this.em.emit('success', r);

        } else {
          _this.em.emit('error', soapResponse['soapenv:Fault'][0]['faultstring']);
        }
      });
    });
  });

  req.on('error', function(err) {
    // emit event
    _this.em.emit('error', err);
  });

  // set timeout
  req.setTimeout(50000, function() {
    console.error('Request timed out');
    req.abort();
  });

  var requestXML = ''
  requestXML += '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v2="http://xmlns.oracle.com/oxp/service/v2">';
  requestXML += '  <soapenv:Header/>';
  requestXML += '  <soapenv:Body>';
  requestXML += '    <v2:undeploy>';
  requestXML += '      <v2:sessionToken>'+token+'</v2:sessionToken>';
  requestXML += '      <v2:appPath>'+appPath+'</v2:appPath>';
  requestXML += '      <v2:pluginName>'+pluginName+'</v2:pluginName>';
  requestXML += '    </v2:undeploy>';
  requestXML += '   </soapenv:Body>';
  requestXML += '</soapenv:Envelope>\n\n';


  // add empty SOAPAction header
  req.setHeader('SOAPAction', '');
  req.setHeader('Content-type', 'text/xml;charset=UTF-8');
  req.setHeader('Content-Length', requestXML.length);

  req.write(requestXML, 'utf8');

  req.end();
}

PluginService.prototype.once = function(handler, listener) {
  this.em.once(handler, listener);
}

PluginService.prototype.on = function(handler, listener) {
  this.em.on(handler, listener);
}

module.exports.SecurityService = SecurityService;
module.exports.PluginService = PluginService;
