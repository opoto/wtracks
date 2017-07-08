if (config.google && config.google.analyticsid) {
  initGoogleAnalytics(config.google.analyticsid());
}
if (config.email) {
  setEmailListener(config.email.selector, config.email.name,
    config.email.domain, config.email.subject);
}

function setStatus(msg, options) {
  $("#status-msg").text(msg);
  var statusclass = options && options.class ? options.class : "status-info";
  $("#status-msg").attr("class", statusclass);
  var showspinner = options && !isUnset(options.spinner) && options.spinner;
  $("#spinner").toggle(showspinner);
  $("#status").fadeIn();
  if (options && options.timeout) {
    setTimeout(function() { clearStatus(); }, 1000 * options.timeout);
  }
}

function clearStatus() {
  $("#status").fadeOut(800);
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
}
$(".help-b").click(toggleHelp);

var map = L.map('map', {
  editable: true,
  editOptions: {
    lineGuideOptions: {
      color: "red",
      weight: 4,
      opacity: 0.5
    }
  }
});
var track;
var metadata;
var waypoints;
var editLayer;
var route;
var routeStart;
var polystats;
var NEW_TRACK_NAME = "New Track";

var EDIT_NONE = 0;
var EDIT_MANUAL_TRACK = 1;
var EDIT_AUTO_TRACK = 2;
var EDIT_MARKER = 3;
var EDIT_DEFAULT = EDIT_MANUAL_TRACK;
var editMode = -1;


function setTrackName(name) {
  $("#track-name").text(name);
  document.title = config.appname + " - " + name;
  metadata.name = name;
}

function getTrackName() {
  return metadata.name;
}

function askTrackName() {
  var name = prompt("Track name:", getTrackName());
  if (name) {
    setTrackName(name);
  }
}

function validatePrompt() {
  setTrackName($("#prompt-name").val());
  metadata.desc = $("#prompt-desc").val();
  saveState();
  closeTrackNamePrompt();
}

function promptTrackName() {
  $("#prompt-name").val(getTrackName());
  $("#prompt-desc").val(metadata.desc);
  $("#prompt").show();
  $("#prompt-name").focus();
}

function closeTrackNamePrompt() {
  $("#prompt").hide();
}

function promptKeyEvent(event) {
  if (event.which == 27) {
    closeTrackNamePrompt();
  } else if (event.keyCode == 13) {
    validatePrompt();
  }
}

$("#prompt-name").keyup(function promptKeyEvent(event) {
  if (event.which == 27) {
    closeTrackNamePrompt();
  } else if (event.keyCode == 13) {
    validatePrompt();
  }
});
$("#prompt-desc").keyup(function promptKeyEvent(event) {
  if (event.which == 27) {
    closeTrackNamePrompt();
  }
});

$("#prompt-ok").click(validatePrompt);
$("#prompt-cancel").click(closeTrackNamePrompt);

$("#track-name-edit").click(promptTrackName);


var selectActivity = $("#activity")[0];
var activities;

function loadActivities() {
  activities = getJsonVal("wt.activities");
  if (!activities) {
    activities = config.activities.defaults;
    saveJsonValOpt("wt.activities", activities);
  }
  // append activities
  for (var a in activities) {
    if (hasOwnProperty.call(activities, a)) {
      if (!selectActivity.options[a]) {
        addSelectOption(selectActivity, a);
      }
    }
  }
  // remove deleted activites
  $("#activity option").each(function(i, v) {
    if (!activities[v.innerHTML]) {
      v.remove();
    }
  });
}
loadActivities();
selectOption(selectActivity, getVal("wt.activity", undefined));

function getCurrentActivityName() {
  return $("#activity").children(':selected').val();
}

function getCurrentActivity() {
  var res = getCurrentActivityName();
  log("activity: " + res);
  saveValOpt("wt.activity", res);
  return activities[res];
}
$("#activity").click(loadActivities);
$("#activity").change(function() {
  ga('send', 'event', 'activity', 'change', getCurrentActivityName());
  polystats.setSpeedProfile(getCurrentActivity().speedprofile);
});

/* ------------------------------------------------------------*/

function newTrack() {
  metadata = {};
  if (track) {
    editLayer.removeLayer(track);
    track = undefined;
  }
  if (waypoints) {
    editLayer.removeLayer(waypoints);
  }
  if (editLayer) {
    editLayer.remove();
  }
  if (route) {
    route.remove();
    route = undefined;
  }
  routeStart = undefined;
  editLayer = L.layerGroup([]).addTo(map);
  waypoints = L.featureGroup([]);
  editLayer.addLayer(waypoints);
  track = L.polyline([]);
  track.setStyle({ color: "#F00", dashColor: "#F00", });
  editLayer.addLayer(track);
  polystats = L.Util.polyStats(track, {
    chrono: true,
    speedProfile: getCurrentActivity().speedprofile,
    onUpdate: showStats,
  });
  setTrackName(NEW_TRACK_NAME);
  //  setEditMode(EDIT_NONE);
  showStats();
}

function newWaypoint(latlng, name, desc) {

  function deleteMarker(e) {
    waypoints.removeLayer(marker);
    map.closePopup();
    e.preventDefault();
  }

  function getMarkerPopupContent(marker) {
    var div = L.DomUtil.create('div', "popupdiv"),
      label, input;

    if (editMode === EDIT_MARKER) {

      // name
      label = L.DomUtil.create('div', "popupdiv", div);
      label.innerHTML = "<span class='popupfield'>Name:</span> ";
      var name = L.DomUtil.create('input', "popup-nameinput", label);
      name.type = "text";
      $(name).val(marker.options.title ? marker.options.title : "");
      name.onkeyup = function() {
        var nameval = $(name).val();
        nameval = $('<div/>').text(nameval).html();
        marker.options.title = nameval;
        var elt = marker.getElement();
        elt.title = nameval;
        elt.alt = nameval;
      };

      // description
      label = L.DomUtil.create('div', "popupdiv", div);
      label.innerHTML = "<span class='popupfield'>Desc:</span> ";
      var desc = L.DomUtil.create('textarea', "popup-descinput", label);
      $(desc).val(marker.options.desc ? marker.options.desc : "");
      desc.onkeyup = function() {
        var descval = $(desc).val();
        descval = $('<div/>').text(descval).html();
        marker.options.desc = descval;
      };

    } else {

      // name
      if (marker.options.title) {
        var popupName = L.DomUtil.create('div', "popup-name", div);
        popupName.innerHTML = marker.options.title;
      }

      // description
      if (marker.options.desc) {
        var popupDesc = L.DomUtil.create('div', "popup-desc", div);
        popupDesc.innerHTML = marker.options.desc;
      }
    }



    var latlng = marker.getLatLng();
    var markerDiv = getLatLngPopupContent(latlng, deleteMarker, div);
    return markerDiv;
  }

  var markerIcon = L.icon({
    iconUrl: 'img/marker-icon.png',
    iconRetinaUrl: 'img/marker-icon-2x.png',
    iconSize: [16, 26],
    iconAnchor: [8, 26],
    popupAnchor: [0, 0],
    shadowUrl: 'img/marker-shadow.png',
    shadowRetinaUrl: 'img/marker-shadow-2x.png',
    shadowSize: [26, 26],
    shadowAnchor: [8, 26]
  });
  var marker = L.marker(latlng, {
    title: name,
    desc: desc,
    alt: name,
    icon: markerIcon
  });
  waypoints.addLayer(marker);

  marker.on("click", function() {
    pop = L.popup()
      .setLatLng(marker.getLatLng())
      .setContent(getMarkerPopupContent(marker))
      .openOn(map);
  });

  return marker;
}

