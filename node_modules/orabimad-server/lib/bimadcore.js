var xdo = {sdk: {plugin: {}}, api: {}};

// ------------------------------------------------------------
// setup API
xdo.api.getPixelValue = function (str) {
  str = str.trim();
  var unit = str.substring(str.length - 2);
  var val  = parseFloat(str.replace(unit, ''));
  switch (unit) {
  case 'cm':
    val = val * 96 / 2.54;
    break;
  case 'in':
    val = val * 96;
    break;
  case 'pt':
    val = val * 96 / 72;
    break;
  }

  return val;
}

xdo.api.handleClickEvent = function(info) {
  // just shows info
  if (console) {
    console.debug("[BIMAD] Click event received: "+JSON.stringify(info));
  }
}

// ------------------------------------------------------------
xdo.sdk.plugin.Bimad = Bimad;

function Bimad()
{
  this._loadedPlugin = {};
}

Bimad._instance = undefined;

Bimad.getInstance = function()
{
  if (Bimad._instance === undefined) {
    Bimad._instance = new Bimad();

    // call plugin rendering function at the time of document is ready

  }
  return Bimad._instance;
}

Bimad.load = function(obj)
{
  var instance = Bimad.getInstance();

  // check refresh method
  if (obj.refresh === undefined) {
    obj.refresh = obj.render;
  }

  // load external libs/css
  if (obj.remoteFiles !== undefined) {
    var id = obj.id;
    var elem = null;
    obj.remoteFiles.forEach(function(info, idx) {

      var loc = info.location;
      loc = loc.replace(/^asset:\//, 'io/viewer/get-plugin-asset/'+id);

      if (info.type === 'js') {
        elem = document.createElement('script');
        elem.id = id+'_'+idx;
        elem.type = 'application/javascript';
        elem.language = 'JavaScript';
        elem.async = false; // to maintain the evaluation order of multiple module loading.
        elem.src = loc;
        document.getElementsByTagName('head')[0].appendChild(elem);
      } else if (info.type === 'css') {
        elem = document.createElement('link');
        elem.id = id+'_'+idx;
        elem.rel = 'stylesheet';
        elem.type = 'text/css';
        elem.href = loc;
        document.getElementsByTagName('head')[0].appendChild(elem);
      }
    });
  }

  instance._loadedPlugin[obj.id] = obj;
}

Bimad.prototype._getRuntimeProperties = function(pluginId)
{
  var runtimeProps = {
    'width': '400px',
    'height': '200px',
    'padding': '0px 0px 0px 0px',
    'margin': '0px 0px 0px 0px',
    'border-top': '0px none #000000',
    'border-left': '0px none #000000',
    'border-right': '0px none #000000',
    'border-bottom': '0px none #000000'
  };

  var pluginDef = this.get(pluginId);
  if (pluginDef === undefined || pluginDef.properties === undefined) {
    return runtimeProps;
  }

  // merge with pluginDef
  pluginDef.properties.forEach(function(def, idx) {
    runtimeProps[def.key] = def.value;
  });

  return runtimeProps;
}

Bimad.prototype.get = function(pluginId)
{
  return this._loadedPlugin[pluginId];
}

Bimad.prototype.refresh = function(dataFile)
{
  for (var pluginId in this._loadedPlugin)
  {
    // must have pluginId
    var elem = document.getElementById(pluginId);
    this.refreshPlugin(pluginId, dataFile);
  }
}

Bimad.prototype.render = function(dataFile)
{
  // call renderPlugin
  var pageBody = document.getElementById('playground');

  // TODO: need to create div frame with correct width and height
  // TODO: make <div> into <iframe> with parent frame access restriction
  for (var pluginId in this._loadedPlugin)
  {
    var elem = document.getElementById(pluginId);
    if (elem === null) {
      var info = this._loadedPlugin[pluginId];
      pageBody.innerHTML = this._renderPluginFrame(info);
    }

    this.renderPlugin(pluginId, dataFile);
  }
}

Bimad.prototype._renderPluginFrame = function(pluginDef)
{
  var pluginId = pluginDef.id;
  var props = this._getRuntimeProperties(pluginId);

  var width = props.width;
  var height = props.height;
  var classes = "component plugincomp";

  var html = [];
  html.push('<div id="'+Bimad.runtimeID+'" ');
  if (pluginDef.component.cssClass != null) {
    classes += " "+pluginDef.component.cssClass;
  }
  html.push('class="'+classes+'"');
  html.push('style="');
  html.push('width: '+width+';');
  html.push('height: '+height+';');
  html.push('">');
  html.push('</div>');

  return html.join('');
}

Bimad.isAllRemoteFilesLoaded = function(pluginDef)
{
  var result = true;

  // should be array
  var remoteFiles = pluginDef.remoteFiles;
  if (remoteFiles == null) {
    return true;
  }

  for (var i=0, len=remoteFiles.length; i<len; i++)
  {
    var remoteFile = remoteFiles[i];
    if (remoteFile.isLoaded instanceof Function)
    {
      result = result && remoteFile.isLoaded()
      if (result === false)
      {
        return false;
      }
    }
  }

  return true;
}

Bimad.runtimeID = new Date().getTime()+'';

Bimad.prototype.renderPlugin = function(pluginId, dataFile)
{
  var pluginElem = document.getElementById(Bimad.runtimeID);

  // apply current theme to the class
  var madTheme = "white";
  var curTheme = "a";
  $("input:radio[name='theme']").each(function(idx, btn) {
    var $btn = $(btn);
    if ($btn.prop('checked')) {
      curTheme = $btn.val();
    }
  });

  if (curTheme == 'a') {
    madTheme = "white";

    // make sure remove black class name
    $(pluginElem).removeClass("theme-black");
    $(pluginElem).addClass("theme-white");
  } else if (curTheme == 'b') {
    madTheme = "black";

    // make sure remove black class name
    $(pluginElem).removeClass("theme-white");
    $(pluginElem).addClass("theme-black");
  }


  var pluginDef = this._loadedPlugin[pluginId];
  var props = this._getRuntimeProperties(pluginId);

  // make sure call isLoaded for all remote files
  if (!Bimad.isAllRemoteFilesLoaded(pluginDef)) {
    var _this = this;
    setTimeout(function() {
      _this.renderPlugin(pluginId, dataFile);
    }, 300);

    return;
  }

  // number index
  var numberTypeColumn = [];
  if (pluginDef.fields) {
    pluginDef.fields.forEach(function(entry, index, array) {
      if (entry.dataType == "number") {
        numberTypeColumn.push(index);
      }
    });
  }

  var _this = this;
  var context = {id: Bimad.runtimeID, theme: madTheme};
  if (pluginDef.render !== undefined) {
    if (dataFile !== undefined)
    {
      $.getJSON('/'+dataFile, function(data) {

        // convert string to number
        data.forEach(function(row, index) {
          // skip header row
          if (index == 0) return;

          numberTypeColumn.forEach(function(colIdx, idx) {
            row[colIdx] = parseFloat(row[colIdx]);
          });
        });

        if (pluginDef.dataType !== 'csv') {
          // remove first row (header column data)
          data.splice(0, 1);
        }

        if (pluginDef.dataType === 'd3hierarchy') {
          data = _this._createHierarchicalData(data);
        } else if (pluginDef.dataType === 'csv') {
          data = _this._createCSV(data);
        }

        pluginDef.fields.forEach(function(field, idx) {
          field.field = '/ROOT/FIELD'+idx;
        });

        pluginDef.render.apply(pluginDef, [context, pluginElem, data, pluginDef.fields, props]);
      });
    }
    else
    {
      pluginDef.fields.forEach(function(field, idx) {
        field.field = null;
      });

      pluginDef.render.apply(pluginDef, [context, pluginElem, null, pluginDef.fields, props]);
    }
  }
}

Bimad.prototype.refreshPlugin = function(pluginId, dataFile)
{
  var pluginElem = document.getElementById(Bimad.runtimeID);
  if (pluginElem == null) return;

  var pluginDef = this._loadedPlugin[pluginId];
  var props = this._getRuntimeProperties(pluginId);

  // ----------------------------------------------------------
  // apply current theme to the class
  var madTheme = "white";
  var curTheme = "a";
  $("input:radio[name='theme']").each(function(idx, btn) {
    var $btn = $(btn);
    if ($btn.prop('checked')) {
      curTheme = $btn.val();
    }
  });

  if (curTheme == 'a') {
    madTheme = "white";
    // make sure remove black class name
    $(pluginElem).removeClass("theme-black");
    $(pluginElem).addClass("theme-white");
  } else if (curTheme == 'b') {
    madTheme = "black";
    // make sure remove black class name
    $(pluginElem).removeClass("theme-white");
    $(pluginElem).addClass("theme-black");
  }

  // ----------------------------------------------------------
  // number index
  var numberTypeColumn = [];
  if (pluginDef.fields) {
    pluginDef.fields.forEach(function(entry, index, array) {
      if (entry.dataType == "number") {
        numberTypeColumn.push(index);
      }
    });
  }

  // TODO: setup data from csv
  var context = {id: Bimad.runtimeID, theme: madTheme};
  var _this = this;
  if (pluginDef.render !== undefined) {
    $.getJSON('/'+dataFile, function(data) {
      // convert string to number
      data.forEach(function(row, index) {
        // skip column row
        if (index == 0) return;

        numberTypeColumn.forEach(function(colIdx, idx) {
          row[colIdx] = parseFloat(row[colIdx]);
        });
      });

      if (pluginDef.dataType !== 'csv') {
        // remove first row (header column data)
        data.splice(0, 1);
      }

      if (pluginDef.dataType === 'd3hierarchy') {
        data = _this._createHierarchicalData(data);
      } else if (pluginDef.dataType === 'csv') {
        data = _this._createCSV(data);
      }

      pluginDef.fields.forEach(function(field, idx) {
        field.field = '/ROOT/FIELD'+idx;
      });

      pluginDef.refresh.apply(pluginDef, [context, pluginElem, data, pluginDef.fields, props]);
    });
  }
}

Bimad.prototype._createHierarchicalData = function(rows)
{
  var lastItems = [];
  var root = {name: 'root', children: []};
  lastItems.push(root);

  rows.forEach(function(row, index) {
    for (var colIdx = 0, lastIdx = row.length-1;
         colIdx < lastIdx; colIdx++) {

      var col = row[colIdx];
      var node = {};
      if (colIdx === lastIdx-1) {
        node.name = col;
        node.value = row[lastIdx];

        // append to the parent node
        lastItems[colIdx].children.push(node);
      } else {
        node.name = col;
        node.children = [];

        // check the curent one
        if (lastItems[colIdx+1] === undefined
            || lastItems[colIdx+1].name !== node.name) {
          // append to the parent
          lastItems[colIdx].children.push(node);

          // replace the last one
          lastItems[colIdx+1] = node;

          // clear previous one
          for (var j=colIdx+2; j<lastIdx; j++) {
            lastItems[j] = undefined;
          }
        }
      }
    }
  });

  return root;
}


Bimad.prototype._createCSV = function(rows)
{
  var buffer = [];
  rows.forEach(function(row, rowIdx) {
    var colCount = row.length;

    row.forEach(function(col, colIdx) {
      if (typeof(col) === 'number') {
        buffer.push(col);
      } else {
        buffer.push(JSON.stringify(col));
      }

      if (colIdx != colCount-1)
      {
        buffer.push(",");
      }
    });

    buffer.push('\n');
  });

  return buffer.join("");
}


