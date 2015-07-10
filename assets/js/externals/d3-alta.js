(function() {
  d3.scale.alta = function() {
    return d3.scale.ordinal().range([
      "#FAD55C", "#ED6647", "#8561C8", "#6DDBDB",
      "#FFB54D", "#E371B2", "#47BDEF", "#A2BF39",
      "#A75DBA", "#F7F37B", "#267DB3", "#68C182" 
    ]);
  };

  // Mark this extension is loaded. 
  // You can check this property whether this extension
  // is loaded or not.
  d3['bimad-extension'] = true;
})();