/* ------------------------ TRIMMING ---------------------------------- */

var polytrim;

function prepareTrim() {
  var trimMax = Math.round(track.getLatLngs().length / 2);
  $("#trim-txt").text("");
  $("#trim-range").attr("max", trimMax);
  $("#trim-range").val(0);
  $(".no-trim").prop('disabled', false);
  var trimType = $("#trim-type")[0].selectedIndex;
  polytrim = L.Util.polyTrim(track, trimType);
}

function trimTrack(e) {
  var n = parseInt($("#trim-range").val());
  ga('send', 'event', 'tool', 'trim', undefined, n);
  log("trimming " + n);
  $("#trim-txt").text(n + "/" + polytrim.getPolySize());
  $(".no-trim").prop('disabled', (n !== 0));
  polytrim.trim(n);
}

function finishTrim() {
  if (polytrim.getDirection() === polytrim.FROM_END) {
    // From End
    polystats.updateStatsFrom(track.getLatLngs().length - 1);
  } else {
    // From Start
    polystats.updateStatsFrom(0);
  }
  polytrim = undefined;
  saveState();
}

$("#trim-range").on("change", trimTrack);
$("#trim-type").change(prepareTrim);

/* ------------------------ MENU ---------------------------------- */

$("#menu-button").click(function() {
  if (!$("#menu").is(":visible")) {
    setEditMode(EDIT_NONE);
    setChecked("#merge", false);
    menu("file");
    $("#menu").show();
    prepareTrim();
  } else {
    $("#menu").hide();
    finishTrim();
  }
  return false;
});
$("#menu-close").click(function() {
  $("#menu").hide();
  finishTrim();
  return false;
});
$("#track-new").click(function() {
  ga('send', 'event', 'file', 'new');
  newTrack();
  setEditMode(EDIT_MANUAL_TRACK);
  saveState();
});
$("#menu-track").click(function() {
  $(".collapsable-track").toggle();
});
$("#menu-tools").click(function() {
  $(".collapsable-tools").toggle();
});

/* ------------------------ EXPORT GPX ---------------------------------- */

function LatLngToGPX(latlng, gpxelt, name, time, desc) {

  var gpx = "<" + gpxelt;
  gpx += " lat=\"" + latlng.lat + "\" lon=\"" + latlng.lng + "\">";
  if (name) {
    gpx += "<name>" + htmlEncode(name, false, 0) + "</name>";
  }
  if (desc) {
    gpx += "<desc>" + htmlEncode(desc, false, 0) + "</desc>";
  }
  if (latlng.alt) {
    gpx += "<ele>" + latlng.alt + "</ele>";
  }
  if (time) {
    gpx += "<time>" + (typeof time === "string" ? time : time.toISOString()) + "</time>";
  }
  gpx += "</" + gpxelt + ">\n";
  return gpx;
}

function getGPX(trackname, savealt, savetime, asroute, nometadata) {

  var now = new Date();
  var gpx = '<\?xml version="1.0" encoding="UTF-8" standalone="no" \?>\n';
  gpx += '<gpx creator="' + config.appname + '" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
  if (!nometadata) {
    gpx += "<metadata>\n";
    gpx += "  <name>" + trackname + "</name>\n";
    gpx += "  <desc>" + (metadata.desc ? metadata.desc : "") + "</desc>\n";
    gpx += "  <author><name>" + config.appname + "</name></author>\n";
    gpx += "  <link href='" + window.location.href + "'>\n";
    gpx += "    <text>" + config.appname + "</text>\n";
    gpx += "    <type>text/html</type>\n";
    gpx += "  </link>\n";
    gpx += "  <time>" + now.toISOString() + "</time>\n";
    var sw = map.getBounds().getSouthWest();
    var ne = map.getBounds().getNorthEast();
    gpx += '  <bounds minlat="' + Math.min(sw.lat, ne.lat) + '" minlon="' + Math.min(sw.lng, ne.lng) + '" maxlat="' + Math.max(sw.lat, ne.lat) + '" maxlon="' + Math.max(sw.lng, ne.lng) + '"/>\n';
    gpx += "</metadata>\n";
  }
  var wpts = waypoints ? waypoints.getLayers() : undefined;
  if (wpts && wpts.length > 0) {
    var i = 0;
    while (i < wpts.length) {
      var wpt = wpts[i];
      gpx += LatLngToGPX(wpt.getLatLng(), "wpt", wpt.options.title, wpt.getLatLng().time, wpt.options.desc);
      i++;
    }
  }
  var latlngs = track ? track.getLatLngs() : undefined;
  if (latlngs && latlngs.length > 0) {
    var xmlname = "<name>" + trackname + "</name>";
    var ptindent = "  ";
    var pttag;
    if (asroute) {
      gpx += "<rte>" + xmlname + "\n";
      pttag = "rtept";
    } else {
      gpx += "<trk>" + xmlname + "\n  <trkseg>\n";
      ptindent += "  ";
      pttag = "trkpt";
    }
    var j = 0;
    var saveTiming = isChecked("#savetiming");
    now = now.getTime();
    while (j < latlngs.length) {
      var pt = latlngs[j];
      var time;
      if (saveTiming) {
        time = new Date(now + (pt.chrono * 1000));
      } else {
        time = pt.time;
      }
      gpx += ptindent + LatLngToGPX(pt, pttag, undefined, time);
      j++;
    }
    if (asroute) {
      gpx += "</rte>\n";
    } else {
      gpx += "  </trkseg>\n</trk>\n";
    }
  }
  gpx += "</gpx>\n";
  return gpx;
}

function getConfirmedTrackName() {
  var trackname = getTrackName();
  if (!trackname || trackname === NEW_TRACK_NAME) {
    askTrackName();
    trackname = getTrackName();
  }
  return trackname;
}

function getTrackGPX(doConfirmName) {
  var asroute = isChecked("#as-route");
  var nometadata = isChecked("#nometadata");
  var trackname = doConfirmName ? getConfirmedTrackName() : getTrackName();
  return getGPX(trackname, /*savealt*/ false, /*savetime*/ false, asroute, nometadata);
}

$("#track-download").click(function() {
  setEditMode(EDIT_NONE);
  setStatus("Formatting..", { spinner: true });
  var gpx = getTrackGPX(true);
  ga('send', 'event', 'file', 'save', undefined, Math.round(gpx.length / 1000));
  if (isSafari()) alert("A new page will open, press cmd+s (" + String.fromCharCode(8984) + "+s) to save file");
  var blob = new Blob([gpx],
    isSafari() ? { type: "text/plain;charset=utf-8" } : { type: "application/gpx+xml;charset=utf-8" }
  );
  saveAs(blob, getTrackName() + ".gpx");
  clearStatus();
});

function editableWaypoints(editable) {
  var wpts = waypoints.getLayers();
  for (var i = 0; i < wpts.length; i++) {
    if (editable) {
      wpts[i].enableEdit();
    } else {
      wpts[i].disableEdit();
    }
  }
}

