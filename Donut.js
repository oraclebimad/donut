{
  id: "com.oracle.bimad.Donut",
  component: {
    "name": "Donut Chart",
    "tooltip": "Donut chart is a variation of Pie chart. It displays relevant information in the hole at the middle. This Donut chart is designed for smaller screens in mind.",
    "cssClass": 'donut-plugin',
    "icon": "asset://official-plugin.png"
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "1024px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "colors", label: "Color scheme", type: "lov", options: [
      {label: "Category A", value: "a"},
      {label: "Category B", value: "b"},
      {label: "Category C", value: "c"},
      {label: "Category D", value: "d"},
      {label: "Taucharts", value: "tau"},
    ], value: "tau"},
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
      },
      'tau': function (length) {
        return [
         '#6FA1D9',
         '#DF2B59',
         '#66DA26',
         '#4C3862',
         '#E5B011',
         '#3A3226',
         '#CB461A',
         '#C7CE23',
         '#7FCDC2',
         '#CCA1C8',
         '#C84CCE',
         '#54762E',
         '#746BC9',
         '#953441',
         '#5C7A76',
         '#C8BF87',
         '#BFC1C3',
         '#8E5C31',
         '#71CE7B',
         '#BE478B'
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
    var format;
    container.innerHTML = '';
    dataModel = new Utils.DataModel(data, fields);
    dataModel.indexColumns().setColumnOrder(['group']).sortBy('size').desc();
    columnMeta = dataModel.indexedMetaData;
    nested = dataModel.nest().values;
    if (xdo.api.format)
      format = xdo.api.format(columnMeta.size.dataType, columnMeta.size.formatMask, columnMeta.size.formatStyle);
    else
      format = Utils.format('thousands');

    visualization = new Visualizations.Donut(container, nested, {
      width: props.width,
      height: props.height,
      groupLabel: props.groupLabel ? props.groupLabel : columnMeta.size.label,
      colors: this.getColorScheme(props.colors, nested.length),
      numericFormat: format,
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
