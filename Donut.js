{
  id: '03efcb62a28c.Donut',
  component: {
    'name': 'Donut Chart',
    'tooltip': 'Insert Donut Chart'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "320px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "colors", label: "Color scheme", type: "lov", options: [
      {label: 'Category A', value: 'a'},
      {label: 'Category B', value: 'b'},
      {label: 'Category C', value: 'c'}
    ], value: 'a'},
    {key: "numberformat", label: "Numeric Format", type: "lov", options: [
      {label: 'Raw', value: 'raw'},
      {label: 'Currency', value: 'currency'},
      {label: 'Thousands separated', value: 'thousands'}
    ], value: 'thousands'},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},
    {key: "grouplabel", label: "Label", type: "string", value: ""}
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
  getColorScheme: function (scheme) {
    var colors = {
      'a': d3.scale.category20().range(),
      'b': d3.scale.category20b().range(),
      'b': d3.scale.category20c().range()
    };

    if (!(scheme in colors))
      scheme = 'a';

    return colors[scheme];
  },
  render: function (context, container, data, fields, props) {
    var self = this;
    var columnMeta;
    container.innerHTML = '';
    this.dataModel = new Utils.DataModel(data, fields);
    this.dataModel.indexColumns().setColumnOrder(['group']);
    columnMeta = this.dataModel.indexedMetaData;
    this.visualization = new Visualizations.Donut(container, this.dataModel.nest().values, {
      width: props.width,
      height: props.height,
      groupLabel: props.groupLabel ? props.groupLabel : columnMeta.group.label,
      colors: this.getColorScheme(props.colors),
      numericFormat: Utils.format(props.numberformat, {symbol: props.currencysymbol})
    });
    this.visualization.render();
    this.visualization.addEventListener('filter', function (filters) {
      filters = self.constructFilters(filters, context);
      xdo.api.handleClickEvent(filters);
      this.updateFilterInfo(filters.filter);
      console.log(filters);
    }).addEventListener('remove-filter', function (filters) {
      self.avoidRefresh = true;
      filters.forEach(function (filter) {
        try{
             xdo.app.viewer.GlobalFilter.removeFilter(context.id, filter.id);
        } catch (e) {}
      });
    });
  },
  refresh: function (context, container, data, fields, props) {
    var self = this;
    this.dataModel.setData(data).indexColumns();
    this.visualization.setData(this.dataModel.nest().values).render();
  },
  constructFilters: function (data, context) {
    var group = this.dataModel.indexedMetaData.group.field;
    var filters = [];
    var children;
    for (var key in data) {
      filters.push({field: group, value: data[key].name});
    }

    return {
      id: context.id,
      filter: filters
    };
  }
}