function mergeRouteToTrack() {
  if (!route) return;
  var initlen = track.getLatLngs().length;
  var pts = route._selectedRoute ? route._selectedRoute.coordinates : [];
  pts = L.PolyUtil.prune(pts, config.compressdefault);
  ga('send', 'event', 'edit', 'merge', undefined, pts.length);
  route.remove();
  route = undefined;
  routeStart = undefined;
  for (var j = 0; j < pts.length; j++) {
    track.addLatLng(pts[j]);
  }
  elevate(pts, function() {
    polystats.updateStatsFrom(initlen);
  });
}

function setRouteStart(latlng) {
  routeStart = latlng;
  $("#map").css("cursor", "alias");
}

function closeOverlays() {
  // close all
  $("#menu").hide();
  map.closePopup();
  hideElevation();
}

function restartRoute() {
  if (route) {
    route.remove();
    route = undefined;
    routeStart = undefined;
  }
  $("#map").css("cursor", "copy");
  var ll = track.getLatLngs();
  if (ll.length > 0) {
    setRouteStart(ll[ll.length - 1]);
  }
}

function showGraphHopperCredit() {
  $("#map").append("<span class='gh-credit'>Powered by <a href='https://graphhopper.com/#directions-api'>GraphHopper API</a></span>");
}

function hideGraphHopperCredit() {
  $(".gh-credit").remove();
}

function showGraphHopperMessage(msg) {
  setStatus(msg, { timeout: 5, class: "status-error" });
}

function setEditMode(mode) {
  closeOverlays();
  if (mode === editMode) {
    return;
  }
  switch (editMode) {
    case EDIT_MANUAL_TRACK:
      if (track) {
        track.disableEdit();
      }
      break;
    case EDIT_AUTO_TRACK:
      hideGraphHopperCredit();
      mergeRouteToTrack();
      break;
    case EDIT_MARKER:
      editableWaypoints(false);
      break;
    default:
  }
  map.editTools.stopDrawing();
  $("#edit-tools a").removeClass("control-selected");
  if (editMode > 0) { // exiting edit mode
    saveState();
    // reset mouse pointer
    $("#map").css("cursor", "");
  }
  switch (mode) {
    case EDIT_NONE:
      break;
    case EDIT_MANUAL_TRACK:
      $("#edit-manual").addClass("control-selected");
      track.enableEdit();
      track.editor.continueForward();
      break;
    case EDIT_AUTO_TRACK:
      $("#edit-auto").addClass("control-selected");
      showGraphHopperCredit();
      restartRoute();
      break;
    case EDIT_MARKER:
      $("#edit-marker").addClass("control-selected");
      $("#map").css("cursor", "url(img/marker-icon.png) 7 25,text");
      editableWaypoints(true);
      break;
    default:
      error("invalid edit mode: " + mode);
      return;
  }
  editMode = mode;
  $("#edit-tools").toggle(editMode > 0);
}

$("#compress").click(function() {
  // get & check input value
  var prunedist = $("#prunedist");
  var input = prunedist.val().trim();
  var tolerance;
  if (input) {
    tolerance = parseFloat(input);
  }
  if ((tolerance === undefined) || isNaN(tolerance)) {
    alert("Enter distance in meters");
    prunedist.focus();
    return;
  }

  if (track) {
    setEditMode(EDIT_NONE);
    var pts = track.getLatLngs();
    var pruned = L.PolyUtil.prune(pts, tolerance);
    var removedpts = (pts.length - pruned.length);
    ga('send', 'event', 'tool', 'compress', undefined, removedpts);
    if (removedpts > 0) {
      alert("Removed " + removedpts + " points out of " + pts.length + " (" + Math.round((removedpts / pts.length) * 100) + "%)");
      // switch to new values
      track.setLatLngs(pruned);
      saveState();
    } else {
      setStatus("Already optimized", { timeout: 3 });
    }
  }
});

function getMyIpLocation() {
  log("Getting location from IP address");
  var geoapi = "https://freegeoip.net/json/?callback=";
  $.getScript(geoapi + "setMyIpLocation")
    .fail(function(jqxhr, settings, exception) {
      warn("freegeoip request failed");
    });
}

function setMyIpLocation(res) {
  setLocation({
    lat: res.latitude,
    lng: res.longitude
  }, false);
}

var myLocIcon = L.icon({
  iconUrl: 'img/mylocation.png',
  iconSize: [48, 48],
  iconAnchor: [24, 24]
});
var myLocMarker;
var myLocTimer;
var
  LOC_NONE = 0,
  LOC_ONCE = 1,
  LOC_CONTINUOUS = 2,
  showLocation = LOC_NONE;

function removeMyLocMarker() {
  if (showLocation == LOC_CONTINUOUS) {
    gotoMyLocation();
  } else {
    showLocation = LOC_NONE;
    if (myLocMarker) {
      myLocMarker.remove();
      myLocMarker = undefined;
    }
  }
}

function setLocation(pos, showIcon) {
  if (showLocation == LOC_NONE) return; // cancelled in the meantime
  var zoom = map.getZoom() ? map.getZoom() : config.display.zoom;
  map.setView(pos, zoom);
  if (myLocMarker) {
    clearTimeout(myLocTimer);
    myLocMarker.remove();
  }
  if (showIcon) {
    myLocMarker = new L.marker([pos.lat, pos.lng], { icon: myLocIcon, clickable: false });
    myLocMarker.addTo(map);
  }
  if (showIcon || (showLocation == LOC_CONTINUOUS)) {
    myLocTimer = setTimeout(removeMyLocMarker, 5000);
  } else {
    showLocation = LOC_NONE;
  }
}

function gotoMyLocation() {

  function gotLocation(position) {
    log("Got location");
    setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude
    }, true);
  }

  function highAccuracyFailed(posError) {
    log("GPS location failed, trying low accuracy");
    navigator.geolocation.getCurrentPosition(
      gotLocation, lowAccuracyFailed, { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false });
  }

  function lowAccuracyFailed(posError) {
    log("low accuracy geolococation failed");
    getMyIpLocation();
  }


  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      gotLocation, highAccuracyFailed, { maximumAge: 0, timeout: 5000, enableHighAccuracy: true });
  } else {
    log("no runtime geolococation available");
    getMyIpLocation();
  }
}

function getSavedPosition(_lat, _lng) {
  var vlat = getVal("wt.poslat", _lat);
  var vlng = getVal("wt.poslng", _lng);
  var pos = {
    lat: parseFloat(vlat),
    lng: parseFloat(vlng)
  };
  // ask for position on first use
  if (vlat == _lat && vlng == _lng) {
    setTimeout(function() {
      showLocation = LOC_ONCE;
      gotoMyLocation();
    }, 1000);
  }
  return pos;
}

function savePosition() {
  var pos = map.getCenter();
  saveValOpt("wt.poslat", pos.lat);
  saveValOpt("wt.poslng", pos.lng);
}

function saveEditMode() {
  if (editMode >= 0) saveValOpt("wt.editMode", editMode);
}

function saveTrack() {
  var trackname = getTrackName();
  var numPts = track.getLatLngs().length + waypoints.getLayers().length;
  if (numPts < 1000) {
    var gpx = getGPX(trackname, /*savealt*/ false, /*savetime*/ false, /*asroute*/ false, /*nometadata*/ false);
    saveValOpt("wt.gpx", gpx);
  }
}

function saveState() {
  if (isStateSaved()) {
    saveTrack();
    savePosition();
    saveEditMode();
  }
}

