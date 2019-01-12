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

function getStateSaved() {
  return getVal("wt.saveState", null);
}
function isStateSaved() {
  return getStateSaved() === "true";
}
function setSaveState(saveCfg) {
  if (isStateSaved() != saveCfg) {
    ga('send', 'event', 'setting', saveCfg ? 'save-on' : 'save-off');
    storeVal("wt.saveState", saveCfg ? "true" : "false");
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
    elt.select();
    document.execCommand("copy");
    var tmp = elt.val();
    elt.val("Text copied to clipboard");
    setTimeout(function(){
      elt.val(tmp);
      elt.select();
     }, 2000);
  }
}
$(".copyonclick").click(copyOnClick);

$(".link-home").click(function() {
  if ((history.length > 0) && (document.referrer.indexOf(location.origin) == 0)) {
    history.back();
  } else {
    window.location = ".";
  }
  return false;
});

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

// ------------------------ Maps Configuration
var mymaps = getJsonVal("wt.mymaps", {});
var mapsList = getJsonVal("wt.mapslist", [[], []]);
var mapsListNames = mapsList[0];
var mapsListProps = mapsList[1];

var MAP_DEF = '0';
var MAP_MY = '1';

function addMapListEntry(name, _in, _on) {
  mapsListNames.push(name);
  var props = {
    'in': _in,
    'on': _on
  };
  mapsListProps.push(props);
  return props;
}

function delMapListEntry(idx) {
  if (idx >=0) {
    mapsListNames.splice(idx, 1);
    mapsListProps.splice(idx, 1);
  }
}

function moveMapListEntry(from, to) {
  arrayMove(mapsListNames, from, to);
  arrayMove(mapsListProps, from, to);
}

function getMapListEntryIndex(name) {
  return mapsListNames.indexOf(name);
}

function getMapListEntryProps(name) {
  var idx = mapsListNames.indexOf(name);
  return idx >= 0 ?
    mapsListProps[idx] :
    undefined;
}

function renameMapListEntry(oldname, newname) {
  var idx = getMapListEntryIndex(oldname);
  if (idx >=0) {
    mapsListNames[idx] = newname;
  }
}

function resetMapList() {
  mapsList = [[], []];
  mapsListNames = mapsList[0];
  mapsListProps = mapsList[1];
}

function getMapList() {
  if (mapsListNames.length) {
    // check my maps
    objectForEach(mymaps, function(name, value) {
      if (getMapListEntryIndex(name) < 0) {
        addMapListEntry(name, MAP_MY, true);
      }
    });
    // check default maps
    objectForEach(config.maps, function(name, value) {
      if (getMapListEntryIndex(name) < 0) {
        addMapListEntry(name, MAP_DEF, true);
      }
    });
    // deprecated maps
    arrayForEach(mapsListNames, function(idx, value) {
      var inList = mapsListProps[idx]['in'] == MAP_MY ? mymaps : config.maps;
      var name = mapsListNames[idx];
      if (!inList[name]) {
        // remove deprecated map
        delMapListEntry(idx);
      }
    });
  } else {
    // add default maps
    objectForEach(config.maps, function(name, value) {
      addMapListEntry(name, MAP_DEF, value.visible);
    });
    // add my maps
    objectForEach(mymaps, function(name, value) {
      addMapListEntry(name, MAP_MY, true);
    });
  }
  saveMapList();
}
function saveMapList() {
  saveJsonValOpt("wt.mapslist", mapsList);
}
getMapList();

function mapsForEach(func) {
  arrayForEach(mapsListNames, function(idx, value) {
    var name = mapsListNames[idx];
    var prop = mapsListProps[idx];
    func(name, prop);
  });
}
