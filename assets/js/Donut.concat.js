(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  var formats = {
    raw: function () {
      var decimals = d3.format('.2f');
      var integers = d3.format('');
      return function (value) {
        return (value + '').split('.').length > 1 ? decimals(value) : integers(value);
      };
    },
    currency: function (opts) {
      opts = utils.isObject(opts) ? opts : {};
      if (!opts.symbol)
        opts.symbol = '$';
      var format = formats.thousands(opts);
      return function (value) {
        return opts.symbol + ' ' + format(value);
      };
    },
    thousands: function (opts) {
      var format = ',';
      opts = utils.isObject(opts) ? opts : {};
      if (opts.decimals)
        format += '.2';
      if (opts.si)
        format += 's';
      format += 'f';
      return d3.format(format);
    },
    axis: function (formatter) {
      if (!formatter || typeof formatter !== 'function')
        formatter = String;

      var suffixFormatter = d3.format('s');
      return function (value) {
        //Remove all non integer values
        value = parseInt(value, 10);
        var formatted = suffixFormatter(value);
        var suffix = formatted.replace(/\d+/, '');
        value = formatted.replace(/[^\d]+/, '');
        return formatter(value) + suffix;
      };
    }
  };
  var utils = {
    isDesigner: function () {
      return xdo && xdo.app && xdo.app.designer && xdo.app.designer.DesignerApplication;
    },
    proxy: function (fn, thisArg) {
      return function () {
        return fn.apply(thisArg, utils.toArray(arguments));
      };
    },
    toArray: function (obj) {
      return Array.prototype.slice.call(obj);
    },
    stringToBoolean: function(obj){
      return typeof obj === 'boolean' ? obj : obj.toLowerCase() === "true";
    },
    deferred: jQuery.Deferred,
    pluck: function (data, key) {
      var values = [];
      if (utils.isArray(data)) {
        values = data.map(function (value) {
          return value[key];
        });

        values = values.filter(function (value) {
          return typeof value !== 'undefined' && value !== null;
        });
      }
      return values;
    },
    isObject: function (obj) {
      return jQuery.isPlainObject(obj);
    },
    isFunction: function (method) {
      return typeof method === 'function';
    },
    format: function (format, opts) {
      if (!(format in formats))
        format = 'raw';
      return formats[format](opts);
    },
    capitalize: function (text) {
      return (text + '').toLowerCase().replace(/_/g, ' ');
    },
    ascending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.ascending(+a, +b);
      return (a + '').localeCompare(b);
    },
    descending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.descending(+a, +b);
      return (b + '').localeCompare(a);
    },
    isEmptyObject: jQuery.isEmptyObject,
    isArray: jQuery.isArray,
    extend: jQuery.extend
  };

  if (!('bimad' in main))
    main.bimad = {};

  if ('utils' in main.bimad)
    utils = utils.extend(utils, main.bimad.utils);

  main.bimad.utils = utils;
})(this);
;(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false */
  /* global bimad */

  function getFieldName (field) {
    var last;
    var name = '';
    if (typeof field === 'string') {
      field = field.slice(field.lastIndexOf('/') + 1);
      last = field.indexOf(':');
      last = last > 0 ? last + 1 : field.length;
      name = field.slice(0, last);
    }
    return name;
  }

  var Parser = {
    date: function (data) {
      var date = new Date(data);
      var year = date.getFullYear().toString();
      var month = date.getMonth().toString();
      return {
        date: date,
        year: year,
        month: month,
        yearmonth: year + month
      };
    },
    parse: function (data) {
      return data;
    }
  };

  var Postprocessors = {
    date: function (node, index, length, meta) {
      //extend the object by parsing the date
      var date;
      var month = 0;
      var day = 1;
      if (meta.aggregate === 'year') {
        date = new Date(node.key, month, day);
      } else if(meta.aggregate === 'yearmonth') {
        month = (length - 1) === index ? 11 : node.key.substring(4);
        day = (length - 1) === index ? 31 : 1;
        date = new Date(node.key.substring(0, 4), node.key.substring(4), day);
      }
      node[meta.name] = date;
    }
  };


  /**
   * Creates a new data model to manipulate the data
   * @param data Array Array of arrays
   * @param metadata Array Column metadata
   */
  var DataModel = function (data, metadata) {
     if (bimad.utils.isArray(data))
       this.setData(data);

     if (bimad.utils.isArray(metadata))
       this.setColumnMetadata(metadata);

     this.sort = {
       by: null,
       comparator: d3.descending
     };
     this.aggregators = {};
     this.columnOrder = [];
  };

  /**
   * Sets the column metadata. This information is given as a parameter to the BIMAD Plugin
   * @param metadata Array Column metadata
   * @return DataModel
   */
  DataModel.prototype.setColumnMetadata = function (meta) {
    var metaData = {};
    var numericColumns = [];
    var columns = [];
    meta.forEach(function (column) {
      var field = column.field;
      var last;
      metaData[column.name] = column;
      if (typeof column.label === 'undefined')
        column.label = getFieldName(column.field);

      column.parser = (column.dataType in Parser) ? column.dataType : 'parse';
      columns.push(column.name);
      if (column.fieldType === 'measure')
        numericColumns.push(column.name);
    });
    this.numericColumns = numericColumns;
    this.metaData = meta;
    this.indexedMetaData = metaData;
    this.columns = columns;
    this.doAggregate = true;
    return this;
  };

  /**
   * Sets the data to work on
   * @param data Array
   * @return DataModel
   */
  DataModel.prototype.setData = function (data) {
    this.data = data;
    return this;
  };

  /**
   * Indexes the data with the column metadata information
   * @return DataModel
   */
  DataModel.prototype.indexColumns = function () {
    var indexed = [];
    var columns = this.columns;
    var metadata = this.indexedMetaData;
    this.data.forEach(function (row) {
      var indexedRow = {};
      row.forEach(function (value, index) {
        var name = columns[index];
        var type = metadata[name].parser;
        indexedRow[name] = value;
        indexedRow[name + '_parsed'] = Parser[metadata[name].parser](value);
      });
      indexed.push(indexedRow);
    });
    this.indexedData = indexed;
    return this;
  };

  /**
   * Sets the colum order to create the hierarchical object.
   * All numeric columns will be discarded and placed at the end of the hierarchy.
   * If second argument is specified as false the nest method will only include the fields specified on the columns parameter
   * If second argument is missing or true, then the hierarchical data will include first the columns specified, and then the
   * rest of te string columns.
   * @param columns Array
   * @param nestExtras Boolean Default true, will include extra string columns in the hierarchy
   * @returns DataModel
   */
  DataModel.prototype.setColumnOrder = function (columns, nestExtras) {
    nestExtras = typeof nestExtras === 'boolean' ? nestExtras : true;
    var columnOrder = [];
    var extraColumns = nestExtras ? this.metaData.slice() : [];
    if (!bimad.utils.isArray(columns))
      columns = [];

    if (columns.length > 0) {
      // first add the string columns that come in the ordered array
      columns.forEach(function (column) {
        if (column in this.indexedMetaData && this.indexedMetaData[column].fieldType !== 'measure')
          columnOrder.push(column);
      }, this);
      //Then add any missing string columns to the end of the array
      extraColumns.forEach(function (column) {
        if (columns.indexOf(column.name) === -1 && column.fieldType !== 'measure')
          columnOrder.push(column.name);
      });
    }
    this.columnOrder = columnOrder;
    return this;
  };

  /**
   * Sets the sorting method by keys
   * @returns DataModel
   */
  DataModel.prototype.sortBy = function (key) {
    if (key in this.indexedMetaData)
      this.sort.by = key;
    return this;
  };

  /**
   * Sets the comparator method to ascending
   * @returns DataModel
   */
  DataModel.prototype.asc = function () {
    this.sort.comparator = bimad.utils.ascending;
    return this;
  };

  /**
   * Sets the sorting method descending
   * @returns DataModel
   */
  DataModel.prototype.desc = function () {
    this.sort.comparator = bimad.utils.descending;
    return this;
  };

  /**
   * Creates the hierarchical object based on the column order
   * @return Object
   */
  DataModel.prototype.nest = function () {
    var aggregators = this.aggregators;
    var meta = this.indexedMetaData;
    var nest = d3.nest();
    var rollups = {};
    var columnTypes = [];
    var root = {
      key: 'root',
    };
    var nested;

    this.columnOrder.forEach(function (column) {
      var columnMeta = meta[column];
      var aggregator = aggregators[columnMeta.dataType];
      columnTypes.push(columnMeta);
      nest.key(function (node) {
        return aggregator ? aggregator(node, column) : node[column];
      });
    });

    if (this.doAggregate) {
      //Create this object dinamically based on the numeric columns
      this.numericColumns.forEach(function (column) {
        rollups[column] = function (leaves) {
          return d3.sum(leaves, function (node) { return node[column]; });
        };
      });

      nest.rollup(function (leaves) {
        var rollup = {};
        for (var key in rollups)
          rollup[key] = rollups[key](leaves);

        return rollup;
      });
    }

    nested = nest.entries(this.indexedData);

    root.values = nested;
    this.numericColumns.forEach(function (column) {
      accumulate(root, column);
    });
    postProcess(root, columnTypes);

    if (this.sort.by)
      sort(root.values, this.sort.by, this.sort.comparator);

    return root;
  };

  DataModel.prototype.aggregate = function (aggregate) {
    if (typeof aggregate === 'undefined')
      return this.doAggregate;

    this.doAggregate = typeof aggregate === 'boolean' ? aggregate : !!aggregate;
    return this;
  };

  DataModel.prototype.dateGroupBy = function (aggregate) {
    var aggregators = {'year': true, 'month': true, 'yearmonth': true};
    var key;
    var column;
    if (!(aggregate in aggregators))
      aggregate = 'year';

    for (key in this.indexedMetaData) {
      column = this.indexedMetaData[key];
      if (column.dataType === 'date')
        column.aggregate = aggregate;
    }
    //create the aggregator and store it for later use
    this.aggregators.date = function (data, column) {
      return data[column + '_parsed'][aggregate];
    };

    return this;
  };

  function sort (data, key, order) {
    if (!bimad.utils.isArray(data))
      return false;

    if (typeof order !== 'function')
      order = bimad.utils.descending;

    data.sort(function (nodeA, nodeB) {
      return order(nodeA[key], nodeB[key]);
    });

    //means we have a hierarchical data of more than one level of depth
    if (bimad.utils.isArray(data[0].values)) {
      data.forEach(function (node) {
        sort(node.values, key, order);
      });
    }

    return true;
  }

  function accumulate (node, key) {
    if (bimad.utils.isObject(node) && !bimad.utils.isEmptyObject(node)) {
      return (bimad.utils.isArray(node.values)) ?
        node[key] = node.values.reduce(function (prev, value) {
          return prev + accumulate(value, key);
        }, 0) :
        node[key] = node.values ? node.values[key] : node[key];
    }
  }

  function postProcess (data, columns) {
    if (data.values && bimad.utils.isArray(data.values)) {
      var valuesLength = data.values.length;
      var column = columns.shift();
      data.values.forEach(function (node, index) {
        if (column && column.dataType in Postprocessors)
          Postprocessors[column.dataType](node, index, valuesLength, column);
        postProcess(node, columns);
      });
    } else if (data.values) {
      delete data.values;
    }
  }

  if (!('bimad' in main))
    main.bimad = {};

  if (!('utils' in main.bimad))
    main.bimad.utils = {};

  if (!('DataModel' in main.bimad.utils))
    main.bimad.utils.DataModel = DataModel;

})(this);
;(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global utils */
  'use strict';

  //taken from
  function findNeighborArc(i, data0, data1, key) {
    var d;
    return (d = findPreceding(i, data0, data1, key)) ? {startAngle: d.endAngle, endAngle: d.endAngle}
    : (d = findFollowing(i, data0, data1, key)) ? {startAngle: d.startAngle, endAngle: d.startAngle}
    : null;
  }

  // Find the element in data0 that joins the highest preceding element in data1.
  function findPreceding(i, data0, data1, key) {
    var m = data0.length;
    while (--i >= 0) {
      var k = key(data1[i]);
      for (var j = 0; j < m; ++j) {
        if (key(data0[j]) === k) return data0[j];
      }
    }
  }

  // Find the element in data0 that joins the lowest following element in data1.
  function findFollowing(i, data0, data1, key) {
    var n = data1.length, m = data0.length;
    while (++i < n) {
      var k = key(data1[i]);
      for (var j = 0; j < m; ++j) {
        if (key(data0[j]) === k) return data0[j];
      }
    }
  }

  function arcTween(d, node, instance) {
    var i = d3.interpolate(node._current, d);
    node._current = i(0);
    return function(t) { return instance.arc(i(t)); };
  }

  var Donut = function (container, data, opts) {
    this.container = d3.select(container);
    opts = jQuery.isPlainObject(opts) ? opts : {};
    this.options = jQuery.extend({}, Donut.DEFAULTS, opts);
    this.animations = false;
    this.init();
    this.events = {
      'filter': [],
      'remove-filter': []
    };

    if (jQuery.isArray(data)) {
      this.setData(data);
    }

    //hide dom filters
    var filter = container.parentNode.querySelector('.filterinfo');
    if (filter)
      filter.style.display = 'none';
  };

  Donut.key = function (data) {
    return data && data.data ? data.data.key : data;
  };

  Donut.DEFAULTS = {
    width: 400,
    height: 300,
    margin: {top: 5, left: 5, bottom: 0, right: 5},
    colors: [
      '#EF4B68',
      '#EFABDD',
      '#E38BD3',
      '#964296',
      '#C8A8FD',
      '#916AC0',
      '#2F3490',
      '#3F94B8',
      '#94D4D8',
      '#3080D5',
      '#2F80D5',
      '#6CC5EA',
      '#227AE7',
      '#24D0FD',
      '#778DB3'
    ],
    padding: {
      top: 0,
      right: 5,
      bottom: 0,
      left: 5
    },
    sizeFormat: 'currency',
    colorLabel: ''
  };

  Donut.prototype.init = function () {
    var self = this;
    var svg;
    this.options.width = parseInt(this.options.width, 10);
    this.options.height = parseInt(this.options.height, 10);
    this.events = {
      'filter': [],
      'remove-filter': []
    };

    this.filters = {};

    this.svg = this.container.append('svg').attr('class', 'donut');
    svg = this.svg.node();
    this.group = this.svg.append('g').attr({
      transform: 'translate(' + this.options.width / 2 + ',' + this.options.height / 2 + ')'
     });
    this.svg.attr({
      width: this.options.width,
      height: this.options.height
    });

    this.path = this.group.selectAll('g.arc');
    this.pie = d3.layout.pie();
    this.arc = d3.svg.arc();
    this.pie.sort(null).value(function (d) { return d.size; });

    this.setColors(this.options.colors);
    svg.addEventListener('click', function (event) {
      var target = $(event.target || event.srcElement);
      var selector = 'g.arc';
      var path = target.is(selector) ? target : target.parents(selector);

      if (path.length)
        self.toggleSelect(path[0]);
    });
  };

  Donut.prototype.setData = function (data) {
    this.data = data;
    return this;
  };

  Donut.prototype.setColors = function (colors) {
    this.color =  d3.scale.ordinal().range(colors);
    return this;
  };

  Donut.prototype.setColorDomain = function () {
    if (this.color) {
      var domain = bimad.utils.pluck(this.data, 'key');
      domain = domain.sort(function (a, b) {
        return a.localeCompare(b);
      });
      this.color.domain(domain);
    }
    return this;
  };

  Donut.prototype.calculateRadius = function () {
    this.options.radius = Math.min(this.options.width, this.options.height) / 2;
    return this;
  };

  Donut.prototype.getInnerRadius = function () {
    var radius = this.options.radius;
    var multiplier = 0.75;
    if (this.options.showSliceLabels)
      multiplier = 0.55;
    return radius * multiplier;
  };


  Donut.prototype.getOuterRadius = function () {
    var radius = this.options.radius;
    var multiplier = 0.95;
    if (this.options.showSliceLabels)
      multiplier = 0.75;
    return radius * multiplier;
  };

  Donut.prototype.getLabelRadius = function () {
    return this.options.radius * 0.85;
  };

  Donut.prototype.render = function () {
    var previousData = this.path.data();
    var currentData = this.pie(this.data);
    var self = this;
    var totalRemoved = 0;
    var toBeRemoved = 0;
    var g = this.group.node();
    var delay = 0;


    this.calculateRadius();
    this.group.classed('has-selected', false);
    this.path = this.path.data(currentData, Donut.key);
    this.arc.outerRadius(this.getOuterRadius()).innerRadius(this.getInnerRadius());
    this.path.enter().insert('g', 'g.labels').attr({
      'class': 'arc'
    }).append('path').attr('d', this.arc).style('fill', function (d, i) {
      this._current = findNeighborArc(i, previousData, currentData, Donut.key) || d;
      return self.color(d.data.key);
    });

    toBeRemoved = this.path.exit().size();
    delay = toBeRemoved > 0 ? 250 : 0;

    this.path.exit().selectAll('path').datum(function (d, i) {
      return findNeighborArc(i, previousData, currentData, Donut.key) || this.parentNode.__data__;
    }).transition()
      .duration(550)
      .attrTween('d', function (d) {
        return arcTween(d, this, self);
      }).remove();

    this.path.classed('selected', false).transition()
      .delay(delay)
      .duration(550)
      .select('path')
      .attrTween('d', function (d) {
        return arcTween(d, this, self);
      });

    this.renderSliceLabels(currentData);

    this.renderLabel(this.options.groupLabel, d3.sum(bimad.utils.pluck(this.data, 'size')));
    return this;
  };

  Donut.prototype.renderSliceLabels = function (data) {
    if (!this.options.showSliceLabels)
      return this;

    this.group.select('g.labels').remove();
    this.group.select('g.lines').remove();
    this.labels = this.group.append('g').attr('class', 'labels');
    this.lines = this.group.append('g').attr('class', 'lines');

    var arcLength = function (d) {
      return d.endAngle - d.startAngle;
    };
    var arc = d3.svg.arc();
    var radius = this.getLabelRadius();
    var outerRadius = this.getOuterRadius();
    var self = this;
    var lines = this.lines.selectAll('polyline').data(data, Donut.key);
    var text = this.labels.selectAll('text').data(data, Donut.key);
    var textMultiplier = 1;
    arc.innerRadius(radius).outerRadius(radius);


    text.enter().append('text').attr({
      'dy': '.35em',
      'transform': function (d) {
        var pos = arc.centroid(d);
        var length = arcLength(d);
        pos[1] = 1.1 * pos[1];
        if (length < 0.2) {
          textMultiplier += 0.02;
          pos[1] = pos[1] * textMultiplier;
          pos[0] = self.options.radius * (length < Math.PI ? 1 : -1);
        }
        return 'translate(' + pos + ')';
      },
      'text-anchor': function (d) {
        var length = d.startAngle - arcLength(d) / 2;
        return length < Math.PI ? 'middle' : 'end';
      }
    }).text(function (d) {
      var length = arcLength(d);
      if (length < 0.2)
        return '';
      return d.data.key;
    });
    lines.enter().append('polyline').style({
      'stroke': '#000',
      'stroke-width': '1px',
      'fill': 'none'
    }).each(function (d) {
      this._current = d;
    });

    var multiplier = 1;
    lines.attr('points', function (d) {
      var pos = arc.centroid(d);
      var posClone;
      var length = arcLength(d);
      var points = [];
      //if (length > 0.1) {
         //multiplier += 0.04;
         //pos[1] = pos[1] * multiplier;
         //posClone = pos.slice();
         //posClone[0] = outerRadius * 0.65;
         //points.push(posClone);
      //}
      //
      if (length > 0.2) {
        points = [self.arc.centroid(d), pos];
      }
      return points;
    });

    text.exit().remove();

    lines.exit().remove();

    return this;
  };

  Donut.prototype.renderLabel = function (text, detail) {
    if (!this.textLabel) {

      this.textLabel = this.group.append('text').attr({
        'class': 'label text',
        'dy': '-1.1em'
      });

      this.detailLabel = this.group.append('text').attr({
        'class': 'label detail',
        'dy': '1.1em'
      });
    }

    this.textLabel.text(bimad.utils.capitalize(text));
    this.detailLabel.text(this.options.numericFormat(detail + ''));
  };

  Donut.prototype.toggleSelect = function (node) {
    var data = node.__data__;
    var legendData;
    var legend;
    var isSelected;
    var selected;
    var container;
    node = d3.select(node);
    isSelected = !node.classed('selected');
    node.classed('selected', isSelected);
    selected = this.group.selectAll('g.selected');
    this.group.classed('has-selected', selected.size() > 0);
    //set filters
    if (isSelected)
      this.addFilter(data.data);
    else
      this.removeFilter(data.data);

    //render the legend based on the selected data
    legendData = selected.size() === 0 ? this.data : bimad.utils.pluck(selected.data(), 'data');
    legend = selected.size() === 1 ? legendData[0].key : this.options.groupLabel;
    legendData = d3.sum(bimad.utils.pluck(legendData, 'size'));
    this.renderLabel(legend, legendData);
    return this;
  };

  Donut.prototype.addFilter = function (group) {
    var uid = this.generateUID(group.key);
    if (!(uid in this.filters))
      this.filters[uid] = {name: group.key};

    this.trigger('filter', [this.filters]);
    return this;
  };

  Donut.prototype.updateFilterInfo = function (filters) {
    if (!bimad.utils.isArray(filters))
      return this;

    var self = this;
    filters.forEach(function(filter) {
      var key = self.generateUID(filter.value);
      if (key in self.filters && filter.id)
        self.filters[key].id = filter.id;
    });
  };

  Donut.prototype.generateUID = function (str) {
    str = (str || '').replace(/[^a-z0-9]/i, '');
    return str + str.length;
  };

  Donut.prototype.removeFilter = function (group) {
    var uid = this.generateUID(group.key);
    var filters;
    var index;
    if (!(uid in this.filters)) {
      return this;
    }
    filters = [this.filters[uid]];
    delete this.filters[uid];

    this.trigger('remove-filter', [filters]);
    return this;
  };

  Donut.prototype.clearFilters = function (silent) {
    var filters = [];
    var key;
    for (key in this.filters) {
      filters.push(this.filters[key]);
    }
    silent = typeof silent === 'boolean' ? silent : false;
    this.filters = {};
    if (!silent)
      this.trigger('remove-filter', [filters]);
    return this;
  };

  /**
   * Adds an event listener
   * @param String type event name
   * @param Function callback to execute
   * @return Donut
   *
   */
  Donut.prototype.addEventListener = function (type, callback) {
    if (!(type in this.events)) {
      this.events[type] = [];
    }
    this.events[type].push(callback);
    return this;
  };

  /**
   * Triggers an event calling all of the callbacks attached to it.
   * @param String type event name
   * @param Array args to pass to the callback
   * @param Object thisArg to execute the callback in a certain context
   * @return Donut
   *
   */
  Donut.prototype.trigger = function (type, args, thisArg) {
    if ((type in this.events) && this.events[type].length) {
      args = jQuery.isArray(args) ? args : [];
      thisArg = thisArg || this;
      this.events[type].forEach(function (callback) {
        callback.apply(thisArg, args);
      });
    }
    return this;
  };

    if (!('Visualizations' in main))
    main.Visualizations = {};

    main.Visualizations.Donut = Donut;
  })(this);