function restoreEditMode() {
  var restoredMode = getVal("wt.editMode", EDIT_DEFAULT);
  setEditMode(parseInt(restoredMode));
}

function restorePosition() {
  var defpos = getSavedPosition(config.display.pos.lat, config.display.pos.lng);
  showLocation = LOC_ONCE;
  setLocation(defpos); // required to initialize map
}

function restoreTrack() {
  var gpx = getVal("wt.gpx", null);
  if (gpx) {
    loadCount = 0;
    fileloader.loadData(gpx, "dummy", "gpx");
    return true;
  } else {
    newTrack();
    return false;
  }
}

function saveInfo(save) {
  $("#save-info").hide();
  setChecked("#cfgsave", save);
  $("#cfgsave").change();
}
$("#save-yes").click(function() {
  saveInfo(true);
});
$("#save-no").click(function() {
  saveInfo(false);
});

function restoreState() {
  var isSaving = getVal("wt.saveState", null);
  if (isUnset(isSaving)) {
    $("#save-info").show();
  } else {
    setChecked("#cfgsave", isSaving == "true");
  }
  if (!restoreTrack()) {
    restorePosition();
  }
  restoreEditMode();
}

function clearSavedState() {
  storeVal("wt.gpx", undefined);
  storeVal("wt.poslat", undefined);
  storeVal("wt.poslng", undefined);
  storeVal("wt.editMode", undefined);
  storeVal("wt.baseLayer", undefined);
  storeVal("wt.overlays", undefined);
  storeVal("wt.activity", undefined);
  storeVal("wt.activities", undefined);
}

function saveMapType() {
  saveValOpt("wt.maptype", map.getMapTypeId());
}

function getProvider(name) {
  var p;
  if (name == "opentopomap") {
    p = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });
  } else if (name == "osm:std") {
    p = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  } else if (name == "osm:hot") {
    p = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  } else if (name == "tf:cycle") {
    p = L.tileLayer('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=' + config.thunderforest.key(), {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

  } else if (name == "sigma:cycle") {
    p = L.tileLayer('https://tiles1.sigma-dc-control.com/layer5/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="http://www.sigmasport.com/" target="_blank">SIGMA Sport &reg;</a> Map data <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>'
    });
  } else if (name == "tf:outdoors") {
    p = L.tileLayer('https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=' + config.thunderforest.key(), {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  } else if (name == "wmf:hikebike") {
    //p = L.tileLayer('http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png', {
    p = L.tileLayer('https://tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  } else if (name == "esri:worldtopomap") {
    p = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri and GIS Community'
    });
  } else if (name == "esri:worldstreetmap") {
    p = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri &amp; al.'
    });
  } else if (name == "mtbmap") {
    p = L.tileLayer('http://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; USGS'
    });
  } else if (name == "map1.eu") {
    p = L.tileLayer('http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg', {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; <a href="http://map1.eu">map1.eu</a>'
    });
  } else if (name == 'google:roadmap') {
    p = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
  } else if (name == 'google:terrain') {
    p = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
  } else if (name == 'google:satellite') {
    p = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
  } else if (name == 'google:hybrid') {
    p = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google'
    });
  } else if (name == 'wmf:hills') {
    //p = L.tileLayer('http://{s}.tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',{
    p = L.tileLayer('https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Hillshading: SRTM3 v2 (<a href="https://www2.jpl.nasa.gov/srtm/">NASA</a>)'
    });
  } else if (name == 'lv:hike') {
    p = L.tileLayer('http://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Hiking Routes: (<a href="http://hiking.lonvia.de">Lonvias Hiking Map</a>)'
    });
  } else if (name == 'lv:bike') {
    p = L.tileLayer('http://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Cycling Routes: (<a href="http://cycling.lonvia.de">Lonvias Cycling Map</a>)'
    });
  } else if (name == 'fr:ignclassic') {
    p = L.tileLayer.wtms(
      "https://wxs.ign.fr/" + config.ign.key() + "/geoportail/wmts", {
        layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
        style: 'normal',
        tilematrixSet: "PM",
        format: 'image/jpeg',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>"
      });
  } else if (name == 'fr:ignexpress') {
    p = L.tileLayer.wtms(
      "https://wxs.ign.fr/" + config.ign.key() + "/geoportail/wmts", {
        layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD',
        style: 'normal',
        tilematrixSet: "PM",
        format: 'image/jpeg',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>"
      });
  } else if (name == 'fr:ignimagery') {
    p = L.tileLayer.wtms(
      "https://wxs.ign.fr/" + config.ign.key() + "/geoportail/wmts", {
        layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
        style: 'normal',
        tilematrixSet: "PM",
        format: 'image/jpeg',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>"
      });
  } else if (name == 'spain:ignraster') {
    // https://github.com/sigdeletras/Leaflet.Spain.WMS
    p = L.tileLayer.wms('https://www.ign.es/wms-inspire/mapa-raster', {
      layers: 'mtn_rasterizado',
      format: 'image/png',
      transparent: false,
      continuousWorld: true,
      attribution: '© <a href="http://www.ign.es/ign/main/index.do" target="_blank">Instituto Geográfico Nacional de España</a>'
    });
  } else if (name == 'spain:icgc') {
    p = L.tileLayer.wtms(
      "https://geoserveis.icgc.cat/icc_mapesmultibase/noutm/wmts/service", {
        layer: 'topo',
        style: 'normal',
        tilematrixSet: "GRID3857",
        format: 'image/jpeg',
        attribution: "&copy; Institut Cartogràfic i Geològic de Catalunya - ICGC"
      });
  }
  if (!p) {
    p = getProvider("osm:std");
  }
  return p;
}

var baseLayers = {
  "Open Topo": getProvider("opentopomap"),
  "OpenStreetMap": getProvider("osm:std"),
  "OpenCycleMap": getProvider("tf:cycle"),
  "Outdoors": getProvider("tf:outdoors"),
  "Sigma Cycle": getProvider("sigma:cycle"),
  "OSM HOT": getProvider("osm:hot"),
  "OSM HikeBike": getProvider("wmf:hikebike"),
  "ESRI Topo": getProvider("esri:worldtopomap"),
  "ESRI Street": getProvider("esri:worldstreetmap"),
  "MTB (*)": getProvider("mtbmap"),
  "Map1.eu (*)": getProvider("map1.eu"),
  "Google roads": getProvider('google:roadmap'),
  "Google Terrain": getProvider('google:terrain'),
  "Google Satellite": getProvider('google:satellite'),
  "Google Hybrid": getProvider('google:hybrid'),
  "FR IGN classic": getProvider("fr:ignclassic"),
  "FR IGN express": getProvider("fr:ignexpress"),
  //"FR IGN aerial": getProvider("fr:ignimagery")
  "ES IGN": getProvider("spain:ignraster"),
  "ES ICGC": getProvider("spain:icgc")
};
var overlays = {
  "Hillshading": getProvider("wmf:hills"),
  "Hiking Routes (*)": getProvider("lv:hike"),
  "Cycling Routes (*)": getProvider("lv:bike"),
};

L.control.layers(baseLayers, overlays).addTo(map);
map.addLayer(baseLayers[getVal("wt.baseLayer", config.display.map)] || baseLayers[config.display.map]);
map.on("baselayerchange", function(e) {
  ga('send', 'event', 'map', 'baselayer', e.name);
  saveValOpt("wt.baseLayer", e.name);
  $(".leaflet-control-layers").removeClass("leaflet-control-layers-expanded");
});

