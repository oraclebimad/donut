{
  id: "03efcb62a28c.Donut",
  component: {
    "name": "Donut Chart",
    "tooltip": "Insert Donut Chart",
    "cssClass": 'donut-plugin'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "320px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "colors", label: "Color scheme", type: "lov", options: [
      {label: "Category A", value: "a"},
      {label: "Category B", value: "b"},
      {label: "Category C", value: "c"},
      {label: "Category D", value: "d"}
    ], value: "d"},
    {key: "numberformat", label: "Numeric Format", type: "lov", options: [
      {label: "Raw", value: "raw"},
      {label: "Currency", value: "currency"},
      {label: "Thousands separated", value: "thousands"}
    ], value: "thousands"},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},
    {key: "grouplabel", label: "Label", type: "string", value: ""},
    {key: "showlabels", label: "Slice Labels", type: "bool", value: false}
  ],
  remoteFiles: [
    {
      type:'js',
      location: 'asset://js/Donut.concat.js',
      isLoaded: function() {
        return 'Visualizations' in window && 'Donut' in Visualizations;
      }
    },
    {
      type:'css',
      location:'asset://css/style.css'
    }
  ],
  fields: [
    {name: "group", caption: "Drop Main Group Field Here", fieldType: "label", dataType: "string"},
    {name: "size", caption: "Drop Size Field Here", fieldType: "measure", dataType: "number", formula: "summation"},
  ],
  dataType: 'arrayOfArrays',
  getColorScheme: function (scheme, dataLength) {
    var scale = d3.scale;
    var colors = {
      'a': function (length) {
        var colors = scale.category10().range();
        if (length > colors.length)
          colors = scale.category20().range();
        return colors;
      },
      'b': function (length) {
        return scale.category20b().range();
      },
      'c': function (length) {
        return scale.category20c().range();
      },
      'd': function (length) {
        return [
          '#ED5565',
          '#FC6E51',
          '#FFCE54',
          '#A0D468',
          '#48CFAD',
          '#4FC1E9',
          '#5D9CEC',
          '#AC92EC',
          '#EC87C0',
          //middle
          '#DA4453',
          '#E9573F',
          '#F6BB42',
          '#8CC152',
          '#37BC9B',
          '#3BAFDA',
          '#4A89DC',
          '#967ADC',
          '#D770AD'
       ];
      }
    };

    if (!(scheme in colors))
      scheme = 'a';

    if (isNaN(dataLength))
      dataLength = 10;

    return colors[scheme](dataLength);
  },
  instances: {},
  render: function (context, container, data, fields, props) {
    var self = this;
    var columnMeta;
    var nested;
    var visualization;
    var dataModel;
    container.innerHTML = '';
    dataModel = new Utils.DataModel(data, fields);
    dataModel.indexColumns().setColumnOrder(['group']).sortBy('size').desc();
    columnMeta = dataModel.indexedMetaData;
    nested = dataModel.nest().values;
    visualization = new Visualizations.Donut(container, nested, {
      width: props.width,
      height: props.height,
      groupLabel: props.groupLabel ? props.groupLabel : columnMeta.size.label,
      colors: this.getColorScheme(props.colors, nested.length),
      numericFormat: Utils.format(props.numberformat, {symbol: props.currencysymbol}),
      showSliceLabels: typeof props.showlabels === 'boolean' ? props.showlabels : props.showlabels === 'true'
    });
    visualization.setColorDomain().render();
    visualization.addEventListener('filter', function (filters) {
      filters = self.constructFilters(filters, context, dataModel);
      xdo.api.handleClickEvent(filters);
      this.updateFilterInfo(filters.filter);
    }).addEventListener('remove-filter', function (filters) {
      self.avoidRefresh = context.id;
      filters.forEach(function (filter) {
        try{
             xdo.app.viewer.GlobalFilter.removeFilter(context.id, filter.id);
        } catch (e) {}
      });
    });
    //instance manager
    this.instances[context.id] = {
      visualization: visualization,
      dataModel: dataModel
    };

  },
  refresh: function (context, container, data, fields, props) {
    var instances = this.instances[context.id];
    var nested;
    if (instances && this.avoidRefresh !== context.id) {
      instances.dataModel.setData(data).indexColumns();
      nested  = instances.dataModel.nest().values;
      instances.visualization.clearFilters(true);
      instances.visualization.setData(nested).render();
    } else {
      this.avoidRefresh = false;
    }
  },
  constructFilters: function (data, context, dataModel) {
    var group = dataModel.indexedMetaData.group.field;
    var filters = [];
    var children;
    for (var key in data) {
      filters.push({field: group, value: data[key].name});
    }

    return {
      id: +context.id,
      filter: filters
    };
  }
}
