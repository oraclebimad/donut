(function (main) {
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

  Donut.prototype.render = function () {
    var previousData = this.path.data();
    var currentData = this.pie(this.data);
    var self = this;
    var g = this.group.node();

    this.path = this.path.data(currentData, Donut.key);
    this.options.radius = Math.min(this.options.width, this.options.height) / 2;
    this.arc.outerRadius(this.options.radius - 10).innerRadius(this.options.radius - 50);
    this.path.enter().append('g').attr({
      'class': 'arc'
    }).append('path').attr('d', this.arc).style('fill', function (d, i) {
      this._current = findNeighborArc(i, previousData, currentData, Donut.key) || d;
      return self.color(d.data.size);
    });

    this.path.exit().selectAll('path').datum(function (d, i) {
      return findNeighborArc(i, previousData, currentData, Donut.key) || this.parentNode.__data__;
    }).transition()
      .duration(550)
      .attrTween('d', function (d) {
        return arcTween(d, this, self);
      })
      .each('end', function () {
        g.removeChild(this.parentNode);
      });

    this.path.transition()
      .duration(550)
      .select('path')
      .attrTween('d', function (d) {
        return arcTween(d, this, self);
      });

    this.renderLabel(this.options.groupLabel, d3.sum(Utils.pluck(this.data, 'size')));
    return this;
  };

  Donut.prototype.renderLabel = function (text, detail) {
    if (!this.textLabel) {

      this.textLabel = this.group.append('text').attr({
        'class': 'label text'
      });

      this.detailLabel = this.group.append('text').attr({
        'class': 'label detail',
        'dy': '1.1em'
      });
    }

    this.textLabel.text(Utils.capitalize(text));
    this.detailLabel.text(this.options.numericFormat(detail + ''));
  };

  Donut.prototype.toggleSelect = function (node) {
    var data = node.__data__;
    var isSelected;
    var container;
    node = d3.select(node);
    isSelected = !node.classed('selected');
    this.group.classed('has-selected', isSelected);
    node.classed('selected', isSelected);
    if (isSelected) {
      this.renderLabel(data.data.key, data.data.size);
      this.addFilter(data.data);
    } else {
      this.removeFilter(data.data);
      this.renderLabel(this.options.groupLabel, d3.sum(Utils.pluck(this.data, 'size')));
    }
  };

  Donut.prototype.addFilter = function (group) {
    var uid = this.generateUID(group.key);
    if (!(uid in this.filters))
      this.filters[uid] = {name: group.key};

    this.trigger('filter', [this.filters]);
    return this;
  };

  Donut.prototype.updateFilterInfo = function (filters) {
    if (!Utils.isArray(filters))
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

  Donut.prototype.clearFilters = function () {
    var filters = [];
    var key;
    for (key in this.filters) {
      filters.push(this.filters[key]);
    }
    this.filters = {};
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
