{
  id: '03efcb62a28c.Donut',
  component: {
    'name': 'Donut Chart',
    'tooltip': 'Insert Donut Chart'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "320px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "numberformat", label: "Numeric Format", type: "lov", options: [
      {label: 'Raw', value: 'raw'},
      {label: 'Currency', value: 'currency'},
      {label: 'Thousands separated', value: 'thousands'}
    ]},
    {key: "currencysymbol", label: "Currency Symbol", type: "string", value: ""},

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
  fields: [],
  dataType: 'arrayOfArrays',
  render: function (context, container, data, fields, props) {
  },
  refresh: function (context, container, data, fields, props) {
  }
}
