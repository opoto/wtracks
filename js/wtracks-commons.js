if (config.google && config.google.analyticsid) {
  initGoogleAnalytics(config.google.analyticsid());
}

function saveValOpt(name, val) {
  if (config.saveprefs() && isStateSaved()) {
    storeVal(name, val);
  }
}

function saveJsonValOpt(name, val) {
  if (config.saveprefs() && isStateSaved()) {
    storeJsonVal(name, val);
  }
}

/* help buttons */
function toggleHelp(e) {
  $("#" + this.id + "-help").toggle();
  e.stopPropagation();
  return false;
}
$(".help-b").click(toggleHelp);

function copyOnClick(event) {
  if (event.target && document.execCommand) {
    var elt = $("#" + event.target.id.substring(1));
    elt.removeAttr("disabled");
    elt.select();
    document.execCommand("copy");
    var tmp = elt.val();
    elt.val("Text copied to clipboard");
    elt.attr("disabled", "disabled");
    setTimeout(function(){
      elt.removeAttr("disabled");
      elt.val(tmp);
      elt.select();
      elt.attr("disabled", "disabled");
     }, 2000);
  }
}
$(".copyonclick").click(copyOnClick);



var CrsValues = [
  null,
  L.CRS.EPSG3395,
  L.CRS.EPSG3857,
  L.CRS.EPSG4326,
  L.CRS.EPSG900913
];

function getCrsFromName(crsname) {
  for (var i = CrsValues.length - 1; i >=0; i--) {
    var crs = CrsValues[i];
    if (crs && crs.code == crsname) {
      return crs;
    }
  }
  return undefined;
}

function getCrsName(crs) {
  for (var i = CrsValues.length - 1; i >=0; i--) {
    if (CrsValues[i] == crs) {
      return CrsValues[i] ? CrsValues[i].code : "";
    }
  }
  return undefined;
}