function getOverlays() {
  var v = getJsonVal("wt.overlays");
  return v || {};
}

function setOverlay(name, yesno) {
  var cfg = getOverlays();
  cfg[name] = yesno;
  saveJsonValOpt("wt.overlays", cfg);
}

if (JSON.parse && JSON.stringify) {

  var cfg = getOverlays();
  for (var name in cfg) {
    if (cfg.hasOwnProperty(name) && cfg[name]) {
      var ol = overlays[name];
      if (ol) {
        map.addLayer(overlays[name]);
      } else {
        // doesn't exist anymore, delete it
        setOverlay(name, undefined);
      }
    }
  }

  map.on("overlayadd", function(e) {
    setOverlay(e.name, true);
  });

  map.on("overlayremove", function(e) {
    setOverlay(e.name, false);
  });

}
restorePosition();

$(".leaflet-control-layers-list").append("<div class='leaflet-control-layers-separator'></div>");
$(".leaflet-control-layers-list").append("<div>(*): no https</div>");

// http://www.datasciencetoolkit.org/developerdocs#coordinates2statistics API - free
function elevateDSTK(pt, cb) {

  var elevateDSTKerror = function(jqXHR, textStatus, errorThrown) {
    setStatus("Elevation failed", { timeout: 3, class: "status-error" });
    error('Error: ' + textStatus);
    // callback
    if (cb) cb(false);
  };
  var elevateDSTKcb = function(result) {
    var ok = isUndefined(result.error);
    if (ok) {
      clearStatus();
      pt.alt = result[0].statistics.elevation.value;
      // callback
      if (cb) cb(true);
    } else {
      elevateDSTKerror(null, result.error);
    }
  };

  var apiUrl = "http://www.datasciencetoolkit.org/coordinates2statistics/" + pt.lat + "%2c" + pt.lng + "?statistics=elevation";

  $.ajax(apiUrl, {
    success: elevateDSTKcb,
    error: elevateDSTKerror,
    dataType: 'jsonp',
    crossDomain: true
  });

}

// Google elevation API - free upto 2500 req per day (max 512 points per req)
function elevateGoogle(points, cb) {
  if (!points || (points.length === 0)) {
    return;
  }
  var locations;
  var inc;
  if (isUndefined(points.length)) {
    locations = [points];
  } else {
    setStatus("Elevating..", { spinner: true });
    inc = Math.round(Math.max(1, points.length / 512));
    if (inc == 1) {
      locations = points;
    } else {
      locations = [];
      for (var i = 0; i < points.length; i += inc) {
        locations.push(points[i]);
      }
      // make sure last point is included
      if (i < points.length) {
        locations.push(points[points.length - 1]);
      }
    }
  }
  var elevator = new google.maps.ElevationService();
  elevator.getElevationForLocations({
    'locations': locations
  }, function(results, status) {
    if (status === 'OK') {
      clearStatus();
      if (points.length) {
        for (var i = 0; i < points.length; i += inc) {
          var pos = i * inc;
          points[pos < points.length ? pos : points.length].alt = results[i].elevation;
        }
      } else {
        points.alt = results[0].elevation;
      }
    } else {
      setStatus("Elevation failed", { timeout: 3, class: "status-error" });
      warn("elevation request not OK: " + status);
    }
    // callback
    if (cb) cb(status === 'OK');
  });
}
var elevate = elevateGoogle;
var elevatePoint = elevateGoogle;


function flatten() {
  setStatus("Flatening..", { spinner: true });
  var points = track ? track.getLatLngs() : undefined;
  if (points && (points.length > 0)) {
    for (var i = 0; i < points.length; i++) {
      points[i].alt = 0;
    }
  }
  clearStatus();
}

function revert() {
  var points = track ? track.getLatLngs() : undefined;
  if (points && (points.length > 0)) {
    setStatus("Reverting..", { spinner: true });
    var newpoints = [];
    for (var i = points.length - 1; i >= 0; i--) {
      newpoints.push(points[i]);
    }
    track.setLatLngs(newpoints);
    polystats.updateStatsFrom(0);
    clearStatus();
  }
}

new L.Control.GeoSearch({
  provider: new L.GeoSearch.Provider.OpenStreetMap(),
  position: 'topleft',
  showMarker: false,
  showPopup: true,
  customIcon: false,
  retainZoomLevel: true,
  draggable: false
}).addTo(map);

L.MyLocationControl = L.Control.extend({

  options: {
    position: 'topleft',
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-edit'),
      link = L.DomUtil.create('a', '', container);

    link.href = '#';
    link.title = 'My location';
    link.innerHTML = '<span id="myloc" class="wtracks-control-icon">&nbsp;</span>';
    //link.id = 'myloc';
    L.DomEvent.disableClickPropagation(link);
    L.DomEvent.on(link, 'click', L.DomEvent.stop)
      .on(link, 'click', function(e) {
        map.closePopup();
        if (showLocation == LOC_CONTINUOUS) {
          showLocation = LOC_NONE;
          $("#myloc").removeClass("control-selected");
          removeMyLocMarker();
        } else if (showLocation == LOC_ONCE) {
          showLocation = LOC_CONTINUOUS;
          $("#myloc").addClass("control-selected");
        } else {
          showLocation = LOC_ONCE;
          gotoMyLocation();
        }
      }, this);

    return container;
  }

});
map.addControl(new L.MyLocationControl());

L.EditControl = L.Control.extend({

  options: {
    position: 'topleft',
    kind: '',
    html: '',
    event: 'click'
  },

  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-edit'),
      link = L.DomUtil.create('a', '', container),
      editopts = L.DomUtil.create('span', '', container);

    link.href = '#';
    link.title = this.options.title;
    link.innerHTML = this.options.html;
    L.DomEvent.disableClickPropagation(link);
    L.DomEvent.on(link, this.options.event, L.DomEvent.stop)
      .on(link, this.options.event, function(e) {
        map.closePopup();
        var et = $("#edit-tools");
        et.toggle();
        if (!et.is(":visible")) {
          setEditMode(EDIT_NONE);
        }
      }, this);

    editopts.id = 'edit-tools';
    editopts.class = 'wtracks-control-icon';
    editopts.innerHTML = '<a href="#" title="Manual Track" id="edit-manual"><span class="wtracks-control-icon">&nbsp;</span></a><a href="#" title="Auto Track" id="edit-auto"><span class="wtracks-control-icon">&nbsp;</span></a><a href="#" title="Waypoint" id="edit-marker"><span class="wtracks-control-icon">&nbsp;</span></a>';

    return container;
  }

});
L.EditorControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    title: 'Toggle Edit',
    html: '&#x270e;',
    event: 'click'
  }
});
map.addControl(new L.EditorControl());

$("body").keydown(function(event) {
  if (event.which == 27) {
    setEditMode(EDIT_NONE);
  }
});


