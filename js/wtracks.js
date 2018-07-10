if (config.google && config.google.analyticsid) {
  initGoogleAnalytics(config.google.analyticsid());
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
/* folding settings */
function toggleElement(e) {
  $("." + this.id.slice(0, -1) + "-toggle").toggle();
}
$(".toggle").click(toggleElement);

/* help buttons */
function toggleHelp(e) {
  $("#" + this.id + "-help").toggle();
}
$(".help-b").click(toggleHelp);

function updateMapStyle() {
  if (!map.editTools) {
    // editor not yet intialized
    map.options.editOptions.lineGuideOptions.color = trackColor;
    map.options.editOptions.lineGuideOptions.weight = trackWeight;
  } else {
    // update editor
    map.editTools.forwardLineGuide.options.color = trackColor;
    map.editTools.forwardLineGuide.options.weight = trackWeight;
  }
}

var map = L.map('map', {
  editable: true,
  editOptions: {
    lineGuideOptions: {
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


var MARKER_ICON = L.icon({
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

// load Google Maps API
var gk = ggkey ? ggkey : config.google.mapsapikey();
gk = $.getScript("https://maps.googleapis.com/maps/api/js" + (gk ? "?key=" + gk : ""));
// load Dropbox API
$("#dropboxjs").attr("data-app-key", config.dropbox.key());
$("#dropboxjs").attr("src", "https://www.dropbox.com/static/api/2/dropins.js");

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
  setTrackName($("#prompt-name").val().trim());
  metadata.desc = $("#prompt-desc").val().trim();
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
  } else if ((event.keyCode == 13) && (event.target.tagName != "TEXTAREA")) {
    validatePrompt();
  }
}

$("#prompt-name").keyup(promptKeyEvent);
$("#prompt-desc").keyup(promptKeyEvent);

$("#prompt-ok").click(validatePrompt);
$("#prompt-cancel").click(closeTrackNamePrompt);
$("#track-name-edit").click(promptTrackName);

/* ----------------- My maps edition ------------------- */

var mymaps = getJsonVal("wt.mymaps", {});
var selectMymaps = $("#mymaps-list")[0];
var mymap;

function addBaseLayer(blname, bl) {
  var blprovider = getProvider(bl);
  if (blprovider) {
    baseLayerControl.addBaseLayer(blprovider, blname);
  }
}
function changeBaseLayer(oldname, newname, newlayer) {
  for (var i = 0, len = baseLayerControl._layers.length; i < len; i++) {
    var bl = baseLayerControl._layers[i];
    if (bl.name == oldname) {
      if (newname && newlayer) {
        bl.name = newname;
        bl.layer = getProvider(newlayer);
        baseLayerControl._update();
      } else {
        baseLayerControl.removeLayer(bl.layer);
      }
      break;
    }
  }
}

function addMymapsItem(name) {
  if (!selectMymaps.options[name]) {
    addSelectOption(selectMymaps, name);
  }
}
function changeMymapsItem(oldname, newname) {
  $("#mymaps-list option").each(function(i, v) {
    if (oldname == v.innerHTML) {
      if (newname) {
        var elt = $(v);
        elt.val(newname);
        elt.attr("name", newname);
        elt.text(newname);
      } else {
        v.remove();
      }
      return false;
    }
  });
}

function listMymaps() {
  if (mymaps) {
    for (var m in mymaps) {
      if (hasOwnProperty.call(mymaps, m)) {
        addMymapsItem(m);
      }
    }
  }
}

function openMymapBox() {
  $("#mymap-name").val(mymap.name);
  $("#mymap-url").val(mymap.url);
  $("#mymap-minz").val(mymap.options.minZoom);
  $("#mymap-maxz").val(mymap.options.maxZoom);
  $("#mymap-layers").val(mymap.options.layers);
  $("#mymap-layer").val(mymap.options.layer);
  $("#mymap-tilematrixSet").val(mymap.options.tilematrixSet);
  $("#mymap-crs").val(mymap.options.crs);
  $("#mymap-styles").val(mymap.options.styles);
  $("#mymap-style").val(mymap.options.style);
  $("#mymap-format").val(mymap.options.format);
  $("#mymap-attr").val(mymap.options.attribution);
  $("#mymap-box input:radio[name=mymap-type][value=" + mymap.type + "]").prop('checked', true);
  $("#mymap-box").show();
  $("#mymap-name").focus();
  changeMymapType();
}

function addMymap(evt) {
  mymap = { options: {} };
  openMymapBox();
}

function editMymap(evt) {
  var mymapname = getSelectedOption(selectMymaps);
  if (mymapname) {
    mymap = mymaps[mymapname];
    if (mymap) {
      mymap.name = mymapname;
      openMymapBox();
    }
  }
}

var mymapsInputs = $("#mymap-box input");
mymapsInputs.on("invalid", function(evt) {
  var invalidInput = $(evt.target);
  invalidInput.addClass("invalid");
  invalidInput.focus();
});
mymapsInputs.on("input", function(evt) {
  if (evt.target.checkValidity()) {
    $(evt.target).removeClass("invalid");
  }
});

mymapsInputs.keyup(function(event) {
  if (event.which == 27) {
    cancelMymapBox();
    event.stopPropagation();
  } else if (event.keyCode == 13) {
    validateMymapBox();
  }
});

function validateMymapBox(evt) {
  var valid = true;
  // check validity on displayed inputs
  $("#mymap-box input:visible").each(function(i, v) {
    var display = $(v).css('display');
    if ((display != "none") && (!v.checkValidity())) {
      valid = false;
      return false;
    }
  });
  if (valid) {
    //mymapsInputs.removeClass("invalid");
    $("#mymap-box").hide();
    var oldname = mymap.name;
    var newname = $("#mymap-name").val().trim();
    mymap[name] = undefined;
    mymap.url = $("#mymap-url").val().trim();
    mymap.type = $('input:radio[name=mymap-type]:checked').val();
    mymap.options.minZoom= $("#mymap-minz").val().trim();
    mymap.options.maxZoom = $("#mymap-maxz").val().trim();
    if (mymap.type === "wms") {
      mymap.options.layers = $("#mymap-layers").val().trim();
      mymap.options.crs = $("#mymap-crs").val().trim();
      mymap.options.styles = $("#mymap-styles").val().trim();
      mymap.options.format = $("#mymap-format").val().trim();
    } else if (mymap.type === "wmts") {
      mymap.options.layer = $("#mymap-layer").val().trim();
      mymap.options.tilematrixSet = $("#mymap-tilematrixSet").val().trim();
      mymap.options.style = $("#mymap-style").val().trim();
      mymap.options.format = $("#mymap-format").val().trim();
    }
    mymap.options.attribution = $("#mymap-attr").val().trim();
    if (oldname && mymaps[oldname]) {
      if (oldname != newname) {
        // rebuild object to preserve order
        var tmp = {};
        for (var m in mymaps) {
          if (hasOwnProperty.call(mymaps, m)) {
            if (m == oldname) {
              tmp[newname] = mymap;
            } else {
              tmp[m] = mymaps[m];
            }
          }
        }
        mymaps = tmp;
        changeMymapsItem(oldname, newname);
      } else {
        mymaps[newname] = mymap;
      }
      changeBaseLayer(oldname, newname, mymap);
      ga('send', 'event', 'map', 'edit');
    } else {
      addMymapsItem(newname);
      addBaseLayer(newname, mymap);
      mymaps[newname] = mymap;
      ga('send', 'event', 'map', 'add');
    }
    saveJsonValOpt("wt.mymaps", mymaps);
  }
}

function cancelMymapBox(evt) {
  $("#mymap-box").hide();
  mymapsInputs.removeClass("invalid");
  mymap = undefined;
}

function deleteMymap(evt) {
  var mymapname = getSelectedOption(selectMymaps);
  if (mymapname) {
    mymap = mymaps[mymapname];
    if (mymap && confirm("Delete " + mymapname + "?")) {
      mymaps[mymapname] = undefined;
      saveJsonValOpt("wt.mymaps", mymaps);
      // delete map in lists
      changeMymapsItem(mymapname);
      changeBaseLayer(mymapname);
      ga('send', 'event', 'map', 'delete');
    }
  }
}

function changeMymapType(evt) {
  var type =  $('input:radio[name=mymap-type]:checked').val();
  $(".map-wmts").hide();
  $(".map-wms").hide();
  if (type != "base") {
    $(".map-" + type).show();
  }
}

function resetMymap(evt) {
  if (!$.isEmptyObject(mymaps) &&
      confirm("Delete all your personal maps?")) {
    $("#mymaps-list option").each(function(i, v) {
      changeBaseLayer($(v).text());
      v.remove();
    });
    mymaps = {};
    ga('send', 'event', 'map', 'reset');
    saveJsonValOpt("wt.mymaps", undefined);
  }
}

$("#mymap-ok").click(validateMymapBox);
$("#mymap-cancel").click(cancelMymapBox);

$("#mymap-add").click(addMymap);
$("#mymap-edit").click(editMymap);
$("#mymap-delete").click(deleteMymap);
$("#mymap-reset").click(resetMymap);
$("input:radio[name=mymap-type]").change(changeMymapType);

listMymaps();

// ---------------- Import / export my maps

function openExportMymaps() {
  if (!$.isEmptyObject(mymaps)) {
    var json = JSON.stringify(mymaps);
    var data = b64EncodeUnicode(json);
    $("#input-text").text("Copy and share map data below (Ctrl+C & Enter):");
    $("#input-ok").hide();
    $("#input-val").val(data);
    $("#input-box").show();
    $("#input-val").focus();
    $("#input-val").select();
    ga('send', 'event', 'map', 'export', undefined, mymaps.length);
  }
}

function openImportMymaps() {
  $("#input-text").text("Paste exported map data (Ctrl+V & Enter):");
  $("#input-val").val("");
  $("#input-ok").show();
  $("#input-box").show();
  $("#input-val").focus();
}


function importMymaps() {
  var imported = 0;
  try {
    var data = $("#input-val").val().trim();
    var importedMymaps = data ? JSON.parse(b64DecodeUnicode(data)) : {};
    for (var name in importedMymaps) {
      if (hasOwnProperty.call(importedMymaps, name)) {
        var overwrite = mymaps[name];
        var msg = overwrite ? "Overwrite " : "Import ";
        if (confirm(msg + name + "?")) {
          if (overwrite) {
            changeMymapsItem(name, name);
            changeBaseLayer(name, name, importedMymaps[name]);
          } else {
            addMymapsItem(name);
            addBaseLayer(name, importedMymaps[name]);
          }
          mymaps[name] = importedMymaps[name];
          imported++;
        }
      }
    }
  } catch (ex) {
    error("Invalid import data");
  }
  if (imported > 0) {
    saveJsonValOpt("wt.mymaps", mymaps);
    ga('send', 'event', 'map', 'import', undefined, imported);
  }
  $("#input-box").hide();
}

$("#input-box-close").click(function() {
  $("#input-box").hide();
  return false;
});

$("#input-val").keyup(function(event) {
  if (event.which == 27) {
    $("#input-box").hide();
  } else if (event.keyCode == 13) {
    var isImport = $("#input-ok").is(":visible");
    $("#input-box").hide();
    if (isImport) {
      importMymaps();
    }
  }
});

$("#input-ok").click(importMymaps);

$("#mymap-import").click(openImportMymaps);
$("#mymap-export").click(openExportMymaps);

if (!supportsBase64() || !JSON || !JSON.parse || !JSON.stringify) {
  $("#mymap-import").attr("disabled", "disabled");
  $("#mymap-export").attr("disabled", "disabled");
}

/* ----------------------------------------------------- */

var selectActivity = $("#activity")[0];
var activities = getJsonVal("wt.activities");

function loadActivities() {
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
  // remove deleted activities
  $("#activity option").each(function(i, v) {
    if (!activities[v.innerHTML]) {
      v.remove();
    }
  });
}
loadActivities();
selectOption(selectActivity, getVal("wt.activity", undefined));

function getCurrentActivityName() {
  return getSelectedOption("#activity");
}

function getCurrentActivity() {
  var res = getCurrentActivityName();
  //log("activity: " + res);
  saveValOpt("wt.activity", res);
  return activities[res];
}
$("#activity").click(loadActivities);
$("#activity").change(function() {
  ga('send', 'event', 'activity', 'change', getCurrentActivityName());
  polystats.setSpeedProfile(getCurrentActivity().speedprofile);
});

/* ------------------------------------------------------------*/

function updateTrackStyle() {
  track.setStyle({
    color: trackUI.trk.getColor(),
    weight: trackUI.trk.getWeight()
  });
}

function updateOverlayTrackStyle(segment) {
  segment.setStyle({
    color: trackUI.ovl.getColor(),
    weight: trackUI.ovl.getWeight()
  });
}

function updateAllOverlayTrackStyle() {
  var layers = editLayer.getLayers();
  for (var l = 0, len = layers.length; l < len; l++) {
    var segment = layers[l];
    // check if it is a polyline
    if (segment.getLatLngs && (segment != track)) {
      updateOverlayTrackStyle(segment);
    }
  }
}

function newSegment(noStats) {
  if (track) {
    if (track.getLatLngs().length == 0) {
      // current track is empty, don't create another one
      return track;
    }
    updateOverlayTrackStyle(track);
  }
  track = L.polyline([]);
  editLayer.addLayer(track);
  track.on('click', segmentClickListener);
  if (!noStats) {
    polystats = L.polyStats(track, {
      chrono: true,
      speedProfile: getCurrentActivity().speedprofile,
      onUpdate: showStats,
    });
    showStats();
  }
  updateTrackStyle();
  return track;
}

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
  newSegment();
  setTrackName(NEW_TRACK_NAME);
  // reset URL if it contains query parameters
  if (window.location.search && window.history && window.history.pushState) {
    window.history.pushState({}, document.title, window.location.pathname);
  }
}

function newWaypoint(latlng, properties, wptLayer) {

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
      name.placeholder = "Textual name";
      $(name).val(marker.options.title ? marker.options.title : "");
      name.onkeyup = function() {
        var nameval = $(name).val().trim();
        marker.options.title = nameval;
        var elt = marker.getElement();
        elt.title = nameval;
        elt.alt = nameval;
      };

      // description
      label = L.DomUtil.create('div', "popupdiv", div);
      label.innerHTML = "<span class='popupfield'>Desc:</span>";
      var richtxtlbl = L.DomUtil.create('label', "rich-text", label);
      var richtxtcb = L.DomUtil.create('input', "rich-text", richtxtlbl);
      richtxtcb.type = 'checkbox';
      $(richtxtlbl).append("Rich text");
      var desc = L.DomUtil.create('textarea', "popup-descinput", label);
      desc.placeholder = "Textual/HTML description";
      $(desc).val(marker.options.desc ? marker.options.desc : "");
      desc.onkeyup = function() {
        var descval = $(desc).val();
        marker.options.desc = descval;
      };

      var setRichDesc = function() {
        var h = Math.max(120, $(desc).height());
        $(desc).attr('origheight', h);
        $(desc).trumbowyg({
            btns: [
              'formatting',
              ['strong', 'em', 'underline', 'removeformat'],
              ['link', 'insertImage'],
              'btnGrp-lists',
              ['horizontalRule']
            ],
            autogrow: false
        })
        .on('tbwchange', desc.onkeyup)
        .on('tbwinit', function() {
          $("div.trumbowyg-editor, .trumbowyg-box").css('min-height', h);
        });
      };

      $(richtxtcb).change(function(){
        if (isChecked(richtxtcb)) {
          setRichDesc();
        } else {
          $(".popup-descinput").trumbowyg('destroy');
          $(".popup-descinput").height($(".popup-descinput").attr('origheight'));
        }
      });
      if (marker.options.desc && marker.options.desc.indexOf("<") >= 0) {
        setChecked(richtxtcb, 'checked');
        setRichDesc();
      }

    } else {

      // name
      if (marker.options.title) {
        var popupName = L.DomUtil.create('div', "popup-name", div);
        popupName.innerHTML = marker.options.title;
      }

      // description
      if (marker.options.desc) {
        var popupDesc = L.DomUtil.create('pre', "popup-desc", div);
        popupDesc.innerHTML = marker.options.desc;
      }

    }

    // cmt
    if (marker.options.cmt) {
      var popupCmt = L.DomUtil.create('pre', "popup-desc", div);
      popupCmt.innerHTML = marker.options.cmt;
    }

    // time
    if (marker.options.time) {
      var popupTime = L.DomUtil.create('pre', "popup-desc", div);
      popupTime.innerHTML = marker.options.time;
    }


    var latlng = marker.getLatLng();
    var markerDiv = getLatLngPopupContent(latlng, deleteMarker, undefined, div);
    return markerDiv;
  }

  var wptOpts = {
    title: properties.name || "",
    alt: properties.name || "",
    desc: properties.desc || properties.description || "",
    cmt: properties.cmt || undefined,
    time: properties.time || undefined,
    icon: MARKER_ICON
  };
  var marker = L.marker(latlng, wptOpts);
  wptLayer.addLayer(marker);

  if (wptLayer == waypoints) {
    marker.on("click", function() {
      pop = L.popup()
        .setLatLng(marker.getLatLng())
        .setContent(getMarkerPopupContent(marker))
        .openOn(map);
    });
  }

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
  polytrim = L.polyTrim(track, trimType);
}

function trimTrack(e) {
  var n = parseInt($("#trim-range").val());
  log("trimming " + n);
  $("#trim-txt").text(n + "/" + polytrim.getPolySize());
  $(".no-trim").prop('disabled', (n !== 0));
  polytrim.trim(n);
}

function finishTrim() {
  var n = parseInt($("#trim-range").val());
  if (n > 0) {
    ga('send', 'event', 'tool', 'trim', undefined, n);
    if (polytrim.getDirection() === polytrim.FROM_END) {
      // From End
      polystats.updateStatsFrom(track.getLatLngs().length - 1);
    } else {
      // From Start
      polystats.updateStatsFrom(0);
    }
    saveState();
    polytrim = undefined;
    $("#trim-range").val(0);
  }
}

$("#trim-range").on("change", trimTrack);
$("#trim-type").change(prepareTrim);

/* --------------------------------------*/
// Track display settings

var trackColor;
var trackWeight;
var ovlTrackColor;
var ovlTrackWeight;
var trackUI = {
  trk: {
    getDefaultColor : function() {
      return config.display.trackColor;
    },
    getColor : function() {
      return trackColor;
    },
    setColor : function(v) {
      trackColor = v;
      saveValOpt("wt.trackColor", v);
      updateTrackStyle();
      updateMapStyle();
    },
    getDefaultWeight : function() {
      return config.display.trackWeight;
    },
    getWeight : function() {
      return trackWeight;
    },
    setWeight : function(v) {
      trackWeight = v;
      saveValOpt("wt.trackWeight", v);
      updateTrackStyle();
      updateMapStyle();
    }
  },
  ovl: {
    getDefaultColor : function() {
      return config.display.ovlTrackColor;
    },
    getColor : function() {
      return ovlTrackColor;
    },
    setColor : function(v) {
      ovlTrackColor = v;
      saveValOpt("wt.ovlTrackColor", v);
      updateAllOverlayTrackStyle();
    },
    getDefaultWeight : function() {
      return config.display.ovlTrackWeight;
    },
    getWeight : function() {
      return ovlTrackWeight;
    },
    setWeight : function(v) {
      ovlTrackWeight = v;
      saveValOpt("wt.ovlTrackWeight", v);
      updateAllOverlayTrackStyle();
    }
  }
};
var trackUISetting = trackUI.trk;
trackColor = getVal("wt.trackColor", trackUI.trk.getDefaultColor());
trackWeight = getVal("wt.trackWeight", trackUI.trk.getDefaultWeight());
ovlTrackColor = getVal("wt.ovlTrackColor", trackUI.ovl.getDefaultColor());
ovlTrackWeight = getVal("wt.ovlTrackWeight", trackUI.ovl.getDefaultWeight());
updateMapStyle();

$("input:radio[name=track-type]").on("change", function(event){
  var t = $("input:radio[name=track-type]:checked").val();
  trackUISetting = trackUI[t];
  initTrackDisplaySettings();
});
$("#track-color").on("change", function(event){
  var v = $("#track-color").val();
  ga('send', 'event', 'setting', 'trackColor', v);
  trackUISetting.setColor(v);
});
$("#track-weight").on("change", function(event){
  var v = $("#track-weight").val();
  ga('send', 'event', 'setting', 'trackWeight', v);
  $("#track-weight-v").text(v);
  trackUISetting.setWeight(v);
});
$("#track-resetcolorweight").on("click", function(){
  trackUISetting.setColor(trackUISetting.getDefaultColor());
  trackUISetting.setWeight(trackUISetting.getDefaultWeight());
  ga('send', 'event', 'setting', 'trackReset');
  initTrackDisplaySettings();
});
function initTrackDisplaySettings() {
  var v;
  v = trackUISetting.getColor();
  $("#track-color").val(v);
  $("#track-color-picker")[0].jscolor.fromString(v);
  v = trackUISetting.getWeight();
  $("#track-weight").val(v);
  $("#track-weight-v").text(v);
}

/* --------------------------------------*/
// API keys

var ghkey = getVal("wt.ghkey", undefined);
var ggkey = getVal("wt.ggkey", undefined);

function showApiKey(name, value) {
  var useDefault = isUndefined(value);
  var input = $("#" + name + "-value");
  debug(name + ": " + value);
  setChecked("#" + name + "-chk", !useDefault);
  input.val(useDefault ? "Using WTracks key" : value);
  input.attr("disabled", useDefault);
}

function updateApiKey(name) {
  var useDefault = !isChecked("#" + name + "-chk");
  var key = useDefault ? undefined : $("#" + name + "-value").val().trim();
  // empty is considered undefined
  key = (key === "") ? undefined : key;
  var gav = useDefault ? -1 : key ? 1 : 0;
  ga('send', 'event', 'setting', 'keys', name, gav);
  debug(name + "= " + key + " (" + gav + ")");
  saveValOpt("wt." + name, key);
  return key;
}

function checkApikey(name) {
  var useDefault = !isChecked("#" + name + "-chk");
  $("#" + name + "-value").val(useDefault ? "Using WTracks key": "");
  $("#" + name + "-value").attr("disabled", useDefault);
  var key = updateApiKey(name);
  return key;
}

$("#ghkey-chk").on("change", function() {
  ghkey = checkApikey("ghkey");
});
$("#ggkey-chk").on("change", function() {
  ggkey = checkApikey("ggkey");
});
$("#ghkey-value").on("focusout", function() {
  ghkey = updateApiKey("ghkey");
});
$("#ggkey-value").on("focusout", function() {
  ggkey = updateApiKey("ggkey");
});

function resetApiKey(name) {
  setChecked("#" + name + "-chk", false);
  $("#" + name + "-chk").change();
}

$("#keys-reset").on("click", function() {
  ga('send', 'event', 'setting', 'keys', 'reset');
  resetApiKey("ghkey");
  resetApiKey("ggkey");
});

showApiKey("ghkey", ghkey);
showApiKey("ggkey", ggkey);

/* ------------------------ MENU ---------------------------------- */

function closeMenu() {
  $("#menu").hide();
  finishTrim();
}

function initMenu() {
  setEditMode(EDIT_NONE);
  setChecked("#merge", false);
  menu("file");
  prepareTrim();
}

$("#menu-button").click(function() {
  if (!$("#menu").is(":visible")) {
    initMenu();
  } else {
    closeMenu();
  }
  return false;
});
$("#menu-close").click(function() {
  closeMenu();
  return false;
});
$("#track-new").click(function() {
  ga('send', 'event', 'file', 'new');
  newTrack();
  setEditMode(EDIT_MANUAL_TRACK);
  saveState();
  closeMenu();
});
$("#menu-track").click(function() {
  $(".collapsable-track").toggle();
});
$("#menu-tools").click(function() {
  $(".collapsable-tools").toggle();
});

/* ------------------------ EXPORT GPX ---------------------------------- */

function LatLngToGPX(latlng, gpxelt, properties) {

  var gpx = "<" + gpxelt;
  gpx += " lat=\"" + latlng.lat + "\" lon=\"" + latlng.lng + "\">";
  if (properties.title) {
    gpx += "<name>" + htmlEncode(properties.title) + "</name>";
  }
  if (properties.desc) {
    gpx += "<desc>" + htmlEncode(properties.desc) + "</desc>";
  }
  if (!isNaN(latlng.alt)) {
    gpx += "<ele>" + latlng.alt + "</ele>";
  }
  if (properties.cmt) {
    gpx += "<cmt>" + htmlEncode(properties.cmt) + "</cmt>";
  }
  if (properties.time) {
    gpx += "<time>" + (properties.time.toISOString ? properties.time.toISOString() : properties.time) + "</time>";
  }
  gpx += "</" + gpxelt + ">\n";
  return gpx;
}

function getSegmentGPX(segment, ptindent, pttag, savetime) {
  var now = new Date();
  var gpx = "";
  var latlngs = segment ? segment.getLatLngs() : undefined;
  if (latlngs && latlngs.length > 0) {
    var j = 0;
    now = now.getTime();
    while (j < latlngs.length) {
      var pt = latlngs[j];
      var time;
      if (savetime) {
        time = new Date(now + (pt.chrono * 1000));
      } else {
        time = pt.time;
      }
      gpx += ptindent + LatLngToGPX(pt, pttag, { 'time': time });
      j++;
    }
  }
  return gpx;
}

function getGPX(trackname, savealt, savetime, asroute, nometadata) {

  var now = new Date();
  var xmlname = "<name>" + htmlEncode(trackname) + "</name>";
  var gpx = '<\?xml version="1.0" encoding="UTF-8" standalone="no" \?>\n';
  gpx += '<gpx creator="' + config.appname + '" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n';
  if (!nometadata) {
    gpx += "<metadata>\n";
    gpx += "  " + xmlname + "\n";
    gpx += "  <desc>" + (metadata.desc ? htmlEncode(metadata.desc) : "") + "</desc>\n";
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

  // Waypoints
  var wpts = waypoints ? waypoints.getLayers() : undefined;
  if (wpts && wpts.length > 0) {
    var i = 0;
    while (i < wpts.length) {
      var wpt = wpts[i];
      gpx += LatLngToGPX(wpt.getLatLng(), "wpt", wpt.options);
      i++;
    }
  }

  var ptindent, pttag, wraptag, segtag;
  if (asroute) {
    ptindent = "  ";
    wraptag = "rte";
    pttag = "rtept";
  } else {
    ptindent = "    ";
    wraptag = "trk";
    pttag = "trkpt";
    segtag = "trkseg";
  }

  gpx += "<" + wraptag + ">" + xmlname + "\n";
  // for each segment
  var layers = editLayer.getLayers();
  for (var l = 0, len = layers.length; l < len; l++) {
    var segment = layers[l];
    // check if it is a polyline
    if (segment.getLatLngs) {
      if (segtag) {
        gpx += "  <" + segtag + ">\n";
      }
      gpx += getSegmentGPX(segment, ptindent, pttag, savetime);
      if (segtag) {
        gpx += "  </" + segtag + ">\n";
      }
    }
  }

  gpx += "</" + wraptag + "></gpx>\n";
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
  var savetime = isChecked("#savetiming");
  var trackname = doConfirmName ? getConfirmedTrackName() : getTrackName();
  return getGPX(trackname, /*savealt*/ false, savetime, asroute, nometadata);
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
  closeMenu();
});

//---------------------------------------------------
// Share

$("#track-share").click(function() {
  closeMenu();
  $("#share-ask").show();
  $("#share-processing").hide();
  $("#share-done").hide();
  $("#share-val").val("");
  $("#share-box").show();
  $("#share-start").focus();
});
function closeShareBox(){
  $("#share-box").hide();
}
$("#share-box-close").click(closeShareBox);
$("#share-cancel").click(closeShareBox);
$("#share-ok").click(closeShareBox);

function uploadClicked(){
  $("#share-ask").hide();
  $("#share-processing").show();
  uploadAndShare(
    function (fileurl) {
      var url = window.location.toString();
      url = url.replace(/#*$/,"");
      url = url.replace(/index\.html$/,"");
      url = url.replace(/\/*$/,"");
      url += "/";
      $("#share-val").val(url + "?ext=gpx&noproxy=true&url=" + encodeURI(fileurl));
      $("#share-processing").hide();
      $("#share-done").show();
      $("#share-val").focus();
      $("#share-val").select();
    }, function(error) {
      var errmsg = error.statusText ? error.statusText : error;
      setStatus("Failed: " + errmsg, { timeout: 5, class: "status-error" });
      $("#share-box").hide();
    });
}

$("#share-start").click(uploadClicked);

function closeShareBoxOnEscape(event) {
  if (event.which == 27) {
    closeShareBox();
    event.stopPropagation();
  }
}
$("#share-start").keyup(closeShareBoxOnEscape);
$("#share-cancel").keyup(closeShareBoxOnEscape);
$("#share-val").keyup(closeShareBoxOnEscape);
$("#share-ok").keyup(closeShareBoxOnEscape);

/*
function dpasteUploadAndShare(onDone, onFail) {
  $.post( "http://dpaste.com/api/v2/",
     { "content": getTrackGPX(),
        "title": getTrackName(),
        "poster": "WTracks",
        "syntax": "xml",
        "expiry_days": 60
  }).done(function(data) {
    onDone(data + ".txt")}
  ).fail(onFail);
}

function htputUploadAndShare(onDone, onFail) {
  var id = Math.random().toString(36).substring(2);
  var sharedurl = "https://htput.com/" + id;
  $.ajax({
    url: sharedurl,
    type: 'PUT',
    dataType: "json",
    data: getTrackGPX(),
  }).done(function(resp) {
    if (resp.status === "ok") {
      onDone(sharedurl + ".txt");
    } else {
      onFail(resp.error_msg);
    }
  }).fail(onFail);
}
*/

function friendpasteUploadAndShare(onDone, onFail) {
  $.ajax({
    method: "POST",
    url: "https://www.friendpaste.com/",
    dataType: "json",
    contentType:"application/json; charset=utf-8",
    data: JSON.stringify({
      "title": getTrackName(),
      "snippet": getTrackGPX(),
      "language": "xml"
    })
  }).done(function(resp) {
    if (resp.ok) {
      onDone(resp.url + "/raw&rev=" + resp.rev);
    } else {
      onFail(resp.reason);
    }
  }).fail(onFail);
}

var uploadAndShare =
        friendpasteUploadAndShare
        //htputUploadAndShare;
        //dpasteUploadAndShare;

//---------------------------------------------------

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
  pts = L.PolyPrune.prune(pts, { tolerance: config.compressdefault, useAlt: true });
  ga('send', 'event', 'edit', 'merge', undefined, pts.length);
  route.remove();
  route = undefined;
  routeStart = undefined;
  for (var j = 0; j < pts.length; j++) {
    track.addLatLng(pts[j]);
  }
  elevate(pts, function() {
    polystats.updateStatsFrom(initlen);
    saveState();
  });
}

function setRouteStart(latlng) {
  routeStart = latlng;
  $("#map").css("cursor", "alias");
}

function closeOverlays() {
  // close all
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
      $("#map").css("cursor", "url(img/marker-icon.cur),text");
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
  var toleranceV;
  if (input) {
    toleranceV = parseFloat(input);
  }
  if ((toleranceV === undefined) || isNaN(toleranceV)) {
    alert("Enter distance in meters");
    prunedist.focus();
    return;
  }

  var useAltV = isChecked("#prunealt");

  if (track) {
    setEditMode(EDIT_NONE);
    var pts = track.getLatLngs();
    var pruned = L.PolyPrune.prune(pts, { tolerance: toleranceV, useAlt: useAltV });
    var removedpts = (pts.length - pruned.length);
    ga('send', 'event', 'tool', 'compress', undefined, removedpts);
    if (removedpts > 0) {
      alert("Removed " + removedpts + " points out of " + pts.length + " (" + Math.round((removedpts / pts.length) * 100) + "%)");
      // switch to new values
      track.setLatLngs(pruned);
      polystats.updateStatsFrom(0);
      saveState();
    } else {
      setStatus("Already optimized", { timeout: 3 });
    }
  }
});

function joinSegments() {
  var
    seg1,
    count = 0,
    layers = editLayer.getLayers();
  for (var i = 0, len = layers.length; i < len; i++) {
    var segment = layers[i];
    // check if it is a polyline
    if (segment.getLatLngs) {
      count++;
      if (!seg1) {
        seg1 = segment;
      } else {
        seg1.setLatLngs(seg1.getLatLngs().concat(segment.getLatLngs()));
        segment.remove();
        segment.removeFrom(editLayer);
      }
    }
  }
  if (count > 1) {
    track = null;
    segmentClickListener({target: seg1}, true);
    saveState();
    setStatus("Joined " + count + " segments", { timeout: 3 });
    ga('send', 'event', 'tool', 'join', undefined, count);
  } else {
    setStatus("No segments to join", { timeout: 3 });
  }
}

$("#join").click(joinSegments);

var joinOnLoad = false; // deactivate while we restore saved GPX

// geolocation

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

function saveSettings() {
  saveValOpt("wt.activity", getCurrentActivityName());
  saveJsonValOpt("wt.activities", activities);
  saveValOpt("wt.baseLayer", baseLayer);
  saveValOpt("wt.ggkey", ggkey);
  saveValOpt("wt.ghkey", ghkey);
  saveValOpt("wt.joinOnLoad", joinOnLoad);
  saveJsonValOpt("wt.mymaps", mymaps);
  saveJsonValOpt("wt.overlaysOn", overlaysOn);
  saveValOpt("wt.ovlTrackColor", ovlTrackColor);
  saveValOpt("wt.ovlTrackWeight", ovlTrackWeight);
  saveValOpt("wt.scaleOpts", scaleOptions);
  saveValOpt("wt.trackColor", trackColor);
  saveValOpt("wt.trackWeight", trackWeight);
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
  menu("settings");
  var saveSetting = $("#menusettings tr:first-of-type");
  saveSetting.addClass("highlight");
  setTimeout(function(){
    saveSetting.removeClass("highlight");
  }, 10000);
});

function restoreState(showInfo) {
  var isSaving = getVal("wt.saveState", null);
  if (isUnset(isSaving) && showInfo) {
    $("#save-info").show();
  } else {
    setChecked("#cfgsave", isSaving === "true");
  }
  if (!restoreTrack()) {
    restorePosition();
  }
  restoreEditMode();
}

function clearSavedState() {
  storeVal("wt.activity", undefined);
  storeVal("wt.activities", undefined);
  storeVal("wt.baseLayer", undefined);
  storeVal("wt.editMode", undefined);
  storeVal("wt.ggkey", undefined);
  storeVal("wt.ghkey", undefined);
  storeVal("wt.gpx", undefined);
  storeVal("wt.joinOnLoad", undefined);
  storeVal("wt.mymaps", undefined);
  storeVal("wt.overlaysOn", undefined);
  storeVal("wt.ovlTrackColor", undefined);
  storeVal("wt.ovlTrackWeight", undefined);
  storeVal("wt.poslat", undefined);
  storeVal("wt.poslng", undefined);
  storeVal("wt.scaleOpts", undefined);
  storeVal("wt.trackColor", undefined);
  storeVal("wt.trackWeight", undefined);
}

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

function initCrsSelector() {
  var crsSelect = $("#mymap-crs")[0];
  for (var i = CrsValues.length - 1; i >=0; i--) {
    var crs = CrsValues[i];
    addSelectOption(crsSelect, crs ? crs.code : "");
  }
}
initCrsSelector();

function getProvider(mapobj) {
  var url = typeof mapobj.url === "string" ? mapobj.url : mapobj.url();
  var p = null;
  var protocol = url.split('/')[0];
  // skip HTTP URLs when current is HTTPS
  if (protocol.length == 0 || protocol == location.protocol) {
    var tileCtor;
    var mapopts = mapobj.options;
    if (isUnset(mapobj.type) || (mapobj.type === "base")) {
      tileCtor = L.tileLayer;
    } else {
      tileCtor = L.tileLayer[mapobj.type];
      if (mapobj.type === "wms" && mapopts.crs) {
        mapopts = Object.assign({}, mapopts);
        mapopts.crs = getCrsFromName(mapopts.crs);
      }
    }
    p = tileCtor(url, mapopts);
  }
  return p;
}

// Add background maps to base layers
var baseLayers = {};
for (var bl in config.maps) {
  if (hasOwnProperty.call(config.maps, bl)) {
    var tile = getProvider(config.maps[bl]);
    if (tile) {
      baseLayers[bl] = tile;
    }
  }
}
for (var m in mymaps) {
  if (hasOwnProperty.call(mymaps, m)) {
    baseLayers[m] = getProvider(mymaps[m]);
  }
}

// Add background maps to base layers
var overlays = {};
for (var ovly in config.overlays) {
  if (hasOwnProperty.call(config.overlays, ovly)) {
    var tile = getProvider(config.overlays[ovly]);
    if (tile) {
      overlays[ovly] = tile;
    }
  }
}
var baseLayerControl = L.control.layers(baseLayers, overlays);
baseLayerControl.addTo(map);

// ------------ SCALE

var scaleCtrl;
var scaleOptions = getVal("wt.scaleOpts", 0);

function updateScaleControl(event) {
  if (event && (editMode != EDIT_NONE)) {
    return;
  }
  if (scaleCtrl) {
    scaleCtrl.remove();
  }
  if (event) {
    // toggle between 0, 1 ad 2
    scaleOptions = (scaleOptions + 1) % 3;
    saveValOpt("wt.scaleOpts", scaleOptions);
  }
  scaleCtrl = L.control.scale({
    updateWhenIdle: true,
    metric: scaleOptions < 2,
    imperial: (scaleOptions % 2) == 0});
  scaleCtrl.addTo(map);
  $(".leaflet-control-scale").click(updateScaleControl);
}
updateScaleControl();

// ----------------------

var baseLayer = getVal("wt.baseLayer", config.display.map);
map.addLayer(baseLayers[baseLayer] || baseLayers[config.display.map]);
var layerInit = true;

map.on("baselayerchange", function(e) {
  baseLayer = e.name;
  if (layerInit) {
    // deffer to make sure GA is initialized
    setTimeout(function(){
      ga('send', 'event', 'map', 'init', baseLayer);
    }, 2000);
    layerInit = false;
  } else {
    ga('send', 'event', 'map', 'change', baseLayer);
  }
  saveValOpt("wt.baseLayer", baseLayer);
  $(".leaflet-control-layers").removeClass("leaflet-control-layers-expanded");
});

var overlaysOn = getJsonVal("wt.overlaysOn", {});

function setOverlay(name, yesno) {
  overlaysOn[name] = yesno;
  saveJsonValOpt("wt.overlaysOn", overlaysOn);
}

if (JSON.parse && JSON.stringify) {

  for (var name in overlaysOn) {
    if (overlaysOn.hasOwnProperty(name) && overlaysOn[name]) {
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

// ---------------------------------------------------------------------------
// Elevation service

// Google elevation API
function googleElevationService(locations, points, inc, done, fail) {
  var elevator;
  try {
    elevator = new google.maps.ElevationService();
  } catch (e) {
    // Google elevation service not available, cancel
    return;
  }
  elevator.getElevationForLocations({
    'locations': locations
  }, function(results, status) {
    if (status === 'OK') {
      if (isUndefined(points.length)) {
        // single point elevation
        points.alt = results[0].elevation;
      } else {
        for (var i = 0; i < results.length; i++) {
          var pos = i * inc;
          if (pos >= points.length) {
            // we reached last point from track
            pos = points.length - 1;
          }
          points[pos].alt = results[i].elevation;
        }
      }
      done("g.elevate");
    } else {
      fail('g.elevate.ko');
    }
  });
}

// https://github.com/Jorl17/open-elevation
function openElevationService(locations, points, inc, done, fail) {
  var ajaxreq, i, len;
  // GET is faster for small number of points (avoid OPTIONS preflight request)
  if (locations.length < 20) {
    // GET method
    var strpts = "";
    for (i = 0, len=locations.length; i < len; i++) {
      if (i>0) strpts += "|";
      strpts += locations[i].lat + "," + locations[i].lng;
    }
    ajaxreq = "https://api.open-elevation.com/api/v1/lookup?locations=" + strpts;
  } else {
    // POST method
    var jsonreq = { locations: [] };
    for (i = 0, len=locations.length; i < len; i++) {
      jsonreq.locations.push(
        {
          "latitude": locations[i].lat,
          "longitude": locations[i].lng
        }
      );
    }
    ajaxreq = {
      url: "https://api.open-elevation.com/api/v1/lookup",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(jsonreq)
    };
  }
  $.ajax(ajaxreq)
  .done(function(json) {
    if (isUndefined(points.length)) {
      // single point elevation
      points.alt = json.results[0].elevation;
    } else {
      for (var i = 0; i < json.results.length; i++) {
        var pos = i * inc;
        if (pos >= points.length) {
          // we reached last point from track
          pos = points.length - 1;
        }
        points[pos].alt = json.results[i].elevation;
      }
    }
    done("o.elevate");
  })
  .fail(function(err) {
    fail('o.elevate.ko');
  });
}

// multi-point elevation API
function elevatePoints(points, cb) {
  if (!points || (points.length === 0)) {
    return;
  }
  var locations;
  var inc;
  if (isUndefined(points.length)) {
    locations = [points];
  } else {
    setStatus("Elevating..", { spinner: true });
    inc = Math.ceil(Math.max(1, points.length / 511)); // keep one for last point
    if (inc == 1) {
      locations = points;
    } else {
      locations = [];
      for (var i = 0; i < points.length; i += inc) {
        locations.push(points[i]);
      }
      // make sure last point is included
      if ((i < points.length) || (i-inc < (points.length - 1))) {
        locations.push(points[points.length - 1]);
      }
    }
  }
  var callerName = arguments.callee && arguments.callee.caller ? arguments.callee.caller.name : elevatePoints.caller.name;
  callElevationService(callerName, locations, points, inc, cb);
}

function callElevationService(callerName, locations, points, inc, cb) {
  elevationService(locations, points, inc,
    function(eventName){
      ga('send', 'event', 'api', eventName, callerName, locations.length);
      clearStatus();
      // callback
      if (cb) cb();
    },
    function(eventName){
      ga('send', 'event', 'api', eventName, callerName, locations.length);
      if (eventName === "g.elevate.ko") {
        // fallback: next time use open-elevation service
        elevationService = openElevationService;
        // and redo current elevation request immediality
        callElevationService(callerName, locations, points, inc, cb);
      } else {
        setStatus("Elevation failed", { timeout: 3, class: "status-error" });
        warn("elevation request failed");
      }
    });
}

// Select elevation service
var elevate = elevatePoints;
var elevatePoint = elevatePoints;
var elevationService =
      googleElevationService;
      //openElevationService;

// ---------------------------------------------------------------------------

function cleanup(toclean) {
  setStatus("Cleaning up..", { spinner: true });
  var points = track ? track.getLatLngs() : undefined;
  if (points && (points.length > 0)) {
    for (var i = 0; i < points.length; i++) {
      for (var j = 0; j < toclean.length; j++) {
        points[i][toclean[j]] = undefined;
      }
    }
  }
  clearStatus();
}

function revert() {
  setStatus("Reverting..", { spinner: true });
  var points = track ? track.getLatLngs() : undefined;
  if (points && (points.length > 0)) {
    var newpoints = [];
    for (var i = points.length - 1; i >= 0; i--) {
      newpoints.push(points[i]);
    }
    track.setLatLngs(newpoints);
  }
  clearStatus();
}

new L.Control.GeoSearch({
  provider: new L.GeoSearch.Provider.OpenStreetMap(),
  position: 'topleft',
  showMarker: false,
  showPopup: true,
  //customIcon: false,
  customIcon: L.divIcon({html:'<span class="material-icons">&#xE8B6;</span>'}),
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
    link.innerHTML = '<span id="myloc" class="material-icons wtracks-control-icon">&#xE55C;</span>';
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
    editopts.innerHTML = '<a href="#" title="Manual Track" id="edit-manual"><span class="material-icons wtracks-control-icon">&#xE922;</span></a>' +
    '<a href="#" title="Auto Track" id="edit-auto"><span class="material-icons wtracks-control-icon">&#xE55D;</span></a>' +
    '<a href="#" title="Add segment" id="add-segment">' +
      '<span class="material-icons wtracks-control-icon segment-icon">&#xe6e1</span>' +
      '<span class="material-icons wtracks-control-icon add-segment-icon">&#xe145</span>' +
    '</a>' +
    '<a href="#" title="Delete segment" id="delete-segment">' +
      '<span class="material-icons wtracks-control-icon segment-icon">&#xe6e1</span>' +
      '<span class="material-icons wtracks-control-icon delete-segment-icon">&#xe14c</span>' +
    '</a>' +
    '<a href="#" title="Waypoint" id="edit-marker"><span class="material-icons wtracks-control-icon">&#xE55F;</span></a>';

    return container;
  }

});
L.EditorControl = L.EditControl.extend({
  options: {
    position: 'topleft',
    title: 'Toggle Edit',
//    html: '&#x270e;',
    html: '<span class="material-icons wtracks-control-icon">&#xE3C9;</span>',
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
L.DomEvent.disableClickPropagation(L.DomUtil.get("add-segment"));
L.DomEvent.disableClickPropagation(L.DomUtil.get("delete-segment"));
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
$("#add-segment").click(function(e) {
  ga('send', 'event', 'edit', 'new-segment');
  setEditMode(EDIT_NONE);
  newSegment();
  setEditMode(EDIT_MANUAL_TRACK);
  saveState();
  e.preventDefault();
});

$("#delete-segment").click(function(e) {
  if ((track.getLatLngs().length == 0) ||
    !confirm("Delete current segment?")) {
    return;
  }
  ga('send', 'event', 'edit', 'delete-segment');
  deleteSegment(track);
  saveState();
  e.preventDefault();
});

function deleteSegment(segment) {
  setEditMode(EDIT_NONE);
  if (editLayer.getLayers().length > 2) {
    editLayer.removeLayer(segment);
    segmentClickListener({ target: editLayer.getLayers()[1] }, true);
  } else {
    segment.setLatLngs([]);
    polystats.updateStatsFrom(0);
    setEditMode(EDIT_MANUAL_TRACK);
  }
  saveState();
}

function toolElevate(e) {
  ga('send', 'event', 'tool', 'elevate', undefined, track.getLatLngs().length);
  $("#menu").hide();
  if (track) elevate(track.getLatLngs(), function() {
    polystats.updateStatsFrom(0);
    saveState();
  });
  return false;
}
$("#elevate").click(toolElevate);

$("#cleanup").click(function(e) {
  var toclean = [];
  if (isChecked("#cleanupalt")) {
    toclean.push("alt")
  }
  if (isChecked("#cleanuptime")) {
    toclean.push("time")
  }
  if (toclean.length == 0) {
    // nothing to clean
    return;
  }
  ga('send', 'event', 'tool', 'cleanup', undefined, toclean.toString());
  $("#menu").hide();
  cleanup(toclean);
  polystats.updateStatsFrom(0);
  saveState();
  return false;
});

$("#revert").click(function(e) {
  ga('send', 'event', 'tool', 'revert', undefined, track.getLatLngs().length);
  $("#menu").hide();
  revert();
  polystats.updateStatsFrom(0);
  saveState();
  return false;
});

$(".statistics").click(function(e) {
  var tag = e.target.tagName.toUpperCase();
  if ((tag !== "SELECT") && (tag !== "OPTION")) {
    toggleElevation(e);
  }
});

function segmentClickListener(event, noGaEvent) {
    if (event.target != track) {
      if (!noGaEvent) {
        ga('send', 'event', 'edit', 'switch-segment');
      }
      if (track) {
        updateOverlayTrackStyle(track);
      }
      track = event.target;
      track.bringToFront();
      updateTrackStyle();
      polystats = L.polyStats(track, {
        chrono: true,
        speedProfile: getCurrentActivity().speedprofile,
        onUpdate: showStats,
      });
      if (!track.stats) {
        polystats.updateStatsFrom(0);
      }
      showStats();
      return true;
    } else {
      return false;
    }
}

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
  var wptLayer = waypoints;
  var initLayers = editLayer.getLayers().length;
  var activeTrack = track;

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

  function importSegment(name, coords, times) {
    var v;

    if (joinOnLoad || track.getLatLngs().length == 0) {
      // extend current 'track'
    } else {
      newSegment(true);
    }
    v = track.getLatLngs();
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

  if ((track.getLatLngs().length === 0) && (geojson.metadata)) {
    metadata = geojson.metadata ? geojson.metadata : {};
    setTrackName(metadata.name ? metadata.name : NEW_TRACK_NAME);
  }

  L.geoJson(geojson, {
    onEachFeature: function(f) {
      var name, coords, times;
      if (f.geometry.type === "LineString") {
        name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
        coords = f.geometry.coordinates;
        times = f.properties.coordTimes && (f.properties.coordTimes.length == coords.length) ? f.properties.coordTimes : undefined;
        importSegment(name, coords, times);
      }
      if (f.geometry.type === "MultiLineString") {
        name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
        for (var i = 0; i < f.geometry.coordinates.length; i++) {
          coords = f.geometry.coordinates[i];
          times = f.properties.coordTimes && f.properties.coordTimes[i] && (f.properties.coordTimes[i].length == coords.length) ? f.properties.coordTimes[i] : undefined;
          importSegment(name, coords, times);
        }
      } else if (f.geometry.type === "Point") {
        // import marker
        coords = f.geometry.coordinates;
        var latlng = newPoint(coords);
        newWaypoint(latlng, f.properties, wptLayer);
        bounds.extend(latlng);
      }
    }
  });
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  }
  clearStatus();
  if (!segmentClickListener({ target: activeTrack }, true)) {
    polystats.updateStatsFrom(0);
  }
  saveState();
  closeMenu();
  var addedLayers = editLayer.getLayers().length - initLayers;
  if (addedLayers) {
    ga('send', 'event', 'file', 'load-segment', undefined, addedLayers);
  }
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

function loadFromUrl(url, ext, noproxy, withCredentials) {
  setStatus("Loading...", { "spinner": true });
  var _url = noproxy ? url : corsUrl(url);
  var req = {
    url: _url,
    success: function(data) {
      loadCount = 0;
      fileloader.loadData(data, url, ext);
    }
  };
  if (withCredentials) {
    req.xhrFields = {
      withCredentials: true
    };
  }

  $.ajax(req).fail(function(resp) {
    setStatus("Failed: " + resp.statusText, { 'class': 'status-error', 'timeout': 3 });
  });
}

function getLoadExt() {
  var ext = getSelectedOption("#track-ext");
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
  var noproxy = isChecked("#noproxy");
  loadFromUrl(url, getLoadExt(), noproxy, noproxy);
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

var MAX_ROUTE_WPTS = 2;

function newRouteWaypoint(i, waypoint, n) {

  function getRouteWaypoinContent(latlng, index) {
    var div = document.createElement("div");

    p = L.DomUtil.create("div", "popupdiv ptbtn", div);
    var del = L.DomUtil.create('a', "", p);
    del.href = "#";
    del.title = "Delete";
    del.innerHTML = "<span class='popupfield'><i class='material-icons'>&#xE872;</i></span>";
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

  var nwpts = route ? route.getWaypoints().length : 0;
  if (nwpts > MAX_ROUTE_WPTS) {
    ga('send', 'event', 'error', 'route-pts-overlimit', location.toString() + ", " + navigator.userAgent, nwpts);
  }

  if ((track.getLatLngs().length > 0) && (i === 0)) {
    // no start marker for routes that continue an existing track
    return undefined;
  }
  var marker = L.marker(waypoint.latLng, {
    draggable: true,
    icon: MARKER_ICON
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

function getLatLngPopupContent(latlng, deletefn, splitfn, toadd) {
  var div = document.createElement("div");
  var p;

  p = L.DomUtil.create("div", "popupdiv", div);
  p.innerHTML = "<span class='popupfield'>Position:</span> " + latlng.lat + "," + latlng.lng;

  if (editMode != EDIT_NONE) {

    p = L.DomUtil.create("div", "popupdiv", div);
    p.innerHTML = "<span class='popupfield'>Altitude:</span> ";
    var altinput = L.DomUtil.create('input', "", p);
    altinput.type = "text";
    altinput.placeholder = "Numeric altitude";
    altinput.size = "5";
    $(altinput).val(isUndefined(latlng.alt) || !isNumeric(latlng.alt) ? "" : Math.round(latlng.alt));
    altinput.onkeyup = function() {
      try {
        latlng.alt = isNumeric(altinput.value) ? parseFloat(altinput.value) : undefined;
      } catch (e) {}
    };
    p = L.DomUtil.create("span", "", p);
    p.innerHTML = "m";
  } else {
    if (!isUndefined(latlng.alt)) {
      p = L.DomUtil.create("div", "popupdiv", div);
      p.innerHTML = "<span class='popupfield'>Altitude:</span> " + Math.round(latlng.alt) + "m";
    }
  }

  if (toadd) {
    div.appendChild(toadd);
  }

  if (editMode != EDIT_NONE) {
    // Delete button
    p = L.DomUtil.create("div", "popupdiv ptbtn", div);
    var btn = L.DomUtil.create('a', "", p);
    btn.href = "#";
    btn.title = "Delete";
    btn.innerHTML = "<span class='popupfield'><i class='material-icons'>&#xE872;</i></span>";
    btn.onclick = deletefn;

    if (splitfn) {
      // Split button
      p = L.DomUtil.create("div", "popupdiv ptbtn", div);
      p.id = "split";
      btn = L.DomUtil.create('a', "", p);
      btn.href = "#";
      btn.title = "Split segment from this point";
      btn.innerHTML = "<span class='popupfield'><i class='material-icons'>&#xE14E;</i></span>";
      btn.onclick = splitfn;
    }
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

function newVertex(e) {
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
}
map.on('editable:vertex:new', newVertex);

function dragVertex(e) {
  var i = e.vertex.getLatLng().i;
  elevatePoint(e.vertex.getLatLng(), function() {
    polystats.updateStatsFrom(i);
  });
  //console.log(e.type + ": " + i);
}
map.on('editable:vertex:dragend', dragVertex);

map.on('editable:middlemarker:mousedown', function(e) {
  //console.log(e.type);
});

function dragMarker(e) {
  elevatePoint(e.layer.getLatLng());
  //console.log(e.type);
}
map.on('editable:dragend', dragMarker);

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
  var message;

  // check GraphHopper response
  if (!isUnset(e)) {
    //log("GraphHopper credits: " + e.credits);
    var now = new Date();
    var resetDate = new Date(now.getTime() + (e.reset * 1000));
    if (resetDate > Date.parse(gh.reset)) {
      gh.reset = resetDate;
      gh.credits = 0;
    }
    if ((e.status >= 400) || (e.remaining === 0)) {
      if (e.status == 401) {
        message = "Invalid GraphHopper API key, please fix in Settings";
        ga('send', 'event', 'gh', 'invalid');
      } else {
        if (isUndefined(ghkey)) {
          ga('send', 'event', 'gh', 'wt-max');
          gh.credits = -1;
        } else {
          ga('send', 'event', 'gh', 'perso-max');
          message = "Your GraphHopper API key exhausted its daily quota";
        }
      }
    } else if ((gh.credits >= 0) && isUndefined(ghkey)) {
      gh.credits += e.credits;
    }
    storeJsonVal("wt.gh", gh);
  }

  if (isUndefined(ghkey)) {
    if (gh.credits < 0) {
      message = "WTracks exhausted its daily GraphHopper quota";
    } else if (gh.credits >= MAX_GH_CREDITS) {
      message = "You exhausted your daily GraphHopper quota";
      if (!isUnset(e)) {
        ga('send', 'event', 'gh', 'user-max');
      }
    }
  }
  if (message) {
    setEditMode(EDIT_NONE);
    showGraphHopperMessage(message);
    return false;
  }
  return true;
}

function newMarker(e) {

  if (editMode == EDIT_MARKER) {
    ga('send', 'event', 'edit', 'new-marker');
    var marker = newWaypoint(e.latlng, {name: "New waypoint"}, waypoints);
    elevatePoint(e.latlng);
    marker.enableEdit();
  } else if (editMode == EDIT_AUTO_TRACK) {
    if (!route) {
      if (!routeStart) {
        setRouteStart(e.latlng);
      } else {
        var fromPt = routeStart,
          toPt = e.latlng,
          router = L.Routing.graphHopper(
            ghkey ? ghkey : config.graphhopper.key(),
            { urlParameters: { vehicle: getCurrentActivity().vehicle } }
          );
        router.on("response", checkGraphHopperCredit);
        route = L.Routing.control({
          router: router,
          waypoints: [fromPt, toPt],
          routeWhileDragging: false,
          autoRoute: true,
          fitSelectedRoutes: false,
          lineOptions: {
            styles: [{
              color: trackColor,
              weight: trackWeight,
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
      if (wpts.length >= MAX_ROUTE_WPTS) { // up to 4 with free version
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
    closeMenu();
  }
}
map.on('click', newMarker);

map.on('editable:vertex:click', function(e) {

  function deleteTrackPoint(event) {
    e.vertex.delete();
    map.closePopup(pop);
    event.preventDefault();
  }
  function splitSegment(event) {
    ga('send', 'event', 'edit', 'split-segment');
    setEditMode(EDIT_NONE);
    var i = e.latlng.i;
    var seg1 = track.getLatLngs().slice(0,i),
        seg2 = track.getLatLngs().slice(i);
    track.setLatLngs(seg1);
    polystats.updateStatsFrom(0);
    newSegment();
    track.setLatLngs(seg2);
    polystats.updateStatsFrom(0);
    saveState();
    setEditMode(EDIT_MANUAL_TRACK);
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
  var splitfn,
      i = e.latlng.i,
      len = track.getLatLngs().length;
  if ((i>1) & (i<len-1)) {
    splitfn = splitSegment;
  }
  var pop = L.popup()
    .setLatLng(e.latlng)
    .setContent(getLatLngPopupContent(e.latlng, deleteTrackPoint, splitfn, div))
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
  $("#menu").show();
  $("#menu table").hide();
  $(".tablinks").removeClass("active");
  $("#tab" + item).addClass("active");
  $("#menu #menu" + item).show();
  if (event) {
    event.preventDefault();
  }
  ga('send', 'event', 'menu', item);
}
$(".tablinks").click(function(event) {
  menu(event.target.id.replace("tab", ""), event);
});
$("#donate").click(function(event) {
  ga('send', 'event', 'menu', 'donate');
});


function isStateSaved() {
  return isChecked("#cfgsave");
}
$("#cfgsave").change(function(e) {
  var saveCfg = isStateSaved();
  ga('send', 'event', 'setting', saveCfg ? 'save-on' : 'save-off');
  storeVal("wt.saveState", saveCfg ? "true" : "false");
  if (saveCfg) {
    saveState();
    saveSettings();
  } else {
    clearSavedState();
  }
});

setChecked("#merge", false);

$(document).ready(function() {

  // get visit info
  var about = getVal("wt.about", undefined);

  var url = getParameterByName("url");
  if (url) {
    ga('send', 'event', 'file', 'load-urlparam');
    var ext = getParameterByName("ext");
    var noproxy = getParameterByName("noproxy");
    showLocation = LOC_NONE;
    loadFromUrl(url, ext || undefined, noproxy || undefined, noproxy || undefined);
    setEditMode(EDIT_NONE);
  } else {
    restoreState(about);
  }

  /* Show About dialog if not shown since a while */
  var now = new Date();
  var ONE_MONTH = Math.round(1000*60*60*24*30.5); // 1 month in ms
  var FIRST_VISIT = "1";
  var showAbout = false;
  var resetAbout = false;
  if (about) {
    if (about == FIRST_VISIT) {
      resetAbout = true;
    } else {
      about = new Date(about).getTime();
      if (now.getTime() > about + 6 * ONE_MONTH) {
        resetAbout = true;
        showAbout = true;
      }
    }
  } else {
    storeVal("wt.about", FIRST_VISIT);
  }
  if (resetAbout) {
    // reset about tag
    storeVal("wt.about", new Date(now - 5 * ONE_MONTH).toISOString());
  }
  if (showAbout) {
    // wait for potential urlparam to be loaded
    setTimeout(function(){ menu("about"); }, 4000);
  }

  initTrackDisplaySettings();

  // Persist joinOnLoad option
  joinOnLoad = getBoolVal("wt.joinOnLoad", true);
  setChecked("#joinonload", joinOnLoad);
  $("#joinonload").change(function(e) {
    joinOnLoad = isChecked("#joinonload");
    saveValOpt("wt.joinOnLoad", joinOnLoad);
  });

});

$(window).on("unload", function() {
  saveState();
});
