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
    colorLabel: '',
    sortColorBy: 'size',
    sortColorOrder: 'descending'
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


    var sortOrder = this.options.sortColorOrder;
    var sortBy = this.options.sortColorBy;
    this.comparator = function (a, b) {
      return bimad.utils[sortOrder](a[sortBy], b[sortBy]);
    };

    this.path = this.group.selectAll('g.arc');
    this.pie = d3.layout.pie();
    this.arc = d3.svg.arc();
    this.pie.sort(this.comparator).value(function (d) { return d.size; });

    this.setColors(this.options.colors);
    if (!bimad.utils.isDesigner()) {
      svg.addEventListener('click', function (event) {
        var target = $(event.target || event.srcElement);
        var selector = 'g.arc';
        var path = target.is(selector) ? target : target.parents(selector);

        if (path.length)
          self.toggleSelect(path[0]);
      });
    }

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
      var domain = this.data.map(function (node) {
        return {key: node.key, size: node.size};
      });
      domain = domain.sort(this.comparator);
      this.color.domain(domain.map(function (node) { return node.key; }));
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