L.DomEvent.disableClickPropagation(L.DomUtil.get("edit-manual"));
L.DomEvent.disableClickPropagation(L.DomUtil.get("edit-auto"));
L.DomEvent.disableClickPropagation(L.DomUtil.get("edit-marker"));
$("#edit-manual").click(function(e) {
  ga('send', 'event', 'edit', 'manual');
  //$("#edit-tools").hide();
  setEditMode(EDIT_MANUAL_TRACK);
  e.preventDefault();
});
$("#edit-auto").click(function(e) {
  ga('send', 'event', 'edit', 'auto');
  if (checkGraphHopperCredit()) {
    setEditMode(EDIT_AUTO_TRACK);
  }
  e.preventDefault();
});
$("#edit-marker").click(function(e) {
  ga('send', 'event', 'edit', 'marker');
  //$("#edit-tools").hide();
  setEditMode(EDIT_MARKER);
  e.preventDefault();
});

$("#elevate").click(function(e) {
  ga('send', 'event', 'tool', 'elevate', undefined, track.getLatLngs().length);
  $("#menu").hide();
  if (track) elevate(track.getLatLngs(), function() {
    polystats.updateStatsFrom(0);
    saveState();
  });
  return false;
});
$("#flatten").click(function(e) {
  ga('send', 'event', 'tool', 'flatten', undefined, track.getLatLngs().length);
  $("#menu").hide();
  flatten();
  saveState();
  return false;
});

$("#revert").click(function(e) {
  ga('send', 'event', 'tool', 'revert', undefined, track.getLatLngs().length);
  $("#menu").hide();
  revert();
  saveState();
  return false;
});

$(".statistics").click(function(e) {
  var tag = e.target.tagName.toUpperCase();
  if ((tag !== "SELECT") && (tag !== "OPTION")) {
    toggleElevation(e);
  }
});

function importGeoJson(geojson) {

  setStatus("Loading..", { spinner: true });
  $("#edit-tools").hide();
  var bounds;
  var merge = loadCount > 0 ||  isChecked("#merge");
  loadCount++;
  if (!merge) {
    newTrack();
    bounds = L.latLngBounds([]);
  } else {
    bounds = L.latLngBounds(track.getLatLngs());
  }

  function newPoint(coord, time, i) {
    var point = L.latLng(coord[1], coord[0]);
    if (coord.length > 2) {
      // alt
      point.alt = coord[2];
    }
    if (!isUndefined(time)) {
      point.time = time;
    }
    if (!isUndefined(i)) {
      point.i = i;
    }
    return point;
  }

  function importLine(name, coords, times) {
    var v = track.getLatLngs();
    if ((v.length === 0) && (metadata.name == NEW_TRACK_NAME)) {
      setTrackName(name);
    }
    // import polyline vertexes
    for (var i = 0; i < coords.length; i++) {
      v.push(newPoint(coords[i], times ? times[i] : undefined, i));
    }

    track.setLatLngs(v);
    bounds.extend(track.getBounds());
  }

  if ((track.getLatLngs.length === 0) && (geojson.metadata)) {
    metadata = geojson.metadata;
    if (metadata.name) {
      setTrackName(metadata.name);
    }
  }

  L.geoJson(geojson, {
    onEachFeature: function(f) {
      var name, coords, times;
      if (f.geometry.type === "LineString") {
        name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
        coords = f.geometry.coordinates;
        times = f.properties.coordTimes && (f.properties.coordTimes.length == coords.length) ? f.properties.coordTimes : undefined;
        importLine(name, coords, times);
      }
      if (f.geometry.type === "MultiLineString") {
        name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
        for (var i = 0; i < f.geometry.coordinates.length; i++) {
          coords = f.geometry.coordinates[i];
          times = f.properties.coordTimes[i] && (f.properties.coordTimes[i].length == coords.length) ? f.properties.coordTimes[i] : undefined;
          importLine(name, coords, times);
        }
      } else if (f.geometry.type === "Point") {
        // import marker
        coords = f.geometry.coordinates;
        var latlng = newPoint(coords);
        newWaypoint(latlng, f.properties.name, f.properties.description || f.properties.desc);
        bounds.extend(latlng);
      }
    }
  });
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  }
  clearStatus();
  polystats.updateStatsFrom(0);
  saveState();
  return editLayer;
}

var loadcontrol = L.Control.fileLayerLoad({
  // Allows you to use a customized version of L.geoJson.
  // For example if you are using the Proj4Leaflet leaflet plugin,
  // you can pass L.Proj.geoJson and load the files into the
  // L.Proj.GeoJson instead of the L.geoJson.
  layer: importGeoJson,
  // See http://leafletjs.com/reference.html#geojson-options
  //layerOptions: {},
  // Add to map after loading (default: true) ?
  addToMap: false,
  // File size limit in kb (default: 1024) ?
  fileSizeLimit: config.maxfilesize,
  // Restrict accepted file formats (default: .geojson, .kml, and .gpx) ?
  formats: [
        '.gpx',
        '.geojson',
        '.kml'
    ],
  fitBounds: false
});
map.addControl(loadcontrol);
var fileloader = loadcontrol.loader;
var loadCount = 0;
fileloader.on('data:error', function(e) {
  setStatus("Failed: check file and type", { 'class': 'status-error', 'timeout': 3 });
});

function loadFromUrl(url, ext, direct) {
  setStatus("Loading...", { "spinner": true });
  var _url = direct ? url : config.corsproxy.url() + config.corsproxy.query + url;
  $.get(_url, function(data) {
    loadCount = 0;
    fileloader.loadData(data, url, ext);
  }).fail(function(resp) {
    setStatus("Failed: " + resp.statusText, { 'class': 'status-error', 'timeout': 3 });
  });
}

function getLoadExt() {
  var ext = $("#track-ext").children(':selected').val();
  if (ext === "auto") {
    ext = undefined;
  }
  return ext;
}
$("#track-get").click(function() {
  var url = $("#track-get-url").val().trim();
  if (!url) {
    $("#track-get-url").focus();
    return;
  }
  ga('send', 'event', 'file', 'load-url');
  setEditMode(EDIT_NONE);
  loadFromUrl(url, getLoadExt());
});
$("#track-get-url").keypress(function(e) {
  if (e.which == 13) {
    $("#track-get").click();
  }
});

$("#track-upload").click(function() {
  $("#track-upload").val("");
});
$("#track-upload").change(function() {
  var files = $("#track-upload")[0].files;
  if (files[0]) {
    ga('send', 'event', 'file', 'load-file');
    setEditMode(EDIT_NONE);
    setStatus("Loading...", { spinner: true });
    loadCount = 0;
    fileloader.loadMultiple(files, getLoadExt());
  }
});
map.getContainer().addEventListener("drop", function() {
  loadCount = 0;
});

/*-- DropBox --*/

var dropboxLoadOptions = {

  // Required. Called when a user selects an item in the Chooser.
  success: function(files) {
    $("#menu").hide();
    ga('send', 'event', 'file', 'load-dropbox');
    loadFromUrl(files[0].link, getLoadExt(), true);
  },

  // Optional. Called when the user closes the dialog without selecting a file
  // and does not include any parameters.
  cancel: function() {

  },

  // Optional. "preview" (default) is a preview link to the document for sharing,
  // "direct" is an expiring link to download the contents of the file. For more
  // information about link types, see Link types below.
  linkType: "direct", // or "preview"

  // Optional. A value of false (default) limits selection to a single file, while
  // true enables multiple file selection.
  multiselect: false, // or true

  // Optional. This is a list of file extensions. If specified, the user will
  // only be able to select files with these extensions. You may also specify
  // file types, such as "video" or "images" in the list. For more information,
  // see File types below. By default, all extensions are allowed.
  //extensions: ['.gpx', '.json', '.kml', '.geojson'],
};
$("#dropbox-chooser").click(function(e) {
  Dropbox.choose(dropboxLoadOptions);
});

