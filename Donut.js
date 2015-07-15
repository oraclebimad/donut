{
  id: "com.oracle.bimad.Donut",
  component: {
    "name": "Donut Chart",
    "tooltip": "Donut chart is a variation of Pie chart. It displays relevant information in the hole at the middle. This Donut chart is designed for smaller screens in mind.",
    "description": "Donut chart is a variation of Pie chart. It displays relevant information in the hole at the middle. This Donut chart is designed for smaller screens in mind.",
    "cssClass": 'donut-plugin',
    "icon": "asset://official-plugin.png"
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "1024px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "colors", label: "Color Scheme", type: "lov", options: [
      {label: "Default", value: "a"},
      {label: "Alta", value: "alta"},
    ], value: "default"},
    {key: "sortColorBy", label: "Sort Color By", type: "lov", options: [
      {label: "Measure", value: "size"},
      {label: "Label", value: "key"}
    ], value: "size"},
    {key: "sortColorOrder", label: "Sort Color Order", type: "lov", options: [
      {label: "Descending", value: "descending"},
      {label: "Ascending", value: "ascending"}
    ], value: "descending"},
    {key: "grouplabel", label: "Label", type: "string", value: ""},
    {key: "showlabels", label: "Slice Labels", type: "bool", value: false}
  ],
  remoteFiles: [
    {
      type:'js',
      location: '//cdnjs.cloudflare.com/ajax/libs/d3/3.5.2/d3.min.js',
      isLoaded: function() {
        return ('d3' in window);
      }
    },
    {
      type:"js",
      location:"asset://js/Utils/bimad.scale.alta.js",
      isLoaded: function() {
        return ('bimad' in window && 'scale' in bimad && 'alta' in bimad.scale);
      }
    },
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
    {name: "size", caption: "Drop Size Field Here", fieldType: "measure", dataType: "number", formula: "summation", formatMask: '#,###'}
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
      'alta': function () {
        return bimad.scale.alta().range();
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
    dataModel = new bimad.utils.DataModel(data, fields);
    dataModel.indexColumns().setColumnOrder(['group']).sortBy('size').desc();
    columnMeta = dataModel.indexedMetaData;
    nested = dataModel.nest().values;
    if (xdo.api.format)
      format = xdo.api.format(columnMeta.size.dataType, columnMeta.size.formatMask, columnMeta.size.formatStyle);
    else
      format = bimad.utils.format('thousands');

    visualization = new Visualizations.Donut(container, nested, {
      width: props.width,
      height: props.height,
      groupLabel: props.groupLabel ? props.groupLabel : columnMeta.size.label,
      colors: this.getColorScheme(props.colors, nested.length),
      numericFormat: format,
      sortColorOrder: props.sortColorOrder,
      sortColorBy: props.sortColorBy,
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
