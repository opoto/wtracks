'use strict';
/* globals
      $, ga, L, config, initGoogleAnalytics,
      getBoolVal, getJsonVal, getVal, storeVal, storeJsonVal, getValStorage,
      objectForEach, arrayForEach, arrayMove,
      copyOnClick
*/

if (config.google && config.google.analyticsid) {
  initGoogleAnalytics(config.google.analyticsid(), config.google.gtagid && config.google.gtagid());
}

/* ---------------------- Start service worker ------------------------ */

let useServiceWorker = getBoolVal("wt.useServiceWorker", config.useServiceWorker);
function getUseServiceWorker() {
  return useServiceWorker;
}
function setUseServiceWorker(v) {
  useServiceWorker = v;
}
function initServiceWorker(isLoaded) {
  function registerSW() {
    navigator.serviceWorker.register('./service-worker.js');
  }
  if ('serviceWorker' in navigator) {
    if (useServiceWorker) {
      if (isLoaded) {
        registerSW();
      } else {
        // Use the window load event to keep the page load performant
        window.addEventListener('load', function() {
          registerSW();
        });
      }
    } else {
      navigator.serviceWorker.getRegistrations().then((regs)=>{
        regs.forEach(reg => {
          reg.unregister();
        });
      });
    }
  }
}
initServiceWorker();

function forceReload() {
  $.ajax(
    { url: window.location.toString(),
      headers:{ 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    }
  ).then((resp)=>{
    if (confirm("Latest WTracks version is needed to proceed, reload now?")) {
      window.location.reload();
    } else {
      console.error("Using old WTracks version will cause errors");
    }
  }).fail((err) => {
    console.error("Cannot get latest WTracks version");
  });
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
  return getVal("wt.saveState", getValStorage() ? "true" : "false");
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

function consentCookies() {
  if (!getValStorage()) return; // skip if cookies are blocked
  var now = new Date();
  var EXPIRATION = Math.round(1000*60*60*24*30.5*18); // 18 months in ms
  var cookies = getVal("wt.cookies");
  if ((!cookies) || (now.getTime() > new Date(cookies).getTime() + EXPIRATION)) {
    $('body').prepend(`
    <div id='cookies-banner' style='display: none;'>
      <button id='cookies-accept'>Got it!</button>
      <div>This website uses cookies and browser's local storage to restore your status and settings on your next visits.
      <a href='doc/#privacy' id='cookies-more'>Read more</a></div>
    </div>`);
    $("#cookies-banner").show();
    $("#cookies-accept").click(function() {
      $("#cookies-banner").hide();
    });
    storeVal("wt.cookies", now.toISOString());
  }
}

/* help buttons */
function toggleHelp(e) {
  $("#" + e.target.id + "-help").toggle();
  $("." + e.target.id + "-help").toggle();
  e.stopPropagation();
  return false;
}
$(".help-b").click(toggleHelp);

copyOnClick(".copyonclick");

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

function setMyMaps(newMyMaps) {
  mymaps = newMyMaps;
}

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
        addMapListEntry(name, MAP_DEF, value.visible);
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

// --------------------------------------------
//  Draggable items list: Workaround for Android Chrome display bug

var isAndroidChromium = false;
if (navigator.userAgentData && navigator.userAgentData.platform == 'Android') {
  arrayForEach(navigator.userAgentData.brands, function(i, brand) {
    if (brand.brand == "Chromium") {
      isAndroidChromium = true;
      return true;
    }
  });
}

function doAndroidChromiumTweak(item) {
  if (isAndroidChromium) {
    item.css("display", "inline-block");
  }
}