var dropboxSaveOptions = {
  files: [
    {
      url: "",
      filename: "",
      mode: "overwrite",
      autorename: false,
      }
    ],

  // Success is called once all files have been successfully added to the user's
  // Dropbox, although they may not have synced to the user's devices yet.
  success: function(res) {
    // Indicate to the user that the files have been saved.
    setStatus(response || "File saved", { timeout: 3 });
    $("#menu").hide();
  },

  // Progress is called periodically to update the application on the progress
  // of the user's downloads. The value passed to this callback is a float
  // between 0 and 1. The progress callback is guaranteed to be called at least
  // once with the value 1.
  progress: function(progress) {},

  // Cancel is called if the user presses the Cancel button or closes the Saver.
  cancel: function() {},

  // Error is called in the event of an unexpected response from the server
  // hosting the files, such as not being able to find a file. This callback is
  // also called if there is an error on Dropbox or if the user is over quota.
  error: function(errorMessage) {
    setStatus(errorMessage || "Failed", { timeout: 5, class: "status-error" });
  }
};
$("#dropbox-saver").click(function(e) {
  dropboxSaveOptions.files[0].filename = getConfirmedTrackName() + ".png";
  var gpx = getTrackGPX(false);
  dropboxSaveOptions.files[0].url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAMCAYAAABvEu28AAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AEEFQYCyiuo9AAAABxJREFUKM9jZGBg+M9ABcDEMAoIAcbRwB7JgQ0A/wcDB9ggv60AAAAASUVORK5CYII=";
  Dropbox.save(dropboxSaveOptions);
});


/* ------------ */

function newRouteWaypoint(i, waypoint, n) {

  function getRouteWaypoinContent(latlng, index) {
    var div = document.createElement("div");

    p = L.DomUtil.create("div", "popupdiv", div);
    var del = L.DomUtil.create('a', "", p);
    del.class = "sympol red";
    del.href = "#";
    del.title = "Delete";
    del.innerHTML = "<span class='popupfield'>DELETE</span>";
    del.onclick = function(e) {
      var wpts = route.getWaypoints();
      if (wpts.length > 2) {
        wpts.splice(index, 1);
        route.setWaypoints(wpts);
      } else {
        restartRoute();
      }
      map.closePopup();
      e.preventDefault();
    };

    return div;
  }

  if ((track.getLatLngs().length > 0) && (i === 0)) {
    // no start marker for routes that continue an existing track
    return undefined;
  }
  var marker = L.marker(waypoint.latLng, {
    draggable: true
  });

  marker.on("click", function(e) {

    var pop = L.popup()
      .setLatLng(e.latlng)
      .setContent(getRouteWaypoinContent(e.latlng, i))
      .openOn(map);

  });

  return marker;
}



function getTrackPointPopupContent(latlng) {
  var div = L.DomUtil.create('div', "popupdiv"),
    data;

  var pts = track.getLatLngs();
  var last = pts[pts.length - 1];
  var first = pts[0];
  var stats = track.stats;

  data = L.DomUtil.create('div', "popupdiv", div);
  data.innerHTML = "<span class='popupfield'>Distance:</span> " +
    dist2txt(latlng.dist) + " / " + dist2txt(last.dist * 2 - latlng.dist);
  data = L.DomUtil.create('div', "popupdiv", div);
  data.innerHTML = "<span class='popupfield'>Time:</span> " +
    time2txt(latlng.chrono) + " / " + time2txt(latlng.chrono_rt);

  return div;

}

function getLatLngPopupContent(latlng, deletefn, toadd) {
  var div = document.createElement("div");

  var p = L.DomUtil.create("div", "popupdiv", div);
  p.innerHTML = "<span class='popupfield'>Position:</span> " + latlng.lat + "," + latlng.lng;

  if (editMode != EDIT_NONE) {

    p = L.DomUtil.create("div", "popupdiv", div);
    p.innerHTML = "<span class='popupfield'>Altitude:</span> ";
    var altinput = L.DomUtil.create('input', "", p);
    altinput.type = "text";
    altinput.size = "5";
    $(altinput).val(isUndefined(latlng.alt) || !$.isNumeric(latlng.alt) ? "" : latlng.alt);
    altinput.onkeyup = function() {
      try {
        latlng.alt = $.isNumeric(altinput.value) ? parseFloat(altinput.value) : undefined;
      } catch (e) {}
    };
    p = L.DomUtil.create("span", "", p);
    p.innerHTML = "m";
  } else {
    if (!isUndefined(latlng.alt)) {
      p = L.DomUtil.create("div", "popupdiv", div);
      p.innerHTML = "<span class='popupfield'>Altitude:</span> " + latlng.alt + "m";
    }
  }

  if (toadd) {
    div.appendChild(toadd);
  }

  if (editMode != EDIT_NONE) {
    p = L.DomUtil.create("div", "popupdiv", div);
    var del = L.DomUtil.create('a', "", p);
    del.href = "#";
    del.title = "Delete";
    del.innerHTML = "<span class='popupfield'>DELETE</span>";
    del.onclick = deletefn;
  }

  return div;
}

function alt2txt(alt) {
  if (alt === undefined) {
    return "?";
  } else {
    alt = Math.round(alt);
    return alt + "m";
  }
}


function dist2txt(dist) {
  dist = Math.round(dist);
  if (dist > 5000) {
    return (dist / 1000).toFixed(1) + "km";
  } else {
    return dist + "m";
  }
}

function time2txt(time) {
  var strTime = "";
  if (time >= 3600) strTime += Math.floor(time / 3600) + "h";
  time %= 3600;
  if (time >= 60) strTime += Math.floor(time / 60) + "m";
  time %= 60;
  strTime += Math.round(time) + "s";
  return strTime;
}

function showStats() {
  var pts = track ? track.getLatLngs() : undefined;
  if (pts && pts.length > 0) {
    var last = pts[pts.length - 1];
    var first = pts[0];
    var stats = track.stats;
    $("#distow").text(dist2txt(last.dist));
    $("#distrt").text(dist2txt(2 * last.dist));
    $("#timeow").text(time2txt(last.chrono));
    $("#timert").text(time2txt(first.chrono_rt));
    $("#altmin").text(alt2txt(stats.minalt));
    $("#altmax").text(alt2txt(stats.maxalt));
    $("#climbing").text("+" + alt2txt(stats.climbing));
    $("#descent").text(alt2txt(stats.descent));
  } else {
    $("#distow").text(dist2txt(0));
    $("#distrt").text(dist2txt(0));
    $("#timeow").text(time2txt(0));
    $("#timert").text(time2txt(0));
    $("#altmin").text(alt2txt(0));
    $("#altmax").text(alt2txt(0));
    $("#climbing").text("+" + alt2txt(0));
    $("#descent").text("-" + alt2txt(0));
  }
}


map.on('popupclose', function(e) {
  //console.log(e.type);
  if ((editMode === EDIT_MANUAL_TRACK) && (track.editor)) {
    track.editor.continueForward();
  }
});
map.on('editable:enable', function(e) {
  //console.log(e.type);
});
map.on('editable:drawing:start', function(e) {
  //console.log(e.type);
});
map.on('editable:drawing:dragend', function(e) {
  //console.log(e.type);
});
map.on('editable:drawing:commit', function(e) {
  //console.log(e.type);
});
map.on('editable:drawing:end', function(e) {
  //console.log(e.type);
});
map.on('editable:drawing:click', function(e) {
  //console.log(e.type);
});
map.on('editable:shape:new', function(e) {
  //console.log(e.type);
});
map.on('editable:vertex:new', function(e) {
  var latlng = e.vertex.getLatLng();
  var prev = e.vertex.getPrevious();
  i = isUndefined(prev) ? 0 : prev.latlng.i + 1;
  latlng.i = i;
  //console.log(e.type + ": " + latlng.i);
  if (i == track.getLatLngs().length - 1) {
    // last vertex
    elevatePoint(latlng, function() {
      polystats.updateStatsFrom(i);
    });
  }
});
map.on('editable:vertex:dragend', function(e) {
  var i = e.vertex.getLatLng().i;
  elevatePoint(e.vertex.getLatLng(), function() {
    polystats.updateStatsFrom(i);
  });
  //console.log(e.type + ": " + i);
});
map.on('editable:middlemarker:mousedown', function(e) {
  //console.log(e.type);
});
map.on('editable:dragend', function(e) {
  elevatePoint(e.layer.getLatLng());
  //console.log(e.type);
});

map.on('editable:vertex:deleted', function(e) {
  var i = e.latlng.i;
  //console.log(e.type + ": " + i);
  polystats.updateStatsFrom(i);
});


map.on('editable:created', function(e) {
  //console.log("Created: " + e.layer.getEditorClass());
});

var MAX_GH_CREDITS = 200;

function checkGraphHopperCredit(e) {
  var gh = getJsonVal("wt.gh", { credits: 0, reset: new Date(0) });

  // check GraphHopper response
  if (!isUnset(e)) {
    log("GraphHopper credits: " + e.credits);
    var now = new Date();
    var resetDate = new Date(now.getTime() + (e.reset * 1000));
    if (resetDate > Date.parse(gh.reset)) {
      gh.reset = resetDate;
      gh.credits = 0;
    }
    if ((e.status >= 400) || (e.remaining === 0)) {
      gh.credits = -1;
    } else if (gh.credits >= 0) {
      gh.credits += e.credits;
    }
    storeJsonVal("wt.gh", gh);
  }

  var message;
  if (gh.credits < 0) {
    if (!isUnset(e)) {
      ga('send', 'event', 'gh', 'wt-max');
    }
    message = "WTracks's GraphHopper quota exceeded";
  } else if (gh.credits >= MAX_GH_CREDITS) {
    message = "You exceeded your GraphHopper quota limit";
    if (!isUnset(e)) {
      ga('send', 'event', 'gh', 'user-max');
      setEditMode(EDIT_NONE);
    }
  }
  if (message) {
    showGraphHopperMessage(message);
    return false;
  }
  return true;
}

map.on('click', function(e) {

  if (editMode == EDIT_MARKER) {
    ga('send', 'event', 'edit', 'new-marker');
    var marker = newWaypoint(e.latlng);
    elevatePoint(e.latlng);
    marker.enableEdit();
  } else if (editMode == EDIT_AUTO_TRACK) {
    if (!route) {
      if (!routeStart) {
        setRouteStart(e.latlng);
      } else {
        var fromPt = routeStart,
          toPt = e.latlng,
          router = L.Routing.graphHopper(config.graphhopper.key(), { urlParameters: { vehicle: getCurrentActivity().vehicle } });
        router.on("response", checkGraphHopperCredit);
        route = L.Routing.control({
          router: router,
          waypoints: [fromPt, toPt],
          routeWhileDragging: false,
          autoRoute: true,
          fitSelectedRoutes: false,
          lineOptions: {
            styles: [{
              color: "red",
              weight: 3,
              opacity: 1
            }],
            addWaypoints: true
          },
          createMarker: newRouteWaypoint,
          show: false
        }).addTo(map);
      }
    } else {
      var wpts = route.getWaypoints();
      if (wpts.length == 2) { // up to 4 with free version
        mergeRouteToTrack();
        restartRoute();
        map.fireEvent("click", { latlng: e.latlng });
      } else {
        wpts.push({ latLng: e.latlng });
        route.setWaypoints(wpts);
      }
    }
  } else {
    closeOverlays();
  }
});

map.on('editable:vertex:click', function(e) {

  function deleteTrackPoint(event) {
    e.vertex.delete();
    map.closePopup(pop);
    event.preventDefault();
  }

  if (e.originalEvent.shiftKey) {
    // shortcut to delete a vertex
    e.vertex.delete();
    return;
  }
  track.editor.commitDrawing();
  if (track.getLatLngs().length === 0) {
    setEditMode(EDIT_MANUAL_TRACK);
    return;
  }
  e.cancel();
  var div = getTrackPointPopupContent(e.latlng);
  var pop = L.popup()
    .setLatLng(e.latlng)
    .setContent(getLatLngPopupContent(e.latlng, deleteTrackPoint, div))
    .openOn(map);
  $(".leaflet-popup-close-button").click(function(e) {
    track.editor.continueForward();
    return false;
  });
});

// ---- ELEVATION
var elevation;

function hideElevation() {
  if (elevation) toggleElevation();
}

function toggleElevation(e) {
  // is elevation currently displayed?
  if (!elevation) {
    // ignore if track has less than 2 points
    if (track && track.getLatLngs().length > 1) {
      setEditMode(EDIT_NONE);
      map.closePopup();
      var options = $(document).width() < 600 ? {
        width: 355,
        height: 125,
        margins: {
          top: 10,
          right: 10,
          bottom: 25,
          left: 40
        },
      } : {};
      var el = L.control.elevation(options);
      var gjl = L.geoJson(track.toGeoJSON(), {
        onEachFeature: el.addData.bind(el)
      });
      try {
        el.addTo(map);
        gjl.setStyle({ opacity: 0 });
        gjl.addTo(map);
        elevation = {
          el: el,
          gjl: gjl
        };
      } catch (err) {
        log('no elevation');
      }
    }
  } else {
    elevation.gjl.remove();
    elevation.el.remove();
    elevation = undefined;
  }
}

$(".appname").text(config.appname);
$("#prunedist").val(config.compressdefault);
setStatus("Welcome to " + config.appname + "!", { timeout: 3 });

function menu(item, event) {
  $("#menu table").hide();
  $(".tablinks").removeClass("active");
  $("#tab" + item).addClass("active");
  $("#menu #menu" + item).show();
  if (event) {
    event.preventDefault();
  }
}
$(".tablinks").click(function(event) {
  menu(event.target.id.replace("tab", ""), event);
});


function isStateSaved() {
  return isChecked("#cfgsave");
}
$("#cfgsave").change(function(e) {
  var saveCfg = isStateSaved();
  ga('send', 'event', 'config', saveCfg ? 'save-on' : 'save-off');
  storeVal("wt.saveState", saveCfg ? "true" : "false");
  if (saveCfg) {
    saveState();
  } else {
    clearSavedState();
  }
});

setChecked("#merge", false);
var url = getParameterByName("url");
if (url) {
  ga('send', 'event', 'file', 'load-param');
  var ext = getParameterByName("ext");
  showLocation = LOC_NONE;
  loadFromUrl(url, ext || undefined);
} else {
  restoreState();
}

$(window).on("unload", function() {
  saveState();
});
