// ESM module for main wtracks application
// Import dependencies from other modules
import config from './config.js';
import * as WU from './utils.js';
import * as WC from './wtracks-commons.js';
import * as CRY from './encdec.js';
import PasteLibs from './paste-libs.js';

// Dependencies loaded as globals via script tags in the HTML
/* globals $, ga, L, google, Dropbox, jscolor, saveAs, PMTiles */

let map;
let track;
let waypoints;
let extremities;
let editLayer;
let route;
let routeStart;
let polystats;

/*
  setInteractive "plugin" from
  https://github.com/Leaflet/Leaflet/issues/5442#issuecomment-424014428
  Thanks https://github.com/Jadaw1n
*/
L.Layer.prototype.setInteractive = function (interactive) {
  if (this.getLayers) {
    WU.arrayForEach(this.getLayers(), function (idx, layer) {
      layer.setInteractive(interactive);
    });
    return;
  }
  if (!this._path) {
    return;
  }

  this.options.interactive = interactive;

  if (interactive) {
    L.DomUtil.addClass(this._path, 'leaflet-interactive');
  } else {
    L.DomUtil.removeClass(this._path, 'leaflet-interactive');
  }
};

let statusTimeout;
function setStatus(msg, options) {
  $("#status-msg").text(msg);
  const statusclass = options && options.class ? options.class : "status-info";
  $("#status-msg").attr("class", statusclass);
  const showspinner = options && !WU.isUnset(options.spinner) && options.spinner;
  $("#spinner").toggle(showspinner);
  $("#status").fadeIn();
  if (options && options.timeout) {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
    }
    statusTimeout = setTimeout(clearStatus, 1000 * options.timeout);
  }
}

function clearStatus() {
  $("#status").fadeOut(800);
  statusTimeout = undefined;
}

setStatus("Loading...", { spinner: true });

let wtReady = false;
// on ready event (HTML + scripts loaded and executed):
$(function () {
  if (wtReady) {
    onerror("duplicate ready event", {
      "Stack": new Error().stack
    });
    return;
  }
  wtReady = true;

  WC.consentCookies();

  /* folding settings */
  function toggleElement(e) {
    $("." + e.target.id.slice(0, -1) + "-toggle").toggle();
  }
  $(".toggle").on("click", toggleElement);

  /* folding settings */
  function openFolder(id) {
    let eltInfo = id.split("-");
    // hide all group
    $(".fold-" + eltInfo[0] + ":not(.fold-link)").hide();
    $(".fold-" + eltInfo[0] + "-closed").show();
    $(".fold-link.fold-" + eltInfo[0]).removeClass("fold-selected");
    $(".fold-" + eltInfo[0] + "-closed").parent("div").removeClass("fold-selected-title");
    // show
    $("." + eltInfo[1]).show();
    $("#" + eltInfo[0] + "-" + eltInfo[1] + "-closed").hide();
    $("#" + eltInfo[0] + "-" + eltInfo[1]).addClass("fold-selected");
    $("#" + eltInfo[0] + "-" + eltInfo[1]).parent("div").addClass("fold-selected-title");
  }
  $(".fold").on("click", function (e) { openFolder(e.currentTarget.id); });

  // defaults
  openFolder("file-newtrk");
  openFolder("tools-trkpts");
  openFolder("settings-savstg");
  openFolder("about-donate");

  function updateMapStyle() {
    if (!map.editTools) {
      // editor not yet initialized
      map.options.editOptions.lineGuideOptions.color = getSegmentColor(track);
      map.options.editOptions.lineGuideOptions.weight = fwdGuide ? trackWeight : 0;
    } else {
      // update editor
      map.editTools.forwardLineGuide.options.color = getSegmentColor(track);
      map.editTools.forwardLineGuide.options.weight = fwdGuide ? trackWeight : 0;
    }
  }

  map = L.map('map', {
    editable: true,
    tap: L.Browser.safari && L.Browser.mobile, // TODO workaround for https://github.com/Leaflet/Leaflet/issues/7331
    editOptions: {
      lineGuideOptions: {
        opacity: 0.5
      }
    }
  });

  const NEW_TRACK_NAME = "New Track";
  const EMPTY_METADATA = { name: NEW_TRACK_NAME, desc: "" };

  let metadata = EMPTY_METADATA;
  let pruneDist = WU.getNumVal("wt.pruneDist", config.pruneDist);
  let pruneMaxDist = WU.getNumVal("wt.pruneMaxDist", config.pruneMaxDist);
  let pruneMaxTime = WU.getNumVal("wt.pruneMaxTime", config.pruneMaxTime);
  let wptLabel = WU.getBoolVal("wt.wptLabel", config.display.wptLabel, true);
  let hideWpt = WU.getBoolVal("wt.hideWpt", config.display.hideWpt, true);
  let smoothLevel = WU.getNumVal("wt.smoothLevel", config.smoothLevel);

  let fwdGuide = WU.getBoolVal("wt.fwdGuide", config.display.fwdGuide, true);
  let fwdGuideGa = true; // collect stats on this user preference
  let extMarkers = WU.getBoolVal("wt.extMarkers", config.display.extMarkers);
  let autoGrayBaseLayer = WU.getBoolVal("wt.autoGrayBaseLayer", config.display.autoGrayBaseLayer);
  let noMixOverlays = WU.getBoolVal("wt.noMixOverlays", false);
  let wasDragged;

  const EDIT_NONE = 0;
  const EDIT_RECORDING = 1;
  const EDIT_MANUAL_TRACK = 2;
  const EDIT_AUTO_TRACK = 3;
  const EDIT_MARKER = 4;
  const EDIT_DRAG = 5;
  const EDIT_DEFAULT = EDIT_MANUAL_TRACK;
  let editMode = -1;

  let mapsCloseOnClick = WU.getBoolVal("wt.mapsCloseOnClick", config.mapsCloseOnClick, true);

  let apikeys = {};
  WU.arrayForEach(["ghkey", "ggkey", "orskey"], function name(i, kname) {
    apikeys[kname] = WU.getVal("wt." + kname, undefined);
  });

  let apikeyNoMore = WU.getBoolVal("wt.apikeyNoMore", false);

  const MARKER_ICON = L.icon({
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
  const START_MARKER_ICON = L.icon({
    iconUrl: 'img/marker-start.png',
    iconSize: [17, 17],
    iconAnchor: [8, 8],
    popupAnchor: [0, 0]
  });
  const END_MARKER_ICON = L.icon({
    iconUrl: 'img/marker-end.png',
    iconSize: [17, 17],
    iconAnchor: [8, 8],
    popupAnchor: [0, 0]
  });

  const OFF_KEY = "OFF_";
  function getApiKey(apikey, defkey) {
    return !apikey || apikey.startsWith(OFF_KEY) ? defkey : apikey;
  }
  function getApiKeyVal(apikey) {
    return apikey.replace(OFF_KEY, "");
  }

  // load Google Maps API
  let gk = getApiKey(apikeys.ggkey, config.google.mapsapikey());
  $.getScript("https://maps.googleapis.com/maps/api/js" + (gk ? "?key=" + gk : ""));

  // load Dropbox API
  $("#dropboxjs").attr("data-app-key", config.dropbox.key());
  $("#dropboxjs").attr("src", "https://www.dropbox.com/static/api/2/dropins.js");

  function setTrackName(name) {
    $("#track-name").text(name);
    $("#track-name").attr("title", name + " - Click to edit (F2)");
    document.title = config.appname + " - " + name;
    metadata.name = name;
  }

  function getTrackName() {
    return metadata.name;
  }

  function askTrackName() {
    const name = prompt("Track name:", getTrackName());
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

  let warns = 0;
  function showWarning(title, msg, timeout) {
    let warnElt = $("<div class='warning'>");
    warnElt.append($("<div class='box-header'><span class='warning-title'>" +
      title + "</span><a href='#' class='close-button'>×</a></div>"));
    let warnMsg = $("<div class='warning-msg'>");
    warnMsg.html(msg);
    warnElt.append(warnMsg);
    $("#warning-box").append(warnElt);
    warns++;
    let closeButton = warnElt.find(".close-button");
    closeButton.on("click", function () {
      warnElt.remove();
      if (--warns <= 0) {
        $("#warning-box").hide();
      }
      return false;
    });
    $("#warning-box").show();
    /* */
    setTimeout(function () {
      closeButton.trigger("click");
    }, timeout ? timeout : 7000);
    /* */
  }

  $("#prompt-name").on("keyup", promptKeyEvent);
  $("#prompt-desc").on("keyup", promptKeyEvent);

  $("#prompt-ok").on("click", validatePrompt);
  $("#prompt-cancel").on("click", closeTrackNamePrompt);
  $("#track-name-edit").on("click", promptTrackName);

  /* ----------------------------------------------------- */

  function changeApikeyNomore(v) {
    apikeyNoMore = v;
    WC.saveValOpt("wt.apikeyNoMore", apikeyNoMore);
    ga('send', 'event', 'setting', 'keysNomore', undefined, apikeyNoMore ? 1 : 0);
  }

  function openApiKeyInfo(force) {
    if ((force || !apikeyNoMore) && $(".apikeys-dont").length == 0) {
      let apiKeyInfo = $("<a href='doc/#api-keys'>Set your API keys</a> to enable elevation and routing services." +
        "<span class='apikeys-dont'><br />To ignore this warning click <a class='apikeys-nomore' href='#'>stop</a></span>");
      apiKeyInfo.find(".apikeys-dont").toggle(!force);
      apiKeyInfo.find(".apikeys-nomore").on("click", function (evt) {
        changeApikeyNomore(true);
        $(evt.target).parents(".warning").find(".close-button").trigger("click");
        return false;
      });
      showWarning("No API key defined", apiKeyInfo, 10000);
    }
  }

  /* ----------------------------------------------------- */

  const selectActivity = $("#activity")[0];
  let activities = WU.getJsonVal("wt.activities");
  let loadedActivities = ""; // bug tracking
  let currentActivity;
  const ACTIVITY_RECORDED = "Recorded";
  function loadActivities() {
    loadedActivities = "Loaded ";
    if ($.isEmptyObject(activities)) {
      activities = config.activities.defaults;
      WC.saveJsonValOpt("wt.activities", activities);
    }
    loadedActivities += " " + Object.keys(activities).length + " activities";
    // append activities
    WU.objectForEach(activities, function (activityName) {
      if (!selectActivity.options[activityName]) {
        WU.addSelectOption(selectActivity, activityName);
      }
    });
    loadedActivities += " in " + $("#activity option").length + " options";
    // remove deleted activities
    $("#activity option").each(function (i, v) {
      if (!activities[v.value] && (v.value != ACTIVITY_RECORDED)) {
        v.remove();
      }
    });
    loadedActivities += ", kept " + $("#activity option").length;
    // this is to show the timing recorded in GPX
    if (!selectActivity.options[ACTIVITY_RECORDED]) {
      WU.addSelectOption(selectActivity, ACTIVITY_RECORDED);
    }

  }
  loadActivities();
  WU.selectOption(selectActivity, WU.getVal("wt.activity", ACTIVITY_RECORDED));

  function getCurrentActivityName() {
    return WU.getSelectedOption("#activity");
  }

  function updateCurrentActivity() {
    let activityName = getCurrentActivityName();
    if (!activityName) {
      activityName = activities ? Object.keys(activities)[0] : undefined;
      let dbgActivities = "";
      $("#activity option").each(function (i, a) {
        if (i > 0) {
          dbgActivities += "; ";
        }
        dbgActivities += (a.innerText + ($(a).is(":selected") ? "*" : ""));
      });
      $("#activity option").each(function (a) { console.log(a); });
      onerror("No current activity", {
        "Saved": WU.getVal("wt.activity"),
        "First": activityName,
        "Nb activities": Object.keys(activities).length,
        "Menu": dbgActivities,
        "Loaded": loadedActivities,
        "Stack": new Error().stack
      });
      if (activityName) WU.selectOption(selectActivity, activityName);
    }
    let requestedActivity = activityName;
    if (!activities[requestedActivity]) {
      if ($.isEmptyObject(activities)) {
        onerror("No activity");
        loadActivities();
      }
      activityName = Object.keys(activities)[0];
      if (requestedActivity != ACTIVITY_RECORDED) {
        onerror("Activity was not found", {
          "Activity": requestedActivity,
          "Nb activities": Object.keys(activities).length
        });
        WU.selectOption(selectActivity, activityName);
      }
    }
    currentActivity = activities[activityName];
    currentActivity.name = activityName;
    return currentActivity;
  }
  updateCurrentActivity();

  // in case activities were updated in other tab/window
  $("#activity").on("click", loadActivities);
  // on user selection
  $("#activity").on("change", function () {
    let selectedActivity = getCurrentActivityName();
    let currentActivityName = currentActivity.name;
    ga('send', 'event', 'activity', 'change', selectedActivity, undefined, Object.keys(activities).length);
    WC.saveValOpt("wt.activity", selectedActivity);
    if (selectedActivity != ACTIVITY_RECORDED) {
      if (selectedActivity != currentActivityName) {
        polystats.setSpeedProfile(updateCurrentActivity().speedprofile); // will show stats
        initSaveTimeProfiles();
      } else {
        showStats(); // from recorded to estimated stats
      }
    } else {
      showStats(); // show recorded stats
    }
  });

  /* ------------------------------------------------------------*/

  const ALL_SEGMENTS = "ALL";
  /**
   * Executes a function on each segment
   *
   * @param {function} func the Function to call on each segment
   * @param {array of uids} uids Optional list of segment uids to consider
   * @returns number of segments found
   */
  function forEachSegment(func, uids) {
    let count = 0;

    if (editLayer) {

      // sort segments on manual ordering if ordered
      let layers = editLayer.getLayers();
      let compare = function (a, b) {
        if (a._wtOrder == b._wtOrder) {
          return 0;
        } else if (!a._wtOrder) {
          return -1;
        } else if (!b._wtOrder) {
          return 1;
        }
        // else
        return (a._wtOrder < b._wtOrder) ? -1 : 1;
      };
      layers = layers.sort(compare);

      // iterate on ordered segments
      WU.arrayForEach(layers, function (idx, segment) {
        // check if it is a polyline
        if (segment.getLatLngs && segment.getLatLngs().length > 0) {
          if (Array.isArray(uids) && uids.includes) {
            if (!uids.includes("" + L.Util.stamp(segment))) {
              // this segment is not listed, skip it
              return;
            }
          } else if ((uids != ALL_SEGMENTS) && (segment.isHidden)) {
            // this segment is hidden, skip it
            return;
          }
          count++;
          return func(segment);
        }
      });
    }
    return count;
  }

  function applySegmentTool(toolFunc) {
    const onAllSegments = WU.isChecked("#allsegments");
    if (onAllSegments) {
      forEachSegment(toolFunc);
    } else {
      toolFunc(track);
    }
  }
  function checkToolsAllSegments() {
    WU.enableInput(!WU.isChecked("#allsegments"), "#trim-type, #trim-range");
  }
  $("#allsegments").on("change", checkToolsAllSegments);

  /* ------------------------------------------------------------*/

  function updateTrackStyle() {
    track.setStyle({
      color: track.color ? track.color : trackUI.trk.getColor(),
      weight: trackUI.trk.getWeight()
    });
    track.setInteractive(false);
  }

  function updateOverlayTrackStyle(segment) {
    segment.setStyle({
      color: segment.color ? segment.color : trackUI.ovl.getColor(),
      weight: segment.isHidden ? 0 : trackUI.ovl.getWeight()
    });
    segment.setInteractive(true);
  }

  function updateAllOverlayTrackStyle() {
    forEachSegment(function (segment) {
      // check it is not current track
      if (segment != track) {
        updateOverlayTrackStyle(segment);
      }
    });
  }

  function setPolyStats() {
    polystats = L.polyStats(track, {
      chrono: true,
      speedProfile: currentActivity.speedprofile,
      onUpdate: showStats,
    });
    if (!L.PolyStats.getStats(track)) {
      polystats.updateStatsFrom(0);
    } else {
      showStats();
    }
  }

  function updateSegmentStats(segment) {
    let segStats = L.polyStats(segment, {
      chrono: true,
      speedProfile: currentActivity.speedprofile
    });
    segStats.updateStatsFrom(0);
  }

  function newSegment(noStats) {
    if (track) {
      if (getTrackLength() == 0) {
        // current track is empty, don't create another one
        return track;
      }
      updateOverlayTrackStyle(track);
    }
    track = L.polyline([]);
    editLayer.addLayer(track);
    track.on('click', segmentClickListener);
    if (!noStats) {
      setPolyStats();
    }
    updateTrackStyle();
    return track;
  }

  function getTrackLength() {
    return track ? track.getLatLngs().length : 0;
  }

  function createExtremities() {
    function createExtremity(name, icon) {
      const mkOpts = {
        title: name,
        alt: name,
        icon: icon,
        keyboard: false,
        interactive: false
      };
      let marker = L.marker([0, 0], mkOpts);
      extremities.addLayer(marker);
    }
    extremities = L.featureGroup([]);
    editLayer.addLayer(extremities);
    createExtremity("Start", START_MARKER_ICON);
    createExtremity("End", END_MARKER_ICON);
    setExtremityVisibility(extMarkers);
  }

  function setExtremityVisibility(visible) {
    if (extremities) {
      if (visible && extMarkers && (getTrackLength() > 0)) {
        extremities.addTo(map);
      } else {
        extremities.remove();
      }
    }
  }

  function updateExtremity(latlng, i) {
    let eidx = -1;
    if (i == 0) {
      eidx = 0;
    } else if (i == getTrackLength() - 1) {
      eidx = 1;
    }
    if (eidx >= 0) {
      extremities.getLayers()[eidx].setLatLng(latlng);
    }
  }

  function updateExtremities() {
    if (extremities && track) {
      const last = getTrackLength() - 1;
      if (last >= 0) {
        updateExtremity(track.getLatLngs()[0], 0);
        updateExtremity(track.getLatLngs()[last], last);
      }
    }
  }

  $("#extMarkers").on("change", function () {
    extMarkers = !extMarkers;
    WC.saveValOpt("wt.extMarkers", extMarkers);
    setExtremityVisibility(extMarkers);
  });

  function newTrack() {
    metadata = WU.jsonClone(EMPTY_METADATA);
    if (track) {
      editLayer.removeLayer(track);
      track = undefined;
    }
    if (waypoints && !waypoints.isHidden) {
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
    waypoints.isHidden = hideWpt;
    if (!hideWpt) {
      editLayer.addLayer(waypoints);
    }
    newSegment();
    createExtremities();
    setTrackName(NEW_TRACK_NAME);
  }

  // =================== UNDO ====================

  const UNDO_ICON = "undo";
  const EDIT_AUTO_ICON = "navigation";
  const EDIT_AUTO_ID = "edit-auto";
  const EDIT_MANUAL_ICON = "timeline";
  const EDIT_MANUAL_ID = "edit-manual";
  const EDIT_DRAG_ID = "edit-drag";
  const EDIT_DRAG_ICON = "open_with";
  const EDIT_MARKER_ID = "edit-marker";
  const EDIT_ADDSEGMENT_ID = "add-segment";
  const EDIT_ADDSEGMENT_ICON = "add-segment-icon";
  const EDIT_DELSEGMENT_ID = "delete-segment";
  const EDIT_DELSEGMENT_ICON = "delete-segment-icon";

  const UndoRoute = {
    getType: function () {
      return "route";
    },
    init: function (args) {
      this.fromPt = args.fromPt;
    },
    undo: function () {
      if (!route && (track.getLatLngs().length > this.fromPt.i)) {
        track.setLatLngs(track.getLatLngs().slice(0, this.fromPt.i + 1));
        polystats.updateStatsFrom(0);
        updateExtremities();
        saveState();
      }
      restartRoute();
      if (track.getLatLngs().length <= 1) {
        // restart blank segment
        deleteSegment(track);
        newSegment();
        setEditMode(EDIT_NONE);
        setEditMode(EDIT_AUTO_TRACK);
      }
    },
    getIconId: function () {
      return EDIT_AUTO_ID;
    }
  };

  const UndoNewPt = {
    getType: function () {
      return "newPt";
    },
    init: function (args) {
      this.newPt = args.newPt;
    },
    undo: function () {
      if (track.getLatLngs().length > this.newPt.i) {
        track.editor.endDrawing();
        if (track.getLatLngs().length > 0) {
          this.newPt.undoing = true; // prevent deletion to add new undo item
          track.editor.removeLatLng(this.newPt);
          this.newPt.undoing = undefined;
        }
        track.editor.continueForward();
        polystats.updateStatsFrom(0);
        updateExtremities();
        saveState();
      }
    },
    getIconId: function () {
      return EDIT_MANUAL_ID;
    }
  };

  let UndoMovePt = {
    getType: function () {
      return "movePt";
    },
    init: function (args) {
      this.pt = args.pt;
      this.backupPt = WU.jsonClone(args.pt);
    },
    undo: function () {
      if (track.getLatLngs().length > this.pt.i) {
        track.editor.endDrawing();
        this.pt.lat = this.backupPt.lat;
        this.pt.lng = this.backupPt.lng;
        this.pt.alt = this.backupPt.alt;
        track.editor.refresh();
        track.editor.continueForward();
        polystats.updateStatsFrom(0);
        updateExtremities();
        saveState();
      }
    },
    getIconId: function () {
      return EDIT_MANUAL_ID;
    }
  };

  let UndoDeletePt = {
    getType: function () {
      return "deletePt";
    },
    init: function (args) {
      this.pt = args.pt;
    },
    undo: function () {
      if (track.getLatLngs().length > this.pt.i) {
        track.editor.endDrawing();
        track.getLatLngs().splice(this.pt.i, 0, this.pt);
        track.editor.refresh();
        track.editor.continueForward();
        polystats.updateStatsFrom(0);
        updateExtremities();
        saveState();
      }
    },
    getIconId: function () {
      return EDIT_MANUAL_ID;
    }
  };

  let undos = [];
  function undo() {
    if (undos.length < 1) {
      console.debug("nothing to undo");
      return;
    }
    const toUndo = undos.pop();
    ga('send', 'event', 'edit', 'undo', toUndo.getType());
    toUndo.undo();
    if (undos.length < 1) {
      endUndo(toUndo.getIconId());
    }
  }
  function addUndo(undoObjectType, args) {
    const newUndo = Object.create(undoObjectType);
    newUndo.init(args);
    undos.push(newUndo);
    if (undos.length == 1) {
      const id = newUndo.getIconId();
      $("#" + id).attr("oldhtml", $("#" + id + " span").html());
      $("#" + id).attr("oldtitle", $("#" + id).attr("title"));
      $("#" + id + " span").html(UNDO_ICON);
      $("#" + id).attr("title", "Undo last edit");
    }
  }
  function endUndo(id) {
    if (!id) {
      id = undos[0].getIconId();
    }
    $("#" + id + " span").html($("#" + id).attr("oldhtml"));
    $("#" + id).attr("title", $("#" + id).attr("oldtitle"));
    undos = [];
  }

  // ==============================================

  function setWaypointTooltip(wpt) {
    let ttip = wpt.getTooltip();
    if (wpt.options.title) {
      if (ttip) {
        // already exists, just update text
        ttip.setContent(wpt.options.title);
      } else {
        // new tooltip
        ttip = wpt.bindTooltip(wpt.options.title, { permanent: wptLabel });
        if (wptLabel) {
          ttip.openTooltip();
        }
      }
    } else {
      if (ttip) {
        wpt.unbindTooltip();
      }
    }
  }

  function newWaypoint(latlng, properties, wptLayer) {

    function deleteMarker(e) {
      waypoints.removeLayer(marker);
      map.closePopup();
      e.preventDefault();
    }

    function getMarkerPopupContent(marker) {
      let div = L.DomUtil.create('div', "popupdiv");
      let label;

      if (editMode === EDIT_MARKER) {

        // name
        label = L.DomUtil.create('div', "popupdiv", div);
        label.innerHTML = "<span class='popupfield'>Name:</span> ";
        let name = L.DomUtil.create('input', "popup-nameinput", label);
        name.type = "text";
        name.placeholder = "Textual name";
        $(name).val(marker.options.title ? marker.options.title : "");
        name.onkeyup = function () {
          const nameval = $(name).val().trim();
          marker.options.title = nameval;
          setWaypointTooltip(marker);
          const elt = marker.getElement();
          elt.alt = nameval;
        };

        // description
        label = L.DomUtil.create('div', "popupdiv", div);
        label.innerHTML = "<span class='popupfield'>Desc:</span>";
        let richtxtlbl = L.DomUtil.create('label', "rich-text", label);
        let richtxtcb = L.DomUtil.create('input', "rich-text", richtxtlbl);
        richtxtcb.type = 'checkbox';
        $(richtxtlbl).append("Rich text");
        let desc = L.DomUtil.create('textarea', "popup-descinput", label);
        desc.placeholder = "Textual/HTML description";
        $(desc).val(marker.options.desc ? marker.options.desc : "");
        desc.onkeyup = function () {
          const descval = $(desc).val();
          marker.options.desc = descval;
        };

        const setRichDesc = function () {
          const h = Math.max(120, $(desc).height());
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
            .on('tbwinit', function () {
              $("div.trumbowyg-editor, .trumbowyg-box").css('min-height', h);
            });
        };

        $(richtxtcb).on("change", function () {
          if (WU.isChecked(richtxtcb)) {
            setRichDesc();
          } else {
            $(".popup-descinput").trumbowyg('destroy');
            $(".popup-descinput").height($(".popup-descinput").attr('origheight'));
          }
        });
        if (marker.options.desc && marker.options.desc.indexOf("<") >= 0) {
          WU.setChecked(richtxtcb, 'checked');
          setRichDesc();
        }

      } else {

        // name
        if (marker.options.title) {
          let popupName = L.DomUtil.create('div', "popup-name", div);
          popupName.innerHTML = marker.options.title;
        }

        // description
        if (marker.options.desc) {
          const popupDesc = L.DomUtil.create('pre', "popup-desc", div);
          popupDesc.innerHTML = marker.options.desc;
        }

      }

      // cmt
      if (marker.options.cmt) {
        const popupCmt = L.DomUtil.create('pre', "popup-desc", div);
        popupCmt.innerHTML = marker.options.cmt;
      }

      // time
      if (marker.options.time) {
        const popupTime = L.DomUtil.create('pre', "popup-desc", div);
        popupTime.innerHTML = marker.options.time;
      }


      const latlng = marker.getLatLng();
      const markerDiv = getLatLngPopupContent(latlng, deleteMarker, undefined, undefined, div);
      return markerDiv;
    }

    const wptOpts = {
      title: properties.name || "",
      alt: properties.name || "",
      desc: properties.desc || properties.description || "",
      cmt: properties.cmt || undefined,
      time: properties.time || undefined,
      icon: MARKER_ICON
    };
    const marker = L.marker(latlng, wptOpts);
    wptLayer.addLayer(marker);

    if (wptLayer == waypoints) {
      !wptLayer.isHidden && marker.getElement().removeAttribute("title"); // remove default HTML tooltip
      setWaypointTooltip(marker);
      marker.on("click", function () {
        if (editMode == EDIT_DRAG) return;
        L.popup({ "className": "overlay" })
          .setLatLng(marker.getLatLng())
          .setContent(getMarkerPopupContent(marker))
          .openOn(map);
      });
    }

    return marker;
  }

  $("#wptLabel").on("change", function () {
    wptLabel = !wptLabel;
    WC.saveValOpt("wt.wptLabel", wptLabel);
    WU.arrayForEach(waypoints.getLayers(), function (idx, wpt) {
      // create new tooltip (they're not mutable!)
      wpt.unbindTooltip();
      setWaypointTooltip(wpt);
    });
  });

  $("#hideWpt").on("change", function () {
    hideWpt = !hideWpt;
    WC.saveValOpt("wt.hideWpt", hideWpt);
    waypoints.isHidden = hideWpt;
    hideWpt ? editLayer.removeLayer(waypoints) : editLayer.addLayer(waypoints);
  });

  $("#fwdGuide").on("change", function () {
    fwdGuide = !fwdGuide;
    WC.saveValOpt("wt.fwdGuide", fwdGuide);
    updateMapStyle();
    fwdGuideGa = true;
  });

  /* ------------------------ TRIMMING ---------------------------------- */

  let polytrim;

  function prepareTrim() {
    const trimMax = Math.round(getTrackLength() / 2);
    $("#trim-txt").text("0/" + getTrackLength());
    $("#trim-range").attr("max", trimMax);
    $("#trim-range").val(0);
    $('.no-trim:not([class*="isdisabled"])').prop('disabled', false);
    const trimType = $("#trim-type")[0].selectedIndex;
    polytrim = L.polyTrim(track, trimType);
  }

  function trimTrack() {
    const n = parseInt($("#trim-range").val());
    console.log("trimming " + n);
    $("#trim-txt").text(n + "/" + polytrim.getPolySize());
    $('.no-trim:not([class*="isdisabled"])').prop('disabled', (n !== 0));
    polytrim.trim(n);
  }

  function finishTrim() {
    const n = parseInt($("#trim-range").val());
    if (n > 0) {
      ga('send', 'event', 'tool', 'trim', undefined, n);
      if (polytrim.getDirection() === polytrim.FROM_END) {
        // From End
        polystats.updateStatsFrom(getTrackLength() - 1);
      } else {
        // From Start
        polystats.updateStatsFrom(0);
      }
      updateExtremities();
      saveState();
      polytrim = undefined;
      $("#trim-range").val(0);
    }
  }

  $("#trim-range").on("change", trimTrack);
  $("#trim-type").on("change", prepareTrim);

  /* --------------------------------------*/
  // Track display settings

  let trackColor;
  let trackWeight;
  let ovlTrackColor;
  let ovlTrackWeight;
  const trackUI = {
    trk: {
      getDefaultColor: function () {
        return config.display.trackColor;
      },
      getColor: function () {
        return trackColor;
      },
      setColor: function (v) {
        trackColor = v;
        WC.saveValOpt("wt.trackColor", v);
        updateTrackStyle();
        updateMapStyle();
      },
      getDefaultWeight: function () {
        return config.display.trackWeight;
      },
      getWeight: function () {
        return trackWeight;
      },
      setWeight: function (v) {
        trackWeight = v;
        WC.saveValOpt("wt.trackWeight", v);
        updateTrackStyle();
        updateMapStyle();
      }
    },
    ovl: {
      getDefaultColor: function () {
        return config.display.ovlTrackColor;
      },
      getColor: function () {
        return ovlTrackColor;
      },
      setColor: function (v) {
        ovlTrackColor = v;
        WC.saveValOpt("wt.ovlTrackColor", v);
        updateAllOverlayTrackStyle();
      },
      getDefaultWeight: function () {
        return config.display.ovlTrackWeight;
      },
      getWeight: function () {
        return ovlTrackWeight;
      },
      setWeight: function (v) {
        ovlTrackWeight = v;
        WC.saveValOpt("wt.ovlTrackWeight", v);
        updateAllOverlayTrackStyle();
      }
    }
  };
  let trackUISetting = trackUI.trk;
  trackColor = WU.getVal("wt.trackColor", trackUI.trk.getDefaultColor());
  trackWeight = WU.getVal("wt.trackWeight", trackUI.trk.getDefaultWeight());
  ovlTrackColor = WU.getVal("wt.ovlTrackColor", trackUI.ovl.getDefaultColor());
  ovlTrackWeight = WU.getVal("wt.ovlTrackWeight", trackUI.ovl.getDefaultWeight());
  updateMapStyle();

  $("input:radio[name=track-type]").on("change", function () {
    const t = $("input:radio[name=track-type]:checked").val();
    trackUISetting = trackUI[t];
    initTrackDisplaySettings();
  });
  $("#track-color").on("change", function () {
    const v = $("#track-color").val();
    ga('send', 'event', 'setting', 'trackColor', v);
    trackUISetting.setColor(v);
  });
  $("#track-weight").on("change", function () {
    const v = $("#track-weight").val();
    ga('send', 'event', 'setting', 'trackWeight', v);
    $("#track-weight-v").text(v);
    trackUISetting.setWeight(v);
  });
  $("#track-resetcolorweight").on("click", function () {
    trackUISetting.setColor(trackUISetting.getDefaultColor());
    trackUISetting.setWeight(trackUISetting.getDefaultWeight());
    ga('send', 'event', 'setting', 'trackReset');
    initTrackDisplaySettings();
  });
  function initTrackDisplaySettings() {
    let v;
    v = trackUISetting.getColor();
    $("#track-color").val(v);
    $("#track-color-picker")[0].jscolor.fromString(v);
    v = trackUISetting.getWeight();
    $("#track-weight").val(v);
    $("#track-weight-v").text(v);
  }

  /* --------------------------------------*/
  // API keys

  let elevationService;
  let routerFactory;

  function showApiKey(name) {
    const value = apikeys[name];
    const useDefault = WU.isUndefined(getApiKey(value));
    const input = $("#" + name + "-value");
    //console.debug(name + ": " + value);
    WU.setChecked("#" + name + "-chk", !useDefault);
    input.val(WU.isUndefined(value) ? "" : getApiKeyVal(value));
    input.attr("disabled", useDefault);
  }

  function updateApiKey(name) {
    const useDefault = !WU.isChecked("#" + name + "-chk");
    let key = $("#" + name + "-value").val().trim();
    if (key === "") {
      key = undefined;
    } else if (useDefault) {
      key = OFF_KEY + key;
    }
    const gav = useDefault ? -1 : key ? 1 : 0;
    ga('send', 'event', 'setting', 'keys', name, gav);
    //console.debug(name + "= " + key);
    WC.saveValOpt("wt." + name, key);
    return key;
  }

  function updateApiServices() {

    // elevation
    if (getApiKey(apikeys.ggkey)) {
      $("#elevation-srv").text("Google");
    } else if (getApiKey(apikeys.orskey)) {
      $("#elevation-srv").text("OpenRoute");
    } else {
      $("#elevation-srv").text("Disabled - Set your API key");
    }

    // routing
    if (getApiKey(apikeys.ghkey)) {
      $("#routing-srv").text("GraphHopper");
    } else if (getApiKey(apikeys.orskey)) {
      $("#routing-srv").text("OpenRoute");
    } else {
      $("#routing-srv").text("Disabled - Set your API key");
    }

    elevationService = getApiKey(apikeys.ggkey) ?
      googleElevationService :
      (getApiKey(apikeys.orskey) ? orsElevationService : null);

    $("#elevate").prop('disabled', WU.isUnset(elevationService));
    const classOp = elevationService ? "removeClass" : "addClass";
    $("#elevate")[classOp]("isdisabled");
    $("#elevatetxt-help-enable").html(elevationService ? "" :
      "<br><a href='doc/#api-keys'>Set your API keys</a> to enable elevation services.");

    routerFactory = getApiKey(apikeys.ghkey) ?
      createGraphHopperRouter : getApiKey(apikeys.orskey) ?
        createOrsRouter : null;

  }

  function checkApikey(name) {
    const useDefault = !WU.isChecked("#" + name + "-chk");
    $("#" + name + "-value").attr("disabled", useDefault);
    const key = updateApiKey(name);
    return key;
  }

  function apiKeyChange(evt) {
    const keyname = evt.target.id.match(/^[^\\-]+/)[0];
    apikeys[keyname] = checkApikey(keyname);
    updateApiServices();
  }
  $(".key-chk").on("change", apiKeyChange);
  $(".key-value").on("focusout", apiKeyChange);

  function resetApiKey(name) {
    WU.setChecked("#" + name + "-chk", false);
    $("#" + name + "-value").val("");
    $("#" + name + "-chk").trigger("change");
  }

  $("#keys-reset").on("click", function () {
    ga('send', 'event', 'setting', 'keys', 'reset');
    WU.objectForEach(apikeys, function name(kname) {
      resetApiKey(kname);
    });
  });

  WU.objectForEach(apikeys, function name(kname) {
    showApiKey(kname);
  });
  updateApiServices();

  $("#apikeys-warn").on("change", function () {
    changeApikeyNomore(!WU.isChecked("#apikeys-warn"));
  });

  /* ------------------------ MENU ---------------------------------- */

  function closeMenu() {
    if (!$("#menu").is(":hidden")) {
      $("#menu").hide();
      finishTrim();
    }
  }

  function openMenu(tab) {
    if (isMenuVisible()) return;
    setEditMode(EDIT_NONE);
    WU.setChecked("#merge", false);
    WU.setChecked("#apikeys-warn", !apikeyNoMore);
    WU.setChecked("#fwdGuide", fwdGuide);
    WU.setChecked("#hideWpt", hideWpt);
    WU.setChecked("#wptLabel", wptLabel);
    WU.setChecked("#extMarkers", extMarkers);
    WU.setChecked("#autoGrayBaseLayer", autoGrayBaseLayer);
    WU.setChecked("#noMixOverlays", noMixOverlays);
    prepareTrim();
    $("#prune-dist").val(pruneDist);
    $("#prune-max-dist").val(pruneMaxDist);
    $("#prune-max-time").val(pruneMaxTime);
    $("#smooth-level").val(smoothLevel);
    $(".invalid").removeClass("invalid");
    menu(tab ? tab : "file");
    if (($("#save-time-from").val() == "") &&
      (getTrackLength() > 0) &&
      track.getLatLngs()[0].time) {
      WU.setDateTimeInput($("#save-time-from"), track.getLatLngs()[0].time);
    }
    initSaveTimeProfiles();
    checkToolsAllSegments();
    checkPruneKeepOpts();
    openSegmentsEditor();
    initServiceWorkerSetting();
  }
  function isMenuVisible() {
    return $("#menu").is(":visible");
  }

  $("#menu-close").on("click", function () {
    closeMenu();
    return false;
  });
  $("#track-new").on("click", function () {
    ga('send', 'event', 'file', 'new');
    newTrack();
    setEditMode(EDIT_MANUAL_TRACK);
    saveState();
    closeMenu();
  });
  $("#menu-track").on("click", function () {
    $(".collapsable-track").toggle();
  });
  $("#menu-tools").on("click", function () {
    $(".collapsable-tools").toggle();
  });

  /* ------------------------ EXPORT GPX ---------------------------------- */

  function LatLngToGPX(ptindent, latlng, gpxelt, properties) {

    let gpx = ptindent + "<" + gpxelt;
    gpx += " lat=\"" + getCoordinate(latlng.lat) + "\" lon=\"" + getCoordinate(latlng.lng) + "\">";
    if (!isNaN(latlng.alt)) {
      gpx += "<ele>" + latlng.alt + "</ele>";
    }
    if (properties.time) {
      gpx += "<time>" + properties.time + "</time>";
    }
    if (properties.title) {
      gpx += "<name>" + WU.htmlEncode(properties.title) + "</name>";
    }
    if (properties.cmt) {
      gpx += "<cmt>" + WU.htmlEncode(properties.cmt) + "</cmt>";
    }
    if (properties.desc) {
      gpx += "<desc>" + WU.htmlEncode(properties.desc) + "</desc>";
    }
    if (properties.ext) {
      gpx += "\n" + ptindent + "  <extensions>";
      gpx += properties.ext;
      gpx += "</extensions>\n" + ptindent;
    }
    gpx += "</" + gpxelt + ">\n";
    return gpx;
  }

  function getSegmentGPX(segment, ptindent, pttag) {
    let gpx = "";
    const latlngs = segment ? segment.getLatLngs() : undefined;
    if (latlngs && latlngs.length > 0) {
      let j = 0;
      while (j < latlngs.length) {
        const pt = latlngs[j];
        const time = pt.time;
        gpx += LatLngToGPX(ptindent, pt, pttag, { 'time': time, 'ext': pt.ext });
        j++;
      }
    }
    return gpx;
  }

  function getGPX(trackname, savealt, asroute, nometadata) {

    let startdate = new Date();
    const xmlname = "<name>" + WU.htmlEncode(trackname) + "</name>";
    let gpx = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
    gpx += '<gpx creator="' + config.appname + '"\n';
    gpx += '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"';

    // xmlns from each segment
    const xmlnsArr = [];
    WU.arrayForEach(editLayer.getLayers(), function (idx, segment) {
      if (segment.xmlnsArr && segment.xmlnsArr.length) {
        for (let i = 0; i < segment.xmlnsArr.length; i++) {
          const item = segment.xmlnsArr[i];
          if (xmlnsArr.indexOf(item) < 0) {
            gpx += '\n    ' + item;
            xmlnsArr.push(item);
          }
        }
      }
    });
    gpx += '>\n';

    if (!nometadata) {
      gpx += "<metadata>\n";
      gpx += "  " + xmlname + "\n";
      gpx += "  <desc>" + (metadata.desc ? WU.htmlEncode(metadata.desc) : "") + "</desc>\n";
      gpx += "  <author><name>" + WU.htmlEncode(config.appname) + "</name></author>\n";
      gpx += "  <link href='" + window.location.href + "'>\n";
      gpx += "    <text>" + WU.htmlEncode(config.appname) + "</text>\n";
      gpx += "    <type>text/html</type>\n";
      gpx += "  </link>\n";
      gpx += "  <time>" + startdate.toISOString() + "</time>\n";
      let crs;
      try {
        crs = map.options.crs.code;
      } catch (err) {
        console.error(err);
      }
      if (map.getBounds().isValid()) {
        try {
          const sw = map.getBounds().getSouthWest();
          const ne = map.getBounds().getNorthEast();
          gpx += '  <bounds minlat="' + getCoordinate(Math.min(sw.lat, ne.lat)) +
            '" minlon="' + getCoordinate(Math.min(sw.lng, ne.lng)) +
            '" maxlat="' + getCoordinate(Math.max(sw.lat, ne.lat)) +
            '" maxlon="' + getCoordinate(Math.max(sw.lng, ne.lng)) + '"/>\n';
        } catch (err) {
          let sz;//, zoom;
          try {
            sz = map.getSize().toString();
            //zoom = map.getZoom();
          } catch (err2) {
            console.log(err2);
          }
          onerror("getGPX: getBounds failed", {
            baseLayer: baseLayer,
            crs: crs,
            hasTrack: track != null,
            hasPoints: track ? track.getLatLngs().length : 0,
            size: sz
          }, 0, 0, err);
        }
      } else {
        onerror("getGPX: getBounds invalid", {
          baseLayer: baseLayer,
          crs: crs,
          hasTrack: track != null,
          hasPoints: track ? track.getLatLngs().length : 0
        });
      }
      gpx += "</metadata>\n";
    }

    // Waypoints
    const wpts = waypoints && !waypoints.isHidden ? waypoints.getLayers() : undefined;
    if (wpts && wpts.length > 0) {
      let i = 0;
      while (i < wpts.length) {
        const wpt = wpts[i];
        gpx += LatLngToGPX("", wpt.getLatLng(), "wpt", wpt.options);
        i++;
      }
    }

    let ptindent, pttag, wraptag, segtag;
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


    startdate = startdate.getTime();
    const selectedSegment = track;
    // for each segment
    forEachSegment(function (segment) {
      segmentClickListener({ target: segment }, true);
      // check if it is a polyline
      gpx += "<" + wraptag + ">\n";
      if (segment.name) {
        gpx += `  <name>${WU.htmlEncode(segment.name)}</name>\n`;
      }
      if (segment.color) {
        gpx += "  <extensions>\n";
        gpx += `    <line><color>${segment.color}</color></line>\n`;
        gpx += "  </extensions>\n";
      }
      if (segtag) {
        gpx += "  <" + segtag + ">\n";
      }
      gpx += getSegmentGPX(segment, ptindent, pttag);
      if (segtag) {
        gpx += "  </" + segtag + ">\n";
      }
      gpx += "</" + wraptag + ">";
    });
    segmentClickListener({ target: selectedSegment }, true);

    gpx += "</gpx>\n";
    return gpx;
  }

  function getConfirmedTrackName() {
    let trackname = getTrackName();
    if (!trackname || trackname === NEW_TRACK_NAME) {
      askTrackName();
      trackname = getTrackName();
    }
    return trackname;
  }

  function getTrackGPX(doConfirmName) {
    const asroute = WU.isChecked("#as-route");
    const nometadata = WU.isChecked("#nometadata");
    const trackname = doConfirmName ? getConfirmedTrackName() : getTrackName();
    return getGPX(trackname, /*savealt*/ false, asroute, nometadata);
  }

  const SAVE_TIME_TO = "_to_";
  function initSaveTimeProfiles() {

    function checkSaveTimeProfile() {
      let selected = WU.getSelectedOption("#save-time-profile");
      WU.enableInput(selected == SAVE_TIME_TO, "#save-time-to");
      if (selected != SAVE_TIME_TO) {
        $("#save-time-to").removeClass("invalid");
      }
    }

    $("#save-time-profile").empty();
    $("#save-time-profile").off("change");
    let profiles = $("#save-time-profile")[0];

    try {

      WU.addSelectOption(profiles, currentActivity.name);
      WU.addSelectOption(profiles, SAVE_TIME_TO, "To date:");
      checkSaveTimeProfile();

      $("#save-time-profile").on("change", checkSaveTimeProfile);
    } catch {
      onerror("no save-time-profile selector", { cells: $("#menutools tr").length });
      WC.forceReload();
    }

  }

  $("#save-time").on("click", () => {

    if (track && (track.getLatLngs().length > 0)) {

      let profile = WU.getSelectedOption("#save-time-profile");
      let from;
      let to, duration;
      let distance = 0;
      from = WU.getDateTimeInput($("#save-time-from"), true);
      if (!from) return;
      if (profile == SAVE_TIME_TO) {
        to = WU.getDateTimeInput($("#save-time-to"), true);
        if (!to) return;
        duration = to.getTime() - from.getTime();
        applySegmentTool(function (segment) {
          distance += L.PolyStats.getPointDistance(WU.arrayLast(segment.getLatLngs()));
        });
      }

      let lastSegTime;
      let lastSegDist = 0;
      applySegmentTool(function (segment) {
        const pts = segment.getLatLngs();
        WU.arrayForEach(pts, (idx, pt) => {
          if (profile == SAVE_TIME_TO) {
            const relDist = (lastSegDist + L.PolyStats.getPointDistance(pt)) / distance;
            lastSegTime = new Date(from.getTime() + (duration * relDist));
            pt.time = lastSegTime.toISOString();
          } else {
            if (!WU.isUndefined(L.PolyStats.getPointTime(pt))) {
              lastSegTime = new Date(from.getTime() + (L.PolyStats.getPointTime(pt) * 1000));
              pt.time = lastSegTime.toISOString();
            }
          }
        });
        lastSegDist += L.PolyStats.getPointDistance(WU.arrayLast(segment.getLatLngs()));
        // last segment time is the start of the next segment
        from = lastSegTime;
      });
      setStatus("Time saved", { timeout: 3 });
      ga('send', 'event', 'tool', 'save-time');
      saveState();

    }
  });

  $("#shift-time").on("click", () => {

    if (track && (track.getLatLngs().length > 0)) {

      let unit = WU.getSelectedOption("#shift-time-unit");
      let byUnit;
      let byMs;
      byUnit = WU.getRealInput($("#shift-time-by"), true);
      if (!byUnit) return;
      switch (unit) {
        case "day":
          byMs = byUnit * 24 * 3600000;
          break;
        case "hour":
          byMs = byUnit * 3600000;
          break;
        case "minute":
          byMs = byUnit * 60000;
          break;
        case "second":
          byMs = byUnit * 1000;
          break;
      }

      let nbErr = 0;
      applySegmentTool(function (segment) {
        const pts = segment.getLatLngs();
        WU.arrayForEach(pts, (idx, pt) => {
          if (pt.time) {
            try {
              let oldTime = new Date(pt.time);
              let newTime = new Date(oldTime.getTime() + byMs);
              pt.time = newTime.toISOString();
            } catch {
              nbErr++;
            }
          }
        });
      });
      if (nbErr) {
        console.error(nbErr, "points could not be moved because of invalid date format");
      }
      setStatus("Shift completed", { timeout: 3 });
      ga('send', 'event', 'tool', 'shift-time');
      saveState();
    }
  });

  $("#track-download").on("click", function () {
    setEditMode(EDIT_NONE);
    setStatus("Formatting..", { spinner: true });
    const gpx = getTrackGPX(true);
    ga('send', 'event', 'file', 'save', undefined, Math.round(gpx.length / 1000));
    try {
      const blob = new Blob([gpx],
        WU.isSafari() ? { type: "text/plain;charset=utf-8" } : { type: "application/gpx+xml;charset=utf-8" }
      );
      saveAs(blob, getTrackName() + ".gpx");
      clearStatus();
    } catch (err) {
      setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
    }
    closeMenu();
  });

  //---------------------------------------------------
  // Segments editor

  function getSegmentColor(segment) {
    return segment && segment.color ? segment.color : trackUI.trk.getColor();
  }

  function addEditorSegmentItem(segment, i) {

    function getSegmentName() {
      return segment.name ? segment.name : "Segment #" + (i + 1);
    }

    function editSegmentName() {
      let newName = prompt("Enter track name:", getSegmentName());
      newName = newName ? newName.trim() : false;
      if (newName) {
        segment.name = newName;
        itemName.find(".name").text(newName);
      }
    }

    function updateSegmentColor() {
      segment.color = segColor.val();
      if (segment == track) {
        updateTrackStyle();
      } else {
        updateOverlayTrackStyle(segment);
      }
    }

    function toggleSegmentItem() {
      toggleSegment(segment);
      segmentsToggled(1);
    }

    let segItem = `<li uid='${L.Util.stamp(segment)}'><span class='list-item'>`;

    // drag icon
    segItem += "<i class='material-icons item-drag notranslate' title='Drag to reorder'>swap_vert</i> ";
    // check box
    segItem += "<input type='checkbox' class='seg-check'/>";
    // segment name
    segItem += "<span class='item-name seg-name notranslate' 'translate'='no'><span class='name'></span><span class='stats'></span></span> ";
    if (segment.isHidden) {
      // show hidden icon
      segItem += "<i class='material-icons seg-toggle notranslate' title='Hidden'>visibility_off</i> ";
    } else {
      // color picker
      segItem += `<button class='material-icons symbol setting-value item-color-picker-${i}' data-jscolor='{"valueElement":"segment-color-${i}", "hash":true, "zIndex":10001, "closable":true}'>colorize</button> <input id='segment-color-${i}' class='hidden'/>`;
    }
    segItem += "</span></li>";
    $("#segments-list").append(segItem);
    let newitem = $("#segments-list .list-item:last");

    // name
    let segName = getSegmentName();
    let itemName = newitem.find(".item-name");
    let lastPt = WU.arrayLast(segment.getLatLngs());
    //let firstPt = segment.getLatLngs()[0];
    let segDuration = getRecordedTime(segment.getLatLngs());
    if (WU.isUndefined(segDuration)) {
      segDuration = " <i class='material-icons' title='Estimated time'>av_timer</i> " + time2txt(L.PolyStats.getPointTime(lastPt));
    } else {
      segDuration = " <i class='material-icons' title='Recorded time'>schedule</i> " + time2txt(segDuration);
    }
    itemName.find(".name").text(segName);
    itemName.find(".name").attr("title", segName);
    itemName.find(".stats").html(" <i class='material-icons' title='One way distance'>straighten</i> " + dist2txt(L.PolyStats.getPointDistance(lastPt)) + " <i class='material-icons' title='Climbing'>trending_up</i> " + alt2txt(L.PolyStats.getStats(segment).climbing) + segDuration);
    itemName.attr("segName", segName);
    itemName.on("click", editSegmentName);

    let colorPicker;
    let segColor;
    if (segment.isHidden) {
      newitem.find(".seg-toggle").on("click", toggleSegmentItem);
      newitem.addClass("item-invisible");
    } else {
      // color
      let segColorValue = getSegmentColor(segment);
      jscolor.installByClassName(`item-color-picker-${i}`);
      let colorPickerButton = newitem.find(`.item-color-picker-${i}`)[0];
      if (!colorPickerButton) {
        onerror("ColorPickerButton missing", {
          "i": i,
          "segItem": segItem,
          "newItem": newitem.html(),
          "jscolor.lookupClass": jscolor.lookupClass
        });
      } else {
        colorPicker = newitem.find(`.item-color-picker-${i}`)[0].jscolor;
        segColor = newitem.find(`#segment-color-${i}`);
        colorPicker.fromString(segColorValue);
        segColor.val(segColorValue);
        segColor.on("change", updateSegmentColor);
      }
    }
  }

  function onAllCheckedSegment(opName, minCount, func, noConfirm) {
    let uids = [], names = "";
    $("#segments-list li").each(function () {
      if (WU.isChecked($(this).find(".seg-check"))) {
        let uid = $(this).attr("uid");
        uids.push(uid);
        names += $(this).find(".item-name").attr("segName") + "\n";
      }
    });
    if ((uids.length >= minCount) && (noConfirm || confirm(opName + " following segments?\n\n" + names))) {
      let count = forEachSegment(func, uids);
      return count;
    }
  }

  function joinCheckedSegments() {
    setEditMode(EDIT_NONE);
    let seg1;
    let count = onAllCheckedSegment("Join", 2, function (segment) {
      if (!seg1) {
        seg1 = segment;
      } else {
        seg1.setLatLngs(seg1.getLatLngs().concat(segment.getLatLngs()));
        segment.remove();
        segment.removeFrom(editLayer);
      }
    });
    if (count > 1) {
      track = null;
      segmentClickListener({ target: seg1 }, true);
      saveState();
      polystats.updateStatsFrom(0);
      setStatus("Joined " + count + " segments", { timeout: 3 });
      ga('send', 'event', 'tool', 'join', undefined, count);
    } else {
      setStatus("No segments to join", { timeout: 3 });
    }
    openSegmentsEditor();
  }

  function deleteCheckedSegments() {
    let count = onAllCheckedSegment("Delete", 1, function (segment) {
      deleteSegment(segment);
    });
    if (count > 0) {
      ga('send', 'event', 'edit', 'delete-segments');
      openSegmentsEditor();
      saveState();
      setStatus("Deleted " + count + " segment" + (count > 1 ? "s" : ""), { timeout: 3 });
    }
  }

  function toggleSegment(segment) {
    let segmentChanged = false;
    segment.isHidden = (segment.isHidden) ? false : true;
    if (((segment.isHidden) && (segment == track)) ||
      ((!segment.isHidden) && ((!track) || track.getLatLngs().length < 1))) {
      segmentChanged = selectFirstSegment();
    }
    if (!segmentChanged) {
      updateOverlayTrackStyle(segment);
    }
  }
  function segmentsToggled(count) {
    ga('send', 'event', 'edit', 'toggle-segments');
    openSegmentsEditor();
    saveState();
    setStatus("Toggled " + count + " segment" + (count > 1 ? "s" : ""), { timeout: 3 });
  }

  function toggleCheckedSegments() {
    let count = onAllCheckedSegment("Toggle", 1, toggleSegment, true);
    if (count > 0) {
      segmentsToggled(count);
    }
  }

  function openSegmentsEditor() {
    function onCheck() {
      WU.enableInput($("#segments-list .seg-check:checked").length > 1, "#join-segs");
      WU.enableInput($("#segments-list .seg-check:checked").length > 0, "#del-segs");
      WU.enableInput($("#segments-list .seg-check:checked").length > 0, "#toggle-segs");
    }
    let segList = $("#segments-list");
    if (segList && segList.sortable) {
      segList.sortable('destroy');
    }
    $("#seg-editor-list").empty();
    $("#seg-editor-list").append("<ul id='segments-list'></ul>");
    segList = $("#segments-list");
    let i = 0;
    let totalPts = 0;
    forEachSegment(function (segment) {
      addEditorSegmentItem(segment, i++);
      const segPts = segment.getLatLngs().length;
      console.debug(`${segment.name}: ${segPts}`);
      totalPts += segPts;
    }, ALL_SEGMENTS);
    console.debug(`TOTAL: ${totalPts}`);
    let hasSegments = (i > 0);
    $(".if-segments").toggle(hasSegments);
    $(".no-segments").toggle(!hasSegments);
    if (i > 1) {
      segList.sortable({
        //scroll: true,
        handle: ".item-drag",
        update: function () {
          // collect segment uids
          let lyUids = {};
          forEachSegment(function (segment) {
            lyUids[L.Util.stamp(segment)] = segment;
          }, ALL_SEGMENTS);
          $("#segments-list li").each(function (idx) {
            let uid = $(this).attr("uid");
            lyUids[uid]._wtOrder = idx;
          });
        }
      });
    }
    $("#seg-editor-list").append("<input type='checkbox' id='seg-check-all'/> <button id='join-segs'>Join</button><button id='del-segs'>Delete</button><button id='toggle-segs'>Toggle</button>");
    $("#join-segs").on("click", joinCheckedSegments);
    $("#del-segs").on("click", deleteCheckedSegments);
    $("#toggle-segs").on("click", toggleCheckedSegments);
    $("#seg-check-all").on("change", () => {
      let checked = WU.isChecked($("#seg-check-all"));
      WU.setChecked($("#seg-editor-list .seg-check"), checked);
      onCheck();
    });
    $(".seg-check").on("change", () => {
      onCheck();
    });
    onCheck();
  }

  //---------------------------------------------------
  // Share

  $("#track-share").on("click", function () {
    closeMenu();
    $("#wtshare-map-name").text(baseLayer);
    $("#wtshare-ask").show();
    $("#wtshare-processing").hide();
    $("#wtshare-done").hide();
    $("#wtshare-val").val("");
    $("#wtshare-box").show();
    $("#wtshare-start").focus();
    if (CRY.isCryptoSupported()) {
      $(".if-encrypt").show();
    }
  });
  function closeShareBox() {
    $("#wtshare-box").hide();
    return false;
  }
  $("#wtshare-box-close").on("click", closeShareBox);
  $("#wtshare-cancel").on("click", closeShareBox);
  $("#wtshare-ok").on("click", closeShareBox);

  function uploadClicked() {
    $("#wtshare-ask").hide();
    $("#wtshare-processing").show();
    let gpx = getTrackGPX(true);
    let params = "";
    if (WU.isChecked("#wtshare-map")) {
      params += "&map=" + encodeURIComponent(baseLayer);
      overlays = [];
      WU.objectForEach(overlaysOn, function (oname, oon) {
        if (oon) overlays.push(oname);
      });
      params += "&overlays=" + encodeURIComponent(overlays.join(','));
    }
    if (WU.isChecked("#wtshare-enc")) {
      const pwd = Math.random().toString(36).substring(2);
      CRY.aesGcmEncrypt(gpx, pwd)
        .then(function (cipher) {
          //console.log("iv  : " + cipher.iv);
          //console.log("pwd : " + pwd);
          const encversion = "01";
          params += "&key=" + encversion + WU.strencode(cipher.iv + pwd);
          gpx = cipher.ciphertext;
          ga('send', 'event', 'file', 'encrypt', undefined, Math.round(gpx.length / 1000));
          shareGpx(gpx, params, "cipher-yes");
        })
        .catch(function (err) {
          onerror('Crypto-encrypt :' + err);
          setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
          $("#wtshare-box").hide();
        });
    } else {
      shareGpx(gpx, params, CRY.isCryptoSupported() ? "cipher-no" : "cipher-unavailable");
    }
  }

  function uploadFailed(share, gpx, error) {
    const errmsg = error.statusText || error;
    const gpxkb = Math.round(gpx.length / 1000);
    onerror('Upload failed', {
      "Lib": share.name,
      "Error": errmsg,
      "GPX KB": gpxkb
    });
    alert("Upload failed, is file too big? Your file is " +
      gpxkb + "KB while " + share.name + " accepts " + share.maxSize +
      ". Try to reduce it using Tools/Compress");
    setStatus("Failed: " + errmsg, { timeout: 5, class: "status-error" });
  }

  function shareGpx(gpx, params, cryptoMode) {
    ga('send', 'event', 'file', 'share', share.name + ', ' + cryptoMode, Math.round(gpx.length / 1000));
    share.upload(
      getTrackName(), gpx,
      function (gpxurl, rawgpxurl) {
        let url = window.location.toString();
        url = url.replace(/#+.*$/, ""); // remove fragment
        url = url.replace(/\?.*$/, ""); // remove parameters
        url = url.replace(/index\.html$/, ""); // remove index.html
        url = url.replace(/\/*$/, "/"); // keep 1 and only 1 trailing /
        url = url + "?ext=gpx&noproxy=true&url=" + encodeURIComponent(rawgpxurl) + params;
        $("#wtshare-val").val(url);
        $("#wtshare-open").attr("href", url);
        $("#wtshare-view").attr("href", gpxurl);
        $("#wtshare-processing").hide();
        $("#wtshare-links").show();
        $("#wtshare-qrcode").hide();
        $("#wtshare-qrimg").attr("src", config.qrCodeService + encodeURIComponent(url + "&qr=1"));
        $("#wtshare-done").show();
        $("#wtshare-val").focus();
        $("#wtshare-val").select();
      }, function (error) {
        uploadFailed(share, gpx, error);
        $("#wtshare-box").hide();
      });
  }

  function showQRCode() {
    $("#wtshare-links").hide();
    $("#wtshare-qrcode").show();
    return false;
  }
  function hideQRCode() {
    $("#wtshare-links").show();
    $("#wtshare-qrcode").hide();
    return false;
  }

  $("#wtshare-start").on("click", uploadClicked);
  $("#wtshare-viewqr").on("click", showQRCode);
  $("#wtshare-back").on("click", hideQRCode);

  function closeShareBoxOnEscape(event) {
    if (event.which == 27) {
      closeShareBox();
      event.stopPropagation();
    }
  }
  $("#wtshare-start").on("keyup", closeShareBoxOnEscape);
  $("#wtshare-cancel").on("keyup", closeShareBoxOnEscape);
  $("#wtshare-val").on("keyup", closeShareBoxOnEscape);
  $("#wtshare-ok").on("keyup", closeShareBoxOnEscape);

  var sharename = WU.getVal("wt.share", undefined);
  var share = PasteLibs.get(sharename);

  // fileio automatically deletes paste after download, perfect for dropbox use case
  var dropboxTempShare = PasteLibs.get("dpaste1d");

  //---------------------------------------------------

  function setInactiveSegmentClickable(clickable) {
    forEachSegment(function (segment) {
      if (segment != track) {
        segment.setInteractive(clickable);
      }
    });
  }

  function editableWaypoints(editable) {
    var wpts = waypoints.getLayers();
    for (let i = 0; i < wpts.length; i++) {
      if (editable) {
        wpts[i].enableEdit();
      } else {
        wpts[i].disableEdit();
      }
    }
  }

  function mergeRouteToTrack() {
    routeStart = undefined;
    if (!route) return;
    var initlen = getTrackLength();
    var pts = route._selectedRoute ? route._selectedRoute.coordinates : undefined;
    if (pts && (pts.length > 0)) {
      pts = L.PolyPrune.prune(pts, { tolerance: pruneDist, useAlt: true });
      ga('send', 'event', 'edit', 'merge', undefined, pts.length);
      for (let j = 0; j < pts.length; j++) {
        track.addLatLng(pts[j]);
      }
      updateExtremities();
      elevate("mergeRouteToTrack", pts, false, function () {
        polystats.updateStatsFrom(initlen);
        saveState();
      });
    }
    route.clearAllEventListeners();
    route.remove();
    route._line = undefined;
    route = undefined;
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

  function showRoutingCredit() {
    var credit = (routerFactory == createGraphHopperRouter) ?
      "<a href='https://graphhopper.com'>GraphHopper</a> " :
      "<a href='https://openrouteservice.org'>OpenRoute Service</a>";
    $("#map").append("<span class='routing-credit'>Powered by " + credit + "</span>");
  }

  function hideRoutingCredit() {
    $(".routing-credit").remove();
  }

  function showRoutingError(msg) {
    setStatus(msg, { timeout: 5, class: "status-error" });
  }

  function enterDragMode() {
    setExtremityVisibility(true);
    track.setInteractive(true);
    track.on("dragend", function () {
      wasDragged = true;
      updateExtremities();
    });
    track.dragging.enable();
    wasDragged = false;
    editableWaypoints(true);
  }

  function exitDragMode() {
    editableWaypoints(false);
    // disable dragging path
    track.setInteractive(false);
    track.off("dragend");
    track.dragging.disable();
    if (wasDragged) {
      // Track was moved
      var reelevate = false;
      if (confirm("Track was moved, do you want to recompute elevation?")) {
        reelevate = true;
        // 1. update elevation
        toolElevate(undefined, true); // true to do cleanup
        // 2. update stats
        polystats.updateStatsFrom(0);
      }
      ga('send', 'event', 'edit', 'drag-track', reelevate);
    }
  }

  function setEditMode(mode) {
    closeOverlays();
    if (mode === editMode) {
      if (mode == EDIT_NONE) {
        $("#edit-tools").hide();
      }
      return;
    }
    if (undos.length > 0) {
      endUndo();
    }
    if ((mode != EDIT_NONE) && !map.editTools) {
      onerror('no editTools');
      alert("Your browser does not support GPX editing");
      return;
    }
    // current edit mode
    switch (editMode) {
      case EDIT_RECORDING:
        setLocationMode(LOC_NONE);
        break;
      case EDIT_MANUAL_TRACK:
        if (track) {
          track.disableEdit();
        }
        break;
      case EDIT_AUTO_TRACK:
        hideRoutingCredit();
        mergeRouteToTrack();
        break;
      case EDIT_MARKER:
        editableWaypoints(false);
        break;
      case EDIT_DRAG:
        exitDragMode();
        break;
      default:
    }
    var wasMode = editMode; // debug
    map.editTools.stopDrawing();
    $("#edit-tools a").removeClass("control-selected");
    if (editMode > EDIT_NONE) { // exiting edit mode
      editMode = EDIT_NONE;
      if (track.getLatLngs().length == 0) {
        selectFirstSegment();
      }
      saveState();
      // reset mouse pointer
      $("#map").css("cursor", "");
    }
    setExtremityVisibility(false);
    // new edit mode
    switch (mode) {
      case EDIT_NONE:
        setExtremityVisibility(true);
        setInactiveSegmentClickable(true);
        break;
      case EDIT_RECORDING:
        setInactiveSegmentClickable(false);
        break;
      case EDIT_MANUAL_TRACK:
        $("#" + EDIT_MANUAL_ID).addClass("control-selected");
        try {
          updateMapStyle();
          track.enableEdit();
          track.editor.continueForward();
          setInactiveSegmentClickable(false);
          if (fwdGuideGa) {
            ga('send', 'event', 'setting', 'fwdGuide', undefined, fwdGuide ? 1 : 0);
            fwdGuideGa = false;
          }
        } catch (err) {
          onerror("Cannot edit", {
            "err": err.toString(),
            "points": track.getLatLngs().length,
            "wasMode": wasMode,
            "stack": err.stack
          });
          mode = EDIT_NONE;
        }
        break;
      case EDIT_AUTO_TRACK:
        $("#" + EDIT_AUTO_ID).addClass("control-selected");
        showRoutingCredit();
        restartRoute();
        setInactiveSegmentClickable(false);
        break;
      case EDIT_DRAG:
        $("#" + EDIT_DRAG_ID).addClass("control-selected");
        enterDragMode();
        break;
      case EDIT_MARKER:
        setExtremityVisibility(true);
        $("#" + EDIT_MARKER_ID).addClass("control-selected");
        $("#map").css("cursor", "url(img/marker-icon.cur),text");
        $("#map").css("cursor", "url(img/marker-icon.png) 7 25,text");
        editableWaypoints(true);
        setInactiveSegmentClickable(false);
        break;
      default:
        console.error("invalid edit mode: " + mode);
        return;
    }
    editMode = mode;
    saveEditMode();
    $("#edit-tools").toggle(editMode > EDIT_RECORDING);
  }
  $("#prune-dist-opt, #prune-time-opt").on("change", (event) => {
    if (!WU.isChecked($(event.target))) {
      $(event.target.nextSibling).removeClass("invalid");
    }
  });
  $("#compress").on("click", function () {

    function getKeepOpt(selOpt, valOpt) {
      let value;
      if (WU.isChecked(selOpt)) {
        value = WU.getRealInput($(valOpt), true);
        if (!value) throw "missing value";
      }
      return value;
    }

    // get & check input value
    let tmp = WU.getRealInput($("#prune-dist"), true);
    if (!tmp) return;
    pruneDist = tmp;

    pruneMaxDist;
    pruneMaxTime;
    try {
      pruneMaxDist = getKeepOpt("#prune-dist-opt", "#prune-max-dist");
      pruneMaxTime = getKeepOpt("#prune-time-opt", "#prune-max-time");
    } catch {
      return;
    }

    if (isImperial()) {
      pruneDist *= 0.9144;
      if (pruneMaxDist) {
        pruneMaxDist *= 0.9144;
      }
    }

    WC.saveValOpt("wt.pruneDist", pruneDist);
    WC.saveValOpt("wt.pruneMaxDist", pruneMaxDist);
    WC.saveValOpt("wt.pruneMaxTime", pruneMaxTime);

    if (track) {

      var removedpts = 0;
      var totalpts = 0;

      applySegmentTool(function (segment) {
        var pts = segment.getLatLngs();
        var compressOptions = {
          tolerance: pruneDist,
          useAlt: true,
          maxDist: pruneMaxDist,
          maxTimeSec: pruneMaxTime,
        };
        var pruned = L.PolyPrune.prune(pts, compressOptions);
        totalpts += pts.length;
        var reduced = pts.length - pruned.length;
        if (reduced > 0) {
          // switch to new values
          removedpts += reduced;
          segment.setLatLngs(pruned);
          if (segment == track) {
            polystats.updateStatsFrom(0);
            prepareTrim();
          } else {
            updateSegmentStats(segment);
          }
        }
      });

      if (removedpts > 0) {
        ga('send', 'event', 'tool', 'compress', undefined, removedpts);
        alert("Removed " + removedpts + " points out of " + totalpts + " (" + Math.round((removedpts / totalpts) * 100) + "%)");
        saveState();
      } else {
        setStatus("Already optimized", { timeout: 3 });
      }

    }
  });
  function checkPruneKeepOpts() {
    WU.enableInput(WU.isChecked("#prune-time-opt"), "#prune-max-time");
    WU.enableInput(WU.isChecked("#prune-dist-opt"), "#prune-max-dist");
  }
  $("#prune-time-opt, #prune-dist-opt").on("change", checkPruneKeepOpts);

  $("#smooth").on("click", function () {

    smoothLevel = $("#smooth-level").val();
    WC.saveValOpt("wt.smoothLevel", smoothLevel);

    if (track) {
      applySegmentTool(function (segment) {
        let pts = segment.getLatLngs();
        for (let round = 0; round < smoothLevel; round++) {
          let i = 1;
          while (i + 1 < pts.length) {
            const prevPt = pts[i - 1];
            const pt = pts[i];
            const nextPt = pts[i + 1];
            if (!WU.isUndefined(prevPt.alt) && !WU.isUndefined(pt.alt) && !WU.isUndefined(nextPt.alt)) {
              const distToPrev = pt.distanceTo(prevPt);
              const distPrevNext = pt.distanceTo(nextPt) + distToPrev;
              const linearAlt = prevPt.alt + ((nextPt.alt - prevPt.alt) * (distToPrev / distPrevNext));
              pt.alt = WU.roundDecimal((pt.alt + linearAlt) / 2, 2);
            }
            i++;
          }
        }
        if (segment == track) {
          polystats.updateStatsFrom(0);
        } else {
          updateSegmentStats(segment);
        }
      });
    }
  });

  let joinOnLoad = false; // deactivate while we restore saved GPX

  // geolocation

  function getMyIpLocation() {
    console.log("Getting location from IP address");
    $.get(config.ipLookup.url())
      .done(function (res) {
        setLocation({
          lat: res.lat,
          lng: res.lon
        }, false);
      })
      .fail(function () {
        showWarning("IP Geolocation failed", "Do you you have an ad blocker?<br>Try deactivating it on this page to get geolocation working.");
      });
  }

  const myLocIcon = L.icon({
    iconUrl: 'img/mylocation.png',
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
  let myLocMarker;
  let myLocTimer;

  const
    LOC_NONE = 0,
    LOC_ONCE = 1,
    LOC_CONTINUOUS = 2,
    LOC_READY_TO_RECORD = 3,
    LOC_RECORDING = 4;
  let showLocation = LOC_ONCE, loc_recording_id;

  function setLocationMode(mode) {
    if (showLocation == mode) return;
    let watch;
    switch (mode) {
      case LOC_NONE:
        $("#myloc").text("my_location");
        $("#myloc").removeClass("loc-ready-to-record");
        $("#myloc").removeClass("loc-recording");
        $("#myloc").removeClass("control-selected");
        if ((showLocation == LOC_RECORDING) && (track.getLatLngs().length > 0)) {
          navigator.geolocation.clearWatch(loc_recording_id);
          // compress recording
          let pts = L.PolyPrune.prune(track.getLatLngs(), { tolerance: pruneDist, useAlt: true });
          // discard single points
          track.setLatLngs(pts.length > 1 ? pts : []);
          updateExtremities();
          removeMyLocMarker(true);
          track.redraw();
        }
        break;
      case LOC_CONTINUOUS:
        $("#myloc").addClass("control-selected");
        watch = true;
        break;
      case LOC_READY_TO_RECORD:
        $("#myloc").text("fiber_manual_record");
        $("#myloc").addClass("loc-ready-to-record");
        break;
      case LOC_RECORDING:
        $("#myloc").text("stop");
        $("#myloc").removeClass("loc-ready-to-record");
        $("#myloc").addClass("loc-recording");
        watch = true;
        break;
      default:
    }
    if (watch) {
      loc_recording_id = navigator.geolocation.watchPosition(
        gotLocation,
        (err) => { // ERROR
          console.error(`GPS watch failed (${err.message})`);
          showWarning("GPS error", "Could not get current position", 4000);
          setEditMode(EDIT_NONE);
          setLocationMode(LOC_NONE);
        },
        { // OPTIONS
          enableHighAccuracy: true,
          timeout: 999999,
          maximumAge: 10000,
        }
      );

    }
    showLocation = mode;
  }

  function removeMyLocMarker(force) {
    if (force || ((showLocation != LOC_CONTINUOUS) && (showLocation != LOC_RECORDING))) {
      force || setLocationMode(LOC_NONE);
      if (myLocMarker) {
        myLocMarker.remove();
        myLocMarker = undefined;
      }
    }
  }

  function setLocation(pos, showIcon) {
    if (showLocation == LOC_NONE) return; // cancelled in the meantime
    const zoom = map.getZoom() ? map.getZoom() : config.display.zoom;
    map.setView(pos, zoom);
    if (myLocMarker) {
      clearTimeout(myLocTimer);
      myLocMarker.remove();
    }
    if (showIcon) {
      myLocMarker = new L.marker([pos.lat, pos.lng], { icon: myLocIcon, clickable: false });
      myLocMarker.addTo(map);
      myLocTimer = setTimeout(removeMyLocMarker, 5000);
    } else {
      setLocationMode(LOC_NONE);
    }
  }

  let isHighAccuracy;
  function gotLocation(position) {
    let newPt = new L.LatLng(
      position.coords.latitude,
      position.coords.longitude
    );
    console.debug(newPt);
    if ((showLocation == LOC_ONCE) && isHighAccuracy) {
      setLocationMode(LOC_READY_TO_RECORD);
    } else if (showLocation == LOC_RECORDING) {
      let lastPt = track.getLatLngs()?.slice(-1)?.at(0);
      if (!lastPt || lastPt.distanceTo(newPt) > (pruneDist / 2)) {
        //showWarning("Added", lastPt && lastPt.distanceTo(newPt), 2000);
        track.addLatLng(newPt);
      }
    }
    setLocation(newPt, true);
  }

  function gotoMyLocation() {

    isHighAccuracy = false;

    function highAccuracyFailed(err) {
      isHighAccuracy = false;
      console.log(`GPS location failed, trying low accuracy (${err.message})`);
      navigator.geolocation.getCurrentPosition(
        gotLocation, lowAccuracyFailed, { maximumAge: 60000, timeout: 5000, enableHighAccuracy: false });
    }

    function lowAccuracyFailed(err) {
      console.log(`low accuracy geolococation failed (${err.message})`);
      getMyIpLocation();
    }

    if (navigator.geolocation) {
      isHighAccuracy = true;
      navigator.geolocation.getCurrentPosition(
        gotLocation, highAccuracyFailed, { maximumAge: 0, timeout: 5000, enableHighAccuracy: true });
    } else {
      console.log("no runtime geolococation available");
      getMyIpLocation();
    }
  }

  function getSavedPosition(_lat, _lng) {
    const vlat = WU.getVal("wt.poslat", _lat);
    const vlng = WU.getVal("wt.poslng", _lng);
    const pos = {
      lat: parseFloat(vlat),
      lng: parseFloat(vlng)
    };
    // ask for position on first use
    if (vlat == _lat && vlng == _lng) {
      setTimeout(function () {
        setLocationMode(LOC_ONCE);
        gotoMyLocation();
      }, 1000);
    }
    return pos;
  }

  function savePosition() {
    const pos = map.getCenter();
    WC.saveValOpt("wt.poslat", pos.lat);
    WC.saveValOpt("wt.poslng", pos.lng);
  }

  function saveEditMode() {
    if (editMode >= 0) WC.saveValOpt("wt.editMode", editMode);
  }

  function saveTrack() {
    var trackname = getTrackName();
    // Count points to save
    // 1. waypoints
    var numPts = waypoints && !waypoints.isHidden ? waypoints.getLayers().length : 0;
    // 2. All segment points
    forEachSegment(function (segment) {
      numPts += segment.getLatLngs().length;
    });
    // Don't save if more than 3000 points
    if (numPts < 3000) {
      const gpx = getGPX(trackname, /*savealt*/ false, /*asroute*/ false, /*nometadata*/ false);
      WC.saveValOpt("wt.gpx", gpx);
    }
  }

  function saveSettings() {
    WC.saveValOpt("wt.activity", getCurrentActivityName());
    WC.saveJsonValOpt("wt.activities", activities);
    WC.saveValOpt("wt.baseLayer", baseLayer);
    WU.objectForEach(apikeys, function name(kname, kval) {
      WC.saveValOpt("wt." + kname, kval);
    });
    WC.saveValOpt("wt.joinOnLoad", joinOnLoad);
    WC.saveJsonValOpt("wt.mymaps", WC.mymaps);
    WC.saveJsonValOpt("wt.overlaysOn", overlaysOn);
    WC.saveValOpt("wt.ovlTrackColor", ovlTrackColor);
    WC.saveValOpt("wt.ovlTrackWeight", ovlTrackWeight);
    WC.saveValOpt("wt.lengthUnit", lengthUnit);
    WC.saveValOpt("wt.useServiceWorker", WC.getUseServiceWorker());
    WC.saveValOpt("wt.trackColor", trackColor);
    WC.saveValOpt("wt.trackWeight", trackWeight);
    WC.saveValOpt("wt.pruneDist", pruneDist);
    WC.saveValOpt("wt.pruneMaxDist", pruneMaxDist);
    WC.saveValOpt("wt.pruneMaxTime", pruneMaxTime);
    WC.saveValOpt("wt.smoothLevel", smoothLevel);
    WC.saveJsonValOpt("wt.mapslist", WC.mapsList);
    WC.saveValOpt("wt.mapsCloseOnClick", mapsCloseOnClick);
    WC.saveValOpt("wt.apikeyNoMore", apikeyNoMore);
    WC.saveValOpt("wt.fwdGuide", fwdGuide);
    WC.saveValOpt("wt.hideWpt", hideWpt);
    WC.saveValOpt("wt.wptLabel", wptLabel);
    WC.saveValOpt("wt.extMarkers", extMarkers);
    WC.saveValOpt("wt.autoGrayBaseLayer", autoGrayBaseLayer);
    WC.saveValOpt("wt.coordDecimals", coordDecimals);
    WC.saveValOpt("wt.coordRounding", coordRounding);
  }

  function saveStateFile() {
    var fullState = {};
    WU.storedValuesForEach((key) => {
      // include all "wt." storage items
      // but exclude current edited track
      if (key.startsWith("wt.") && (key != "wt.gpx")) {
        fullState[key] = WU.getVal(key);
      }
    });
    const blob = new Blob([JSON.stringify(fullState)],
      WU.isSafari() ? { type: "text/plain;charset=utf-8" } : { type: "application/json;charset=utf-8" }
    );
    saveAs(blob, "wtracks.cfg");
    ga('send', 'event', 'setting', 'export');
  }

  function loadStateFile(filedata) {
    var state;
    try {
      state = JSON.parse(filedata);
    } catch (err) {
      setStatus("Invalid file: " + err, { timeout: 5, class: "status-error" });
    }
    WU.objectForEach(state, function (name, value) {
      if (name.startsWith("wt.")) {
        WC.saveValOpt(name, value);
      }
    });
    $(window).off("unload");
    ga('send', 'event', 'setting', 'import');
    location.reload();
  }

  function onStateFileSelect(evt) {
    var f = evt.currentTarget.files ? evt.currentTarget.files[0] : undefined;
    if (f) {
      var reader = new FileReader();
      reader.onload = function (le) {
        loadStateFile(le.target.result);
      };
      reader.readAsText(f);
    }
    evt.preventDefault();
  }
  $('#save-state-file').on('click', saveStateFile);
  $('#load-state-file').on('change', onStateFileSelect);
  $('#load-state-file').on('click', function (e) {
    if (!confirm(
      "This will override all your settings (maps, activities, etc.)\nContinue?"
    )) {
      e.preventDefault();
    }
  });

  function saveState() {
    if (WC.isStateSaved()) {
      saveTrack();
      savePosition();
      saveEditMode();
    }
  }

  function restoreEditMode() {
    const restoredMode = WU.getVal("wt.editMode", EDIT_DEFAULT);
    setEditMode(parseInt(restoredMode));
  }

  function restorePosition() {
    const defpos = getSavedPosition(config.display.pos.lat, config.display.pos.lng);
    setLocationMode(LOC_ONCE);
    setLocation(defpos);
  }

  function restoreTrack() {
    var gpx = WU.getVal("wt.gpx", null);
    if (gpx) {
      loadCount = 0;
      fileloader.loadData(gpx, "dummy", "gpx");
      return true;
    } else {
      return false;
    }
  }

  function restoreState() {
    restoreTrack();
    restoreEditMode();
  }

  function clearSavedState() {
    WU.storedValuesForEach((key) => {
      if (key.startsWith("wt.") && (key !== "wt.saveState")) {
        WU.storeVal(key, undefined);
      }
    });
  }

  function getProvider(mapobj) {
    let url = typeof mapobj.url === "string" ? mapobj.url : mapobj.url();
    let p = null;
    var protocol = url.split('/')[0];
    // skip HTTP URLs when current is HTTPS
    if ((protocol.length == 0) || (protocol == "https:") || (location.protocol == "http:")) {
      var tileCtor;
      var mapopts = mapobj.options;
      // Auto-scale tiles a bit (-1/+2 beyond min/max) when possible
      if (mapopts.minZoom && !mapopts.minNativeZoom) {
        mapopts.minNativeZoom = mapopts.minZoom;
        mapopts.minZoom = Math.max(mapopts.minZoom - 1, 0); // no below 0
      }
      if (mapopts.maxZoom && !mapopts.maxNativeZoom) {
        mapopts.maxNativeZoom = mapopts.maxZoom;
        mapopts.maxZoom = Math.min(mapopts.maxZoom + 2, 28); // not above 28
      }
      if (WU.isUnset(mapobj.type) || (mapobj.type === "base") || (mapobj.type === "overlay")) {
        tileCtor = L.tileLayer;
      } else if (mapobj.type === "pmtiles") {
        const pmTileCtor = new PMTiles(url, { allow_200: true });
        p = pmTileCtor.leafletLayer(mapopts);
      } else {
        tileCtor = L.tileLayer[mapobj.type];
        if (mapobj.type === "wms" && mapopts.crs) {
          // warning: no deep copy
          mapopts = WU.jsonClone(mapopts);
          mapopts.crs = WC.getCrsFromName(mapopts.crs);
        }
        /*
          If the URL contains a "version" query parameter,
          set it in mapopts and remove it from the URL
        */
        const urlObject = new URL(url, location.toString()); // url may be schemeless
        const urlQuery = new URLSearchParams(urlObject.search);
        const version = urlQuery.get("VERSION") || urlQuery.get("version");
        if (version) {
          mapopts.version = version;
          urlQuery.delete("VERSION");
          urlQuery.delete("version");
          urlObject.search = urlQuery.toString();
          url = urlObject.toString();
        }
        /* done */
      }
      if (tileCtor) {
        p = tileCtor(url, mapopts);
      }
    }
    return p;
  }

  // Add maps and overlays
  let baseLayers = {};
  let overlays = {};
  let baseLayer = WU.getVal("wt.baseLayer", config.display.map);
  const requestedMap = WU.getParameterByName("map");
  let requestedOverlays = WU.getParameterByName("overlays");
  requestedOverlays = requestedOverlays ? requestedOverlays.split(',') : undefined;
  WC.mapsForEach(function (name, props) {
    if (props.on || name == baseLayer || name === requestedMap || (requestedOverlays && requestedOverlays.includes(name))) {
      const inList = props.in == WC.MAP_MY ? WC.mymaps : config.maps;
      // WTracks legacy bug: make sure zoom values are numbers (fixes #42 & #43)
      inList[name].options.minZoom = Number(inList[name].options.minZoom) || undefined;
      inList[name].options.maxZoom = Number(inList[name].options.maxZoom) || undefined;
      const tile = getProvider(inList[name]);
      if (tile) {

        // TODO: "overlay" type is a deprecated legacy, should be discarded in Dec 2022
        if ((inList[name].type === "overlay") || (inList[name].overlay)) {
          tile.options.isOverlay = true; // to easily find overlays in map layers
          if (!noMixOverlays) {
            tile.options.className = "blend-multiply";
          }
          overlays[name] = tile;
        } else {
          baseLayers[name] = tile;
        }
      }
    }
  });

  const baseLayerControl = L.control.layers(baseLayers, overlays);
  baseLayerControl.addTo(map);

  // ----------------------

  // set baseLayer to default if previous is missing
  if (!baseLayers[baseLayer]) {
    (baseLayer = config.display.map);
  }
  let initialLayer = baseLayers[baseLayer];
  if (!initialLayer) {
    //var availableLayerNames = "";
    WU.objectForEach(baseLayers, function (name) {
      //availableLayerNames += name + "; ";
      if (!initialLayer) {
        initialLayer = baseLayers[name]; // use first one
        baseLayer = name;
        return true;
      }
    });
    /* this is not an error: selected and default map have been hidden/deleted
    onerror("no initial layer", {
      "stored": baseLayer,
      "config": config.display.map,
      "available": availableLayerNames
    });
    */
  }
  if (initialLayer) {
    map.addLayer(initialLayer);
  }
  let layerInit = true;

  map.on("baselayerchange", function (e) {
    baseLayer = e.name;
    if (layerInit) {
      // deffer to make sure GA is initialized
      setTimeout(function () {
        ga('send', 'event', 'map', 'init', baseLayer);
      }, 2000);
      layerInit = false;
    } else {
      ga('send', 'event', 'map', 'change', baseLayer);
    }
    WC.saveValOpt("wt.baseLayer", baseLayer);
    if (mapsCloseOnClick) {
      $(".leaflet-control-layers").removeClass("leaflet-control-layers-expanded");
    }
    setAutoGrayBaseLayer(e.layer);
  });
  map.on('zoomstart zoom zoomend', function () {
    console.debug('Zoom level: ' + map.getZoom());
  });

  function changeBaseLayer(mapname) {
    let found = false;
    $(".leaflet-control-layers-base .leaflet-control-layers-selector").each(function (idx, elt) {
      if (mapname === elt.nextSibling.innerText.substring(1)) {
        $(elt).trigger("click");
        found = true;
        return false; // stop each loop
      }
    });
    if (!found) {
      // map is missing, inform user
      setTimeout(function () {
        setStatus("Requested map not visible/configured: " + mapname, { timeout: 5, class: "status-error" });
      }, 4000);
    }
  }

  let overlaysOn = WU.getJsonVal("wt.overlaysOn", {});

  function setOverlay(name, yesno) {
    overlaysOn[name] = yesno;
    WC.saveJsonValOpt("wt.overlaysOn", overlaysOn);
    setAutoGrayBaseLayer(null);
  }

  /********* Overlay opacity control *************/
  function addOpacityControl(ovlname, ovl) {
    const layerId = L.Util.stamp(ovl);
    const initialOpacity = WU.isUndefined(ovl.options.opacity) ? 1 : ovl.options.opacity * 1;
    const ovlItem = $(".leaflet-control-layers-overlays span span").filter(function () { return $(this).text().trim() == ovlname; });
    // add slider
    var slider = $('<input class="overlay-opacity-slider" title="Opacity" type="range" min="0" max="100" value="' +
      initialOpacity * 100 + '"></input>')
      .insertAfter(ovlItem);
    slider.on("change", function (evt) {
      // search layer
      WU.objectForEach(map._layers, function (lId, layer) {
        if (layer && L.Util.stamp(layer) === layerId) {
          // set opacity
          layer.setOpacity(Number(evt.target.value / 100));
          return true;
        }
      });
    });
  }
  function removeOpacityControl(ovlname) {
    // remove slider
    $(".leaflet-control-layers-overlays span:contains('" + ovlname + "')")
      .parent()
      .find(".overlay-opacity-slider")
      .remove();
  }

  if (requestedOverlays) {
    requestedOverlays.forEach(function (oname) {
      var ovl = overlays[oname];
      if (ovl) {
        map.addLayer(ovl);
      }
    });
  } else {
    WU.objectForEach(overlaysOn, function (oname, oon) {
      var ovl = overlays[oname];
      if (ovl) {
        if (oon) {
          map.addLayer(ovl);
        }
      } else {
        // doesn't exist anymore, delete it
        setOverlay(oname, undefined);
      }
    });
  }

  map.on("overlayadd", function (e) {
    ga('send', 'event', 'map', 'overlay', e.name);
    setOverlay(e.name, true, true);
    setTimeout(function () {
      addOpacityControl(e.name, overlays[e.name]);
    }, 100);
  });

  map.on("overlayremove", function (e) {
    setOverlay(e.name, false);
    removeOpacityControl(e.name);
  });

  $("#autoGrayBaseLayer").on("change", function () {
    autoGrayBaseLayer = !autoGrayBaseLayer;
    WC.saveValOpt("wt.autoGrayBaseLayer", autoGrayBaseLayer);
    setAutoGrayBaseLayer(null);
  });
  $("#noMixOverlays").on("change", function () {
    noMixOverlays = WU.isChecked("#noMixOverlays");
    WC.saveValOpt("wt.noMixOverlays", noMixOverlays);
    // update all overlays
    WU.objectForEach(map._layers, function (id, layer) {
      if (layer.options.isOverlay) {
        let op;
        if (noMixOverlays) {
          layer.options.className = undefined;
          op = "remove";
        } else {
          layer.options.className = "blend-multiply";
          op = "add";
        }
        const container = layer.getContainer && layer.getContainer();
        if (container) {
          container.classList[op]('blend-multiply');
        }
      }
    });
  });

  function hasOverlaysOn() {
    return Object.values(overlaysOn).some(function (oon) { return oon; });
  }
  function setAutoGrayBaseLayer(layer) {
    if (!layer) {
      const layerId = L.Util.stamp(baseLayers[baseLayer]);
      layer = map._layers[layerId];
    }
    const container = layer && layer.getContainer && layer.getContainer();
    if (container) {
      if (autoGrayBaseLayer && hasOverlaysOn()) {
        container.classList.add('filter-grayscale');
      } else {
        container.classList.remove('filter-grayscale');
      }
    }
  }

  setLocation({ lat: 0, lng: 0 }); // required to initialize map

  // ---------------------------------------------------------------------------
  // Elevation service

  // Delete existing elevation data before applying elevation result
  function elevationCleanup(points) {
    if (points && (points.length > 0)) {
      for (let i = 0; i < points.length; i++) {
        points[i].alt = undefined;
      }
    }
  }

  // Google elevation API
  function googleElevationService(locations, points, inc, cleanup, done, fail) {
    let elevator;
    try {
      elevator = new google.maps.ElevationService();
      elevator.getElevationForLocations({
        'locations': locations
      }).then(({ results }) => {
        if (WU.isUndefined(points.length)) {
          // single point elevation
          points.alt = WU.roundDecimal(results[0].elevation, 2);
        } else {
          if (cleanup) {
            elevationCleanup(points);
          }
          for (let i = 0; i < results.length; i++) {
            let pos = i * inc;
            if (pos >= points.length) {
              // we reached last point from track
              pos = points.length - 1;
            }
            points[pos].alt = WU.roundDecimal(results[i].elevation, 2);
          }
        }
        done("gg.elevate.ok");
      }).catch((err) => {
        fail('gg.elevate.ko', err);
      });
    } catch {
      // Google elevation service not available, cancel
      fail('gg.elevate.ko', "Invalid Google API key?");
      return;
    }
  }

  // https://github.com/Jorl17/open-elevation
  // eslint-disable-next-line no-unused-vars
  function openElevationService(locations, points, inc, cleanup, done, fail) {
    let ajaxreq, i, len;
    // GET is faster for small number of points (avoid OPTIONS preflight request)
    if (locations.length < 20) {
      // GET method
      let strpts = "";
      for (i = 0, len = locations.length; i < len; i++) {
        if (i > 0) strpts += "|";
        strpts += locations[i].lat + "," + locations[i].lng;
      }
      ajaxreq = {
        url: "https://api.open-elevation.com/api/v1/lookup?locations=" + strpts,
        method: "GET",
        timeout: config.elevationTimeout,
      };
    } else {
      // POST method
      const jsonreq = { locations: [] };
      for (i = 0, len = locations.length; i < len; i++) {
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
        timeout: config.elevationTimeout,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(jsonreq)
      };
    }
    $.ajax(ajaxreq)
      .done(function (json) {
        if (WU.isUndefined(points.length)) {
          // single point elevation
          points.alt = WU.roundDecimal(json.results[0].elevation, 2);
        } else {
          if (cleanup) {
            elevationCleanup(points);
          }
          for (let i = 0; i < json.results.length; i++) {
            let pos = i * inc;
            if (pos >= points.length) {
              // we reached last point from track
              pos = points.length - 1;
            }
            points[pos].alt = WU.roundDecimal(json.results[i].elevation, 2);
          }
        }
        done("oe.elevate.ok");
      })
      .fail(function (err, msg) {
        fail('oe.elevate.ko', msg ? msg : err.status);
      });
  }


  // https://openrouteservice.org/dev/#/api-docs/elevation/line/post
  function orsElevationService(locations, points, inc, cleanup, done, fail) {
    let i, len,
      polyline = [];

    if (locations.length == 1) {
      // single point
      $.ajax({
        url: "https://api.openrouteservice.org/elevation/point",
        headers: {
          "Authorization": getApiKey(apikeys.orskey)
        },
        method: "POST",
        timeout: config.elevationTimeout,
        contentType: "application/json",
        data: JSON.stringify({
          "format_in": "point",
          "geometry": [locations[0].lng, locations[0].lat]
        }),
        dataType: "json"
      })
        /*
        $.get({
          url: "https://api.openrouteservice.org/elevation/point?" +
            "api_key=" + getApiKey(apikeys.orskey) +
            "&geometry=" + locations[0].lng + "," + locations[0].lat,
          dataType: "json"
        })
        */
        .done(function (json) {
          if (json.geometry && json.geometry.coordinates && json.geometry.coordinates[0]) {
            points.alt = WU.roundDecimal(json.geometry.coordinates[2], 2);
            done('ors.elevate1.ok');
          } else {
            // "Server error"
            fail('ors.elevate1.ko', (json.message ? json.message + ". " : "") + "Area not covered?");
          }
        })
        .fail(function (err) {
          var errmsg = "";
          if (err.responseJSON && err.responseJSON.message) {
            errmsg = err.responseJSON.message;
          } else {
            if (err.error) {
              errmsg = err.error + ". ";
            } else {
              errmsg = "Request failed. ";
            }
            errmsg += "Check API key";
          }
          fail('ors.elevate1.ko', errmsg);
        });
      return;
    }
    // multi-points
    for (i = 0, len = locations.length; i < len; i++) {
      polyline.push([locations[i].lng, locations[i].lat]);
    }
    $.ajax({
      url: "https://api.openrouteservice.org/elevation/line",
      headers: {
        "Authorization": getApiKey(apikeys.orskey)
      },
      method: "POST",
      timeout: config.elevationTimeout,
      contentType: "application/json",
      data: JSON.stringify({
        "format_in": "polyline",
        "format_out": "polyline",
        "geometry": polyline
      }),
      dataType: "json"
    })
      .done(function (json) {
        if (json.geometry && json.geometry[0]) {
          if (cleanup) {
            elevationCleanup(points);
          }
          var results = json.geometry;
          for (let i = 0; i < results.length; i++) {
            let pos = i * inc;
            if (pos >= points.length) {
              // we reached last point from track
              pos = points.length - 1;
            }
            points[pos].alt = WU.roundDecimal(results[i][2], 2);
          }
          done("ors.elevate.ok");
        } else {
          // "Server error"
          fail('ors.elevate.ko', (json.message ? json.message + ". " : "") + "Area not covered?");
        }
      })
      .fail(function (err) {
        var errmsg;
        if (err.responseJSON && err.responseJSON.message) {
          errmsg = err.responseJSON.message;
        } else {
          errmsg = "Request failed. Check API key";
        }
        fail('ors.elevate.ko', errmsg);
      });
  }

  // multi-point elevation API
  function elevatePoints(callerName, points, cleanup, cb) {
    if (!elevationService) {
      // no elevation service configured, go directly to callback
      if (cb) cb(true);
      return;
    }
    if (!points || (points.length === 0)) {
      return;
    }
    var locations;
    let inc;
    if (WU.isUndefined(points.length)) {
      locations = [points];
    } else {
      setStatus("Elevating..", { spinner: true });
      inc = Math.ceil(Math.max(1, points.length / 511)); // keep one for last point
      if (inc == 1) {
        locations = points;
      } else {
        locations = [];
        let i = 0;
        while (i < points.length) {
          locations.push(points[i]);
          i += inc;
        }
        // make sure last point is included
        if ((i < points.length) || (i - inc < (points.length - 1))) {
          locations.push(points[points.length - 1]);
        }
      }
    }
    callElevationService(callerName, locations, points, inc, cleanup, cb);
  }

  function callElevationService(callerName, locations, points, inc, cleanup, cb) {
    elevationService(locations, points, inc, cleanup,
      function (eventName) {
        ga('send', 'event', 'api', eventName, callerName, locations.length);
        clearStatus();
        // callback
        if (cb) cb(true);
      },
      function (eventName, msg) {
        ga('send', 'event', 'api', eventName,
          JSON.stringify({ "op": callerName, "msg": msg }), locations.length);
        console.warn("elevation request failed: " + msg);
        setStatus("Elevation failed (" + msg + ")", {
          timeout: 3,
          class: "status-error"
        });
        // callback
        if (cb) cb(false);
      });
  }

  // Select elevation service
  var elevate = elevatePoints;
  var elevatePoint = elevatePoints;

  // ---------------------------------------------------------------------------

  function createOrsRouter() {
    var router = L.Routing.openrouteservice(getApiKey(apikeys.orskey), {
      profile: currentActivity.vehicle == "foot" ? "foot-hiking" : "cycling-regular",
      parameters: {
        instructions: false,
        elevation: false,
      }
    });
    //router.on("response", checkOrsRoutingRes);
    return router;
  }

  function createGraphHopperRouter() {
    var router = L.Routing.graphHopper(
      getApiKey(apikeys.ghkey, config.graphhopper.key()),
      { urlParameters: { vehicle: currentActivity.vehicle } }
    );
    router.on("response", checkGraphHopperRes);
    return router;
  }

  // ---------------------------------------------------------------------------

  new L.Control.GeoSearch({
    provider: new L.GeoSearch.Provider.OpenStreetMap(),
    position: 'topleft',
    searchLabel: "Enter place name (f)",
    showMarker: false,
    showPopup: true,
    //customIcon: false,
    customIcon: L.divIcon({ html: '<span class="material-icons notranslate">search</span>' }),
    retainZoomLevel: true,
    draggable: false
  }).addTo(map);

  L.MyLocationControl = L.Control.extend({

    options: {
      position: 'topleft',
    },

    onAdd: function (map) {
      var container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-edit'),
        link = L.DomUtil.create('a', '', container);

      link.href = '#';
      link.title = 'My location (l)';
      link.innerHTML = '<span id="myloc" class="material-icons wtracks-control-icon notranslate">my_location</span>';
      //link.id = 'myloc';
      L.DomEvent.disableClickPropagation(link);
      L.DomEvent.on(link, 'click', L.DomEvent.stop)
        .on(link, 'click', function () {
          map.closePopup();
          if (showLocation == LOC_CONTINUOUS) {
            setLocationMode(LOC_NONE);
            removeMyLocMarker();
          } else if (showLocation == LOC_ONCE) {
            setLocationMode(LOC_CONTINUOUS);
          } else if (showLocation == LOC_READY_TO_RECORD) {
            setLocationMode(LOC_RECORDING);
            setEditMode(EDIT_RECORDING);
            // create new segment
            newSegment();
          } else if (showLocation == LOC_RECORDING) {
            setEditMode(EDIT_NONE);
            setLocationMode(LOC_NONE);
          } else {
            setLocationMode(LOC_ONCE);
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

    onAdd: function (map) {
      const container = L.DomUtil.create('div', 'leaflet-control leaflet-bar leaflet-control-edit'),
        link = L.DomUtil.create('a', '', container),
        editopts = L.DomUtil.create('span', '', container);

      link.href = '#';
      link.title = this.options.title;
      link.innerHTML = this.options.html;
      L.DomEvent.disableClickPropagation(link);
      L.DomEvent.on(link, this.options.event, L.DomEvent.stop)
        .on(link, this.options.event, function () {
          map.closePopup();
          var et = $("#edit-tools");
          et.toggle();
          if (!et.is(":visible")) {
            setEditMode(EDIT_NONE);
          }
        }, this);

      editopts.id = 'edit-tools';
      editopts.class = 'wtracks-control-icon';
      editopts.innerHTML = '<a href="#" title="Manual Track (e)" id="' + EDIT_MANUAL_ID + '"><span class="material-icons wtracks-control-icon notranslate">' + EDIT_MANUAL_ICON + '</span></a>' +
        '<a href="#" title="Auto Track (a)" id="' + EDIT_AUTO_ID + '"><span class="material-icons wtracks-control-icon notranslate">' + EDIT_AUTO_ICON + '</span></a>' +
        '<a href="#" title="Add segment" id="' + EDIT_ADDSEGMENT_ID + '">' +
        '<span class="material-icons wtracks-control-icon segment-icon notranslate">timeline</span>' +
        '<span class="material-icons wtracks-control-icon ' + EDIT_ADDSEGMENT_ICON + ' notranslate">add</span>' +
        '</a>' +
        '<a href="#" title="Delete segment" id="' + EDIT_DELSEGMENT_ID + '">' +
        '<span class="material-icons wtracks-control-icon segment-icon notranslate">timeline</span>' +
        '<span class="material-icons wtracks-control-icon ' + EDIT_DELSEGMENT_ICON + ' notranslate">clear</span>' +
        '</a>' +
        '<a href="#" title="Move track (m)" id="' + EDIT_DRAG_ID + '"><span class="material-icons wtracks-control-icon notranslate">' + EDIT_DRAG_ICON + '</span></a>' +
        '<a href="#" title="Waypoint (w)" id="' + EDIT_MARKER_ID + '"><span class="material-icons wtracks-control-icon notranslate">place</span></a>';

      return container;
    }

  });
  L.EditorControl = L.EditControl.extend({
    options: {
      position: 'topleft',
      title: 'Toggle Edit',
      html: '<span class="material-icons wtracks-control-icon notranslate">edit</span>',
      event: 'click'
    }
  });
  map.addControl(new L.EditorControl());

  function isUserInputOngoing() {
    const elt = document.activeElement;
    const tag = elt ? elt.tagName.toLowerCase() : undefined;
    if ((tag == "input") || (tag == "textarea")) {
      return true;
    }
    return false;
  }

  function openedOverlays() {
    return $(".overlay:visible").length;
  }

  $("body").on("keydown", function (event) {
    //console.debug(`key: which=${event.which}, key=${event.key}, code=${event.code},`)
    // number of currently opened overlays
    let nOverlays = openedOverlays();
    // ignore control keys
    if (event.ctrlKey || event.metaKey) return;
    // on escape
    if ((event.key == "Escape") && (nOverlays == 1)) {
      if (isMenuVisible()) {
        // close menu
        closeMenu();
        // close color pickers
        WU.arrayForEach($('.jscolor-active'), (idx, elt) => {
          elt.jscolor.hide();
        });
        return;
      }
      if ($(".overlay:visible").hasClass("leaflet-popup")) {
        // close popup
        map.closePopup();
        return;
      }
    }
    // ignore if an overlay is open
    if ((nOverlays > 0) || isUserInputOngoing()) return;
    switch (event.key) {
      case "Escape": // escape - exit edit tool
        if (editMode == EDIT_NONE) {
          openMenu();
        } else {
          setEditMode(EDIT_NONE);
        }
        break;
      case "N": // New
        setEditMode(EDIT_NONE);
        if (confirm("Delete track and start new one?")) {
          $("#track-new").click();
        }
        break;
      case "O": // open file
        setEditMode(EDIT_NONE);
        openMenu("file");
        $("#file-load").click();
        $("#track-upload").click();
        break;
      case "S": // save
        setEditMode(EDIT_NONE);
        openMenu("file");
        $("#file-save").click();
        break;
      case "e": // edit
        if (editMode != EDIT_MANUAL_TRACK) {
          $("#" + EDIT_MANUAL_ID).trigger("click");
        }
        break;
      case "a": // auto
        if (editMode != EDIT_AUTO_TRACK) {
          $("#" + EDIT_AUTO_ID).trigger("click");
        }
        break;
      case ".": // new segment
        $("#" + EDIT_ADDSEGMENT_ID).trigger("click");
        break;
      case "x": // delete segment
        $("#" + EDIT_DELSEGMENT_ID).trigger("click");
        break;
      case "w": // waypoint
        $("#" + EDIT_MARKER_ID).trigger("click");
        break;
      case "f": // find address
        $(".glass")[0].click();
        return false;
      case "l": // my location
        showLocation = LOC_ONCE;
        gotoMyLocation();
        break;
      case "m": // move/drag
        $("#" + EDIT_DRAG_ID).trigger("click");
        break;
      case "F2": // rename
        promptTrackName();
        break;
      case "z": // undo
        undo();
        break;
      case "t": // Tools
        openMenu("tools");
        break;
      case "s": // Segments
        openMenu("segments");
        break;
      case "*": // Settings
        openMenu("settings");
        break;
      case "?": // Help
        openMenu("about");
        openFolder("about-docs");
        break;
      default:
    }
  });


  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_MANUAL_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_AUTO_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_MARKER_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_ADDSEGMENT_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_DELSEGMENT_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_DRAG_ID));
  $("#" + EDIT_MANUAL_ID).on("click", function (e) {
    e.preventDefault();
    if (editMode == EDIT_MANUAL_TRACK) {
      undo();
    } else {
      ga('send', 'event', 'edit', 'manual');
      setEditMode(EDIT_MANUAL_TRACK);
    }
  });
  $("#" + EDIT_AUTO_ID).on("click", function (e) {
    e.preventDefault();
    if (!routerFactory) {
      openApiKeyInfo(true);
      return;
    }
    if (editMode == EDIT_AUTO_TRACK) {
      undo();
    } else {
      ga('send', 'event', 'edit', 'auto');
      setEditMode(EDIT_AUTO_TRACK);
    }
  });
  $("#" + EDIT_MARKER_ID).on("click", function (e) {
    e.preventDefault();
    if (waypoints && !waypoints.isHidden) {
      ga('send', 'event', 'edit', 'marker');
      setEditMode(EDIT_MARKER);
    } else {
      showWarning("Cannot edit hidden waypoints",
        "Go to 'Settings / Display options' to unhide waypoints");
    }
  });
  $("#" + EDIT_ADDSEGMENT_ID).on("click", function (e) {
    e.preventDefault();
    // shortcut
    if ((editMode == EDIT_MANUAL_TRACK) && getTrackLength() == 0) {
      // current track is empty, just use it
      return;
    }
    ga('send', 'event', 'edit', 'new-segment');
    setEditMode(EDIT_NONE);
    setStatus("New segment", { timeout: 2 });
    newSegment();
    setEditMode(EDIT_MANUAL_TRACK);
    saveState();
  });
  $("#" + EDIT_DELSEGMENT_ID).click(function (e) {
    e.preventDefault();
    if ((getTrackLength() == 0) ||
      !confirm("Delete current segment?")) {
      return;
    }
    ga('send', 'event', 'edit', 'delete-segment');
    deleteSegment(track);
    saveState();
  });

  $("#" + EDIT_DRAG_ID).on("click", function (e) {
    e.preventDefault();
    setEditMode(EDIT_DRAG);
  });

  function selectFirstSegment() {
    let found = false;
    forEachSegment(function (segment) {
      segmentClickListener({ target: segment }, true);
      found = true;
      // stop on first segment
      return true;
    });
    if ((!found)) {
      track = null;
      newSegment();
      setExtremityVisibility(false);
    } else {
      setExtremityVisibility(extMarkers);
    }
    return found;
  }

  function deleteSegment(segment) {
    setEditMode(EDIT_NONE);
    if (editLayer.getLayers().length > 2) {
      editLayer.removeLayer(segment);
      track = null;
      selectFirstSegment();
    } else {
      segment.setLatLngs([]);
      polystats.updateStatsFrom(0);
      setEditMode(EDIT_MANUAL_TRACK);
    }
  }

  function toolElevate(e, cleanup) {
    if (e) {
      ga('send', 'event', 'tool', 'elevate', undefined, getTrackLength());
    }

    setStatus("Elevating...", { spinner: true });
    var count = 0,
      ok = true;
    applySegmentTool(function (segment) {
      elevate("toolElevate", segment.getLatLngs(), cleanup, function (success) {
        if (segment == track) {
          polystats.updateStatsFrom(0);
        } else {
          updateSegmentStats(segment);
        }
        if (success) {
          count++;
        } else {
          ok = false;
        }
      });
    });
    if (count > 0) {
      saveState();
    }
    if (ok) {
      clearStatus();
    }

    return false;
  }

  $("#elevate").on("click", toolElevate);

  function toolCleanup(toclean) {
    var count = 0;
    applySegmentTool(function (segment) {
      const points = segment ? segment.getLatLngs() : undefined;
      if (points && (points.length > 0)) {
        count += points.length;
        for (let i = 0; i < points.length; i++) {
          for (let j = 0; j < toclean.length; j++) {
            points[i][toclean[j]] = undefined;
          }
        }
        if (segment == track) {
          polystats.updateStatsFrom(0);
        } else {
          updateSegmentStats(segment);
        }
      }
    });
    return count;
  }

  function getCleanFillOpts() {
    var opts = [];
    if (WU.isChecked("#cleanupalt")) {
      opts.push("alt");
    }
    if (WU.isChecked("#cleanuptime")) {
      opts.push("time");
    }
    return opts;
  }

  $("#cleanup").on("click", function () {
    var toclean = getCleanFillOpts();
    if (toclean.length == 0) {
      // nothing to clean
      return;
    }
    var count = toolCleanup(toclean);
    if (count) {
      alert("Cleaned-up " + count + " points");
      ga('send', 'event', 'tool', 'cleanup', toclean.toString(), count);
      saveState();
    } else {
      setStatus("No data updated", { timeout: 3 });
    }
    return false;
  });

  function toolFillup(toFill) {

    let filler = {
      "time": {
        interpolate(prev, next, pt) {
          let timePrev = new Date(prev.time).getTime(),
            timeNext = new Date(next.time).getTime(),
            distPrevPt = pt.distanceTo(prev),
            distPrevNext = pt.distanceTo(next) + distPrevPt;
          let timePt;
          if (timePrev < timeNext) {
            timePt = timePrev + ((timeNext - timePrev) * (distPrevPt / distPrevNext));
          } else {
            timePt = timeNext + ((timePrev - timeNext) * (distPrevPt / distPrevNext));
          }
          try {
            pt.time = new Date(timePt).toISOString();
          } catch {
            onerror("Invalid interpolated time", {
              time: timePt, prev: prev.time, next: next.time,
              distPt: distPrevPt, distNext: distPrevNext
            });
          }
        }
      },
      "alt": {
        interpolate(prev, next, pt) {
          let distPrevPt = pt.distanceTo(prev),
            distPrevNext = pt.distanceTo(next) + distPrevPt;
          pt.alt = WU.roundDecimal(prev.alt + ((next.alt - prev.alt) * (distPrevPt / distPrevNext)), 2);
        }
      }
    };

    let allCounts = 0;
    applySegmentTool(function (segment) {
      let points = segment ? segment.getLatLngs() : undefined,
        count = 0;

      if (points && (points.length > 0)) {
        for (let j = 0; j < toFill.length; j++) {
          let opt = toFill[j],
            prev, // previous point with data
            next, // next point with data,
            iNxt = -1;
          for (let i = 0; i < points.length; i++) {
            let pt = points[i];
            if (WU.isUndefined(pt[opt])) {
              if ((!next || (next.i <= i)) && (iNxt < points.length)) {
                // search next
                next = undefined;
                for (iNxt = i + 1; iNxt < points.length; iNxt++) {
                  if (!WU.isUndefined(points[iNxt][opt])) {
                    next = points[iNxt];
                    break; // exit for loop
                  }
                }
              }
              if (prev) {
                if (next) {
                  filler[opt].interpolate(prev, next, pt);
                } else {
                  // no next, just copy previous
                  pt[opt] = prev[opt];
                }
              } else {
                if (next) {
                  // no prev, just copy next
                  pt[opt] = next[opt];
                } else {
                  // no next and no prev!
                  alert("Segment has no " + opt + " data, can't interpolate!");
                  break;
                }
              }
              count++;
            } else {
              prev = pt;
            }
          }
        }
        if (count > 0) {
          if (segment == track) {
            polystats.updateStatsFrom(0);
          } else {
            updateSegmentStats(segment);
          }
        }
        allCounts += count;
      }
    });
    return allCounts;
  }

  $("#fillup").on("click", function () {
    var toFill = getCleanFillOpts();
    if (toFill.length == 0) {
      // nothing to fill
      return;
    }
    const count = toolFillup(toFill);
    if (count) {
      alert("Updated " + count + " points data");
      ga('send', 'event', 'tool', 'fillup', toFill.toString(), count);
      saveState();
    } else {
      setStatus("No data updated", { timeout: 3 });
    }
    return false;
  });

  $("#revert").on("click", function () {
    let count = 0;
    applySegmentTool(function (segment) {
      const points = segment ? segment.getLatLngs() : undefined;
      if (points && (points.length > 0)) {
        const newpoints = [];
        count += points.length;
        for (let i = points.length - 1; i >= 0; i--) {
          newpoints.push(points[i]);
        }
        segment.setLatLngs(newpoints);
        if (segment == track) {
          polystats.updateStatsFrom(0);
        } else {
          updateSegmentStats(segment);
        }
        updateExtremities();
      }
    });

    if (count) {
      ga('send', 'event', 'tool', 'revert', undefined, count);
      saveState();
    }

    return false;
  });

  $(".statistics").on("click", function (e) {
    var tag = e.target.tagName.toUpperCase();
    if ((tag !== "SELECT") && (tag !== "OPTION")) {
      toggleElevation(e);
    }
  });

  function segmentClickListener(event, noGaEvent) {
    if ((event.target != track) &&
      ((editMode <= EDIT_NONE) || (editMode == EDIT_DRAG))) {
      if (editMode == EDIT_DRAG) {
        exitDragMode();
      }
      if (!noGaEvent) {
        ga('send', 'event', 'edit', 'switch-segment');
      }
      if (track) {
        if (getTrackLength() == 0) {
          // delete empty track
          editLayer.removeLayer(track);
        } else {
          updateOverlayTrackStyle(track);
        }
      }
      track = event.target;
      track.bringToFront();
      updateTrackStyle();
      setPolyStats();
      updateExtremities();
      if (editMode == EDIT_DRAG) {
        enterDragMode();
      }
      return true;
    } else {
      return false;
    }
  }

  function importGeoJson(geojson) {

    setEditMode(EDIT_NONE);
    setStatus("Loading..", { spinner: true });
    $("#edit-tools").hide();
    var bounds;
    var merge = loadCount > 0 || WU.isChecked("#merge");
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

    function newPoint(coord, time, ext, i) {
      var point = L.latLng(coord[1], coord[0]);
      if (coord.length > 2) {
        // alt
        point.alt = coord[2];
      }
      if (!WU.isUndefined(time)) {
        point.time = time;
      }
      if (!WU.isUndefined(ext)) {
        point.ext = ext;
      }
      if (!WU.isUndefined(i)) {
        point.i = i;
      }
      return point;
    }

    function importSegment(name, color, coords, times, ptExts, xmlnsArr) {
      var v;

      if (joinOnLoad || getTrackLength() == 0) {
        // extend current 'track'
        L.PolyStats.clearStats(track);
      } else {
        newSegment(true);
      }
      v = track.getLatLngs();
      if ((v.length === 0) && (getTrackName() == NEW_TRACK_NAME) && name) {
        setTrackName(name);
      }
      track.name = name;
      track.color = color;

      // import polyline vertexes
      for (let i = 0; i < coords.length; i++) {
        v.push(newPoint(coords[i],
          times ? times[i] : undefined,
          ptExts ? ptExts[i] : undefined,
          i));
      }
      track.setLatLngs(v);
      bounds.extend(track.getBounds());
      if (track.getLatLngs().length > 0) {
        updateSegmentStats(track);
      }
      // add segment xml namespaces to track
      if (xmlnsArr && xmlnsArr.length) {
        track.xmlnsArr = xmlnsArr;
      }
    }

    if (getTrackName() == NEW_TRACK_NAME) {
      if (geojson.metadata && geojson.metadata.name) {
        setTrackName(geojson.metadata.name);
      }
      if (geojson.metadata && geojson.metadata.desc && !metadata.desc) {
        metadata.desc = geojson.metadata.desc;
      }
    }

    L.geoJson(geojson, {
      onEachFeature: function (f) {
        var coords, times, ptExts, xmlnsArr;
        if (f.geometry.type === "LineString") {
          coords = f.geometry.coordinates;
          times = f.properties.coordTimes && (f.properties.coordTimes.length == coords.length) ?
            f.properties.coordTimes : undefined;
          ptExts = f.properties.ptExts && (f.properties.ptExts.length == coords.length) ?
            f.properties.ptExts : undefined;
          xmlnsArr = f.properties.xmlnsArr;
          importSegment(f.properties.name, f.properties.stroke, coords, times, ptExts, xmlnsArr);
        }
        if (f.geometry.type === "MultiLineString") {
          for (let i = 0; i < f.geometry.coordinates.length; i++) {
            coords = f.geometry.coordinates[i];
            times = f.properties.coordTimes && f.properties.coordTimes[i] &&
              (f.properties.coordTimes[i].length == coords.length) ?
              f.properties.coordTimes[i] : undefined;
            ptExts = f.properties.ptExts && f.properties.ptExts[i] &&
              (f.properties.ptExts[i].length == coords.length) ?
              f.properties.ptExts[i] : undefined;
            xmlnsArr = f.properties.xmlnsArr && f.properties.xmlnsArr[i] ?
              f.properties.xmlnsArr[i] : undefined;
            importSegment(f.properties.name, f.properties.stroke, coords, times, ptExts, xmlnsArr);
          }
        } else if (f.geometry.type === "Point") {
          // import marker
          coords = f.geometry.coordinates;
          var latlng = newPoint(coords);
          newWaypoint(latlng, f.properties, wptLayer);
          if (!hideWpt) bounds.extend(latlng);
        }
      }
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds, { maxZoom: 16 });
    }
    clearStatus();
    if (!segmentClickListener({ target: activeTrack }, true)) {
      // no segment added, but existing one was (possibly) extended, update stats display
      showStats();
    }
    saveState();
    closeMenu();
    updateExtremities();
    setExtremityVisibility(extMarkers);
    const addedLayers = editLayer.getLayers().length - initLayers;
    if (addedLayers) {
      ga('send', 'event', 'file', 'load-segment', undefined, addedLayers);
    }
    return editLayer;
  }

  const loadcontrol = L.Control.fileLayerLoad({
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
  fileloader.on('data:error', function () {
    setStatus("Failed: check file and type", { 'class': 'status-error', 'timeout': 3 });
  });

  function loadFromUrl(url, options) {
    if (!options) {
      options = {};
    }
    setStatus("Loading...", { "spinner": true });
    var _url = options.noproxy ? url : WU.corsUrl(url);
    var req = {
      url: _url,
      success: function (data) {
        loadCount = 0;
        if (options.key) {
          if (!CRY.isCryptoSupported()) {
            onerror('Crypto-not-supported');
            alert("Sorry, you cannot load this file: it is encrypted, and your browser does not provide the required services to decrypt it.");
            newTrack();
            return;
          }
          //var encversion = options.key.substring(0,2); // version, ignored for now
          const key = encodeURIComponent(options.key.substring(2));
          const deckey = WU.strdecode(key, key);
          const iv = deckey.substring(0, 24);
          const pwd = deckey.substring(24);
          //console.log("iv  : " + iv);
          //console.log("pwd : " + pwd);
          ga('send', 'event', 'file', 'decrypt', undefined, Math.round(data.length / 1000));
          CRY.aesGcmDecrypt(data, iv, pwd)
            .then(function (gpx) {
              fileloader.loadData(gpx, url, options.ext);
            })
            .catch(function (err) {
              ga('send', 'event', 'error', 'crypto-decrypt', err);
              setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
            });
        } else {
          fileloader.loadData(data, url, options.ext);
        }
      }
    };
    if (options.withCredentials) {
      req.xhrFields = {
        withCredentials: true
      };
    }

    $.ajax(req).fail(function (resp) {
      setStatus("Failed: " + resp.statusText, { 'class': 'status-error', 'timeout': 3 });
      if (!track) {
        newTrack();
        restorePosition();
      }
    });
  }

  function getLoadExt() {
    var ext = WU.getSelectedOption("#track-ext");
    if (ext === "auto") {
      ext = undefined;
    }
    return ext;
  }
  $("#track-get").on("click", function () {
    var url = $("#track-get-url").val().trim();
    if (!url) {
      $("#track-get-url").focus();
      return;
    }
    ga('send', 'event', 'file', 'load-url');
    setEditMode(EDIT_NONE);
    var noproxy = WU.isChecked("#noproxy");
    loadFromUrl(url, {
      ext: getLoadExt(),
      noproxy: noproxy,
      withCredentials: noproxy
    });
  });
  $("#track-get-url").keypress(function (e) {
    if (e.which == 13) {
      $("#track-get").trigger("click");
    }
  });

  $("#track-upload").on("click", function () {
    $("#track-upload").val("");
  });
  $("#track-upload").on("change", function () {
    var files = $("#track-upload")[0].files;
    if (files[0]) {
      ga('send', 'event', 'file', 'load-file');
      setEditMode(EDIT_NONE);
      setStatus("Loading...", { spinner: true });
      loadCount = 0;
      fileloader.loadMultiple(files, getLoadExt());
    }
  });
  map.getContainer().addEventListener("drop", function () {
    loadCount = 0;
  });

  /*-- DropBox --*/

  var dropboxLoadOptions = {

    // Required. Called when a user selects an item in the Chooser.
    success: function (files) {
      $("#menu").hide();
      ga('send', 'event', 'file', 'load-dropbox');
      loadFromUrl(files[0].link, {
        ext: getLoadExt(),
        noproxy: true
      });
    },

    // Optional. Called when the user closes the dialog without selecting a file
    // and does not include any parameters.
    cancel: function () {

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
  $("#dropbox-chooser").on("click", function () {
    // Check Dropbox is supported
    if (!Dropbox.isBrowserSupported()) {
      alert("Sorry, your browser does not support Dropbox loading");
      return;
    }
    try {
      Dropbox.choose(dropboxLoadOptions);
    } catch (err) {
      setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
      alert("Dropbox popup could not open. Make sure you did not forbid popups.");
      ga('send', 'event', 'error', 'Dropbox.choose error', err);
    }
  });

  var dropboxSaveOptions = {
    files: [{}], // to be completed when uploading

    // Success is called once all files have been successfully added to the user's
    // Dropbox, although they may not have synced to the user's devices yet.
    success: function () {
      // Indicate to the user that the files have been saved.
      setStatus("File saved in your Dropbox", { timeout: 3 });
      $("#menu").hide();
      dropboxSaveOptions.deleteTemp();
    },

    // Progress is called periodically to update the application on the progress
    // of the user's downloads. The value passed to this callback is a float
    // between 0 and 1. The progress callback is guaranteed to be called at least
    // once with the value 1.
    progress: function (/*progress*/) { },

    // Cancel is called if the user presses the Cancel button or closes the Saver.
    cancel: function () {
      dropboxSaveOptions.deleteTemp();
    },

    // Error is called in the event of an unexpected response from the server
    // hosting the files, such as not being able to find a file. This callback is
    // also called if there is an error on Dropbox or if the user is over quota.
    error: function (errorMessage) {
      setStatus(errorMessage || "Failed", { timeout: 5, class: "status-error" });
      dropboxSaveOptions.deleteTemp();
    },

    deleteTemp: function () {
      dropboxTempShare.delete(
        dropboxSaveOptions.gpxurl,
        dropboxSaveOptions.files[0].url,
        dropboxSaveOptions.passcode,
        undefined, function () {
          console.warn("Failed to delete temp share");
        }
      );
    }

  };

  function dropboxSaver() {
    $("#confirm-dropbox").hide();
    try {
      Dropbox.save(dropboxSaveOptions);
    } catch (err) {
      setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
      ga('send', 'event', 'error', 'Dropbox.save error', err);
    }
  }
  $("#dbs-ok").on("click", dropboxSaver);
  $("#dbs-cancel").on("click", function () {
    dropboxSaveOptions.deleteTemp();
    $("#confirm-dropbox").hide();
  });

  $("#dropbox-saver").on("click", function () {
    // Check Dropbox is supported
    if (!Dropbox.isBrowserSupported()) {
      alert("Sorry, your browser does not support Dropbox saving");
      return;
    }
    var name = getConfirmedTrackName().replace(/[\\/:*?"<>|]/g, "_"); // remove forbidden path chars
    var gpx = getTrackGPX(false);
    ga('send', 'event', 'file', 'save-dropbox', undefined, Math.round(gpx.length / 1000));
    dropboxTempShare.upload(
      name, gpx,
      function (gpxurl, rawgpxurl, passcode) {
        dropboxSaveOptions.files[0].filename = name + ".gpx";
        dropboxSaveOptions.files[0].url = rawgpxurl;
        dropboxSaveOptions.gpxurl = gpxurl;
        dropboxSaveOptions.passcode = passcode;
        $("#confirm-dropbox").show();
      }, function (error) {
        uploadFailed(dropboxTempShare, gpx, error);
      }
    );
  });

  /* ------------ */

  var MAX_ROUTE_WPTS = 2;

  function newRouteWaypoint(i, waypoint) {

    function getRouteWaypoinContent(latlng, index, marker) {
      if (!route) {
        marker.off("click");
        return; // ignore
      }
      var div = document.createElement("div");

      let p = L.DomUtil.create("div", "popupdiv ptbtn", div);
      var del = L.DomUtil.create('a', "", p);
      del.href = "#";
      del.title = "Delete";
      del.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>delete</i></span>";
      del.onclick = function (e) {
        if (!route) {
          return; // ignore
        }
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
      console.error("route-pts-overlimit");
      ga('send', 'event', 'error', 'route-pts-overlimit', location.toString(), nwpts);
    }

    if (i === 0) {
      // no start marker
      return undefined;
    }
    var marker = L.marker(waypoint.latLng, {
      draggable: true,
      icon: MARKER_ICON
    });

    marker.on("click", function (e) {

      L.popup({ "className": "overlay" })
        .setLatLng(e.latlng)
        .setContent(getRouteWaypoinContent(e.latlng, i, marker))
        .openOn(map);

    });

    var ename = routerFactory == createOrsRouter ?
      "ors.routing" : (routerFactory == createGraphHopperRouter ?
        "gh.routing" : "unknownrouter");
    ga('send', 'event', 'api', ename + '.ok');

    addUndo(UndoRoute, { fromPt: routeStart });

    return marker;
  }


  // ------------ Length Unit

  var LENGTH_UNIT_METRIC = "0";
  var LENGTH_UNIT_IMPERIAL = "1";

  var defaultLengthUnit = LENGTH_UNIT_METRIC;
  var lengthUnit = WU.getVal("wt.lengthUnit", defaultLengthUnit);

  function isMetric() {
    return lengthUnit === LENGTH_UNIT_METRIC;
  }
  function isImperial() {
    return lengthUnit === LENGTH_UNIT_IMPERIAL;
  }

  function altUnit() {
    var unit = isMetric() ? "m" : "ft";
    return unitSpan(true, unit, false);
  }

  function alt2txt(alt, noUnits) {
    if (alt === undefined) {
      return "?";
    } else {
      if (isImperial()) {
        alt = alt / 0.3048;
      }
      alt = Math.round(alt);
      return noUnits ? alt : alt + altUnit();
    }
  }

  function txt2alt(alt) {
    alt = parseFloat(alt);
    if (isImperial()) {
      alt = alt * 0.3048;
    }
    return WU.roundDecimal(alt, 2);
  }

  function dist2txt(dist, noUnits) {
    var unit = "m";
    var roundFactor = 1;
    if (isImperial()) {
      dist /= 0.9144;
      unit = "yd";
      if (dist > 1000) {
        dist /= 1760;
        unit = "mi";
        roundFactor = 10;
      }
    } else {
      if (dist > 2000) {
        dist /= 1000;
        unit = "km";
        roundFactor = 10;
      }
    }
    dist = Math.round(dist * roundFactor) / roundFactor;
    return noUnits ? dist : dist + unitSpan(true, unit, false);
  }

  // ------------ Manage Service Worker

  function initServiceWorkerSetting() {
    WU.setChecked("#use-service-worker", WC.getUseServiceWorker());
  }
  $("#use-service-worker").on("change", () => {
    WC.setUseServiceWorker(WU.isChecked("#use-service-worker"));
    WC.saveValOpt("wt.useServiceWorker", WC.getUseServiceWorker());
    WC.initServiceWorker(true);
  });

  // ------------ Scale control and unit toggling

  var scaleCtrl;

  function updateUnitSystem(event) {
    if (scaleCtrl) {
      scaleCtrl.remove();
    }
    if (event) {
      // setting changed
      lengthUnit = $("input[name=unitopt]:checked").val();
      WC.saveValOpt("wt.lengthUnit", lengthUnit);
      ga('send', 'event', 'setting', 'lengthUnit', undefined, parseFloat(lengthUnit));
      showStats();
    } else {
      // init
      $("input:radio[name=unitopt][value=" + lengthUnit + "]").prop("checked", true);
    }
    $(".distUnit").text(isMetric() ? "meter" : "yard");
    scaleCtrl = L.control.scale({
      updateWhenIdle: true,
      metric: isMetric(),
      imperial: isImperial()
    });
    scaleCtrl.addTo(map);
  }
  updateUnitSystem();
  $("input:radio[name=unitopt]").on("change", updateUnitSystem);

  // --------------- Time

  function unitSpan(spaceBefore, unitTxt, spaceAfter) {
    var res = "";
    if (spaceBefore) {
      res += "<span class='unit-space'> </span>";
    }
    res += "<span class='unit'>" + unitTxt + "</span>";
    if (spaceAfter) {
      res += "<span class='unit-space'> </span>";
    }
    return res;
  }

  function time2txt(time) {
    var strTime = "";
    if (time >= 3600) strTime += Math.floor(time / 3600) + unitSpan(true, "h", true);
    time %= 3600;
    if (time >= 60) strTime += Math.floor(time / 60) + unitSpan(true, "m", true);
    time %= 60;
    strTime += Math.round(time) + unitSpan(true, "s", false);
    return strTime;
  }

  // --------------- Coordinates rounding

  const MIN_COORD_DECIMALS = 3;
  const MAX_COORD_DECIMALS = 8;
  const DEFAULT_COORD_DECIMALS = 6;
  const DEFAULT_COORD_ROUNDING = true;
  var coordDecimals = WU.getVal("wt.coordDecimals", DEFAULT_COORD_DECIMALS);
  var coordRounding = WU.getBoolVal("wt.coordRounding", DEFAULT_COORD_ROUNDING);
  function showCoordnateRounding(save) {
    if (save) {
      WC.saveValOpt("wt.coordDecimals", coordDecimals);
      WC.saveValOpt("wt.coordRounding", coordRounding);
    }
    WU.setChecked("#rounding-on", coordRounding);
    $("#rounding-decimals").prop("disabled", !coordRounding);
    WU.selectOption("#rounding-decimals", coordDecimals);
  }
  $("#rounding-on").on("change", () => {
    coordRounding = WU.isChecked("#rounding-on");
    showCoordnateRounding(true, true);
  });
  $("#rounding-decimals").on("change", () => {
    coordDecimals = parseInt(WU.getSelectedOption("#rounding-decimals"));
    if (isNaN(coordDecimals)) {
      coordDecimals = DEFAULT_COORD_DECIMALS;
    } else if (coordDecimals > MAX_COORD_DECIMALS) {
      coordDecimals = MAX_COORD_DECIMALS;
    } else if (coordDecimals < MIN_COORD_DECIMALS) {
      coordDecimals = MIN_COORD_DECIMALS;
    }
    showCoordnateRounding(true);
  });
  showCoordnateRounding(false);

  function getCoordinate(rawCoord) {
    if (coordDecimals >= 0) {
      return WU.roundDecimal(rawCoord, coordDecimals);
    } else {
      return rawCoord;
    }
  }

  // ---------------- Popups

  function getTrackPointPopupContent(latlng) {
    var div = L.DomUtil.create('div', "popupdiv"),
      data;

    var pts = track.getLatLngs();
    var last = pts[pts.length - 1];

    data = L.DomUtil.create('div', "popupdiv", div);
    data.innerHTML = "<span class='popupfield'>Distance:</span> " +
      '<span class="material-icons symbol notranslate" translate="no">trending_flat</span> ' +
      dist2txt(L.PolyStats.getPointDistance(latlng)) + " / " +
      '<span class="material-icons symbol notranslate" translate="no">sync_alt</span> ' +
      dist2txt(L.PolyStats.getPointDistance(last) * 2 - L.PolyStats.getPointDistance(latlng));
    data = L.DomUtil.create('div', "popupdiv", div);
    data.innerHTML = "<span class='popupfield' title='Estimation using " + currentActivity.name + " profile'>Est. time:</span> " +
      '<span class="material-icons symbol notranslate" translate="no">trending_flat</span> ' +
      time2txt(L.PolyStats.getPointTime(latlng)) + " / " +
      '<span class="material-icons symbol notranslate" translate="no">sync_alt</span> ' +
      time2txt(L.PolyStats.getPointTimeRoundTrip(latlng));
    var trackStart = track.getLatLngs()[0];
    data = L.DomUtil.create('div', "popupdiv", div);
    data.innerHTML = "<span class='popupfield' title='Recorded time'>Rec. time:</span> <input type='datetime-local' placeholder='yyyy-mm-dd HH:MM:SS' step='1' class='rec-time-abs'/>";
    WU.setDateTimeInput($(data).find("input"), latlng.time);
    $(data).find(".rec-time-abs").on("change", (event) => {
      const newDate = WU.getDateTimeInput($(event.target));
      latlng.time = newDate ? newDate.toISOString() : undefined;
    });
    if (latlng.time && trackStart.time) {
      data = L.DomUtil.create('div', "popupdiv", div);
      data.innerHTML = "<span class='popupfield' title='Recorded duration'>Duration:</span> " +
        time2txt((new Date(latlng.time) - new Date(trackStart.time)) / 1000);
    }
    return div;

  }

  function getLatLngPopupContent(latlng, deletefn, splitfn, gotopt, toadd) {
    var div = L.DomUtil.create("div");
    var p;

    p = L.DomUtil.create("div", "popupdiv", div);
    p.innerHTML = "<span class='popupfield'>Position:</span> " +
      `<span title="${latlng.lat},${latlng.lng}">` +
      WU.roundDecimal(latlng.lat, 5) + "," +
      WU.roundDecimal(latlng.lng, 5) +
      "</span>";

    if (editMode != EDIT_NONE) {

      p = L.DomUtil.create("div", "popupdiv", div);
      p.innerHTML = "<span class='popupfield'>Altitude:</span> ";
      var altinput = L.DomUtil.create('input', "", p);
      altinput.type = "text";
      altinput.placeholder = "Numeric altitude";
      altinput.class = altinput.className = "atlInput";
      $(altinput).val(WU.isUndefined(latlng.alt) || !WU.isNumeric(latlng.alt) ? "" : alt2txt(latlng.alt, true));
      altinput.onkeyup = function () {
        try {
          latlng.alt = WU.isNumeric(altinput.value) ? txt2alt(altinput.value) : undefined;
        } catch (err) {
          console.error(err);
        }
      };
      p = L.DomUtil.create("span", "", p);
      p.innerHTML = altUnit();
    } else {
      if (!WU.isUndefined(latlng.alt)) {
        p = L.DomUtil.create("div", "popupdiv", div);
        p.innerHTML = "<span class='popupfield'>Altitude:</span> " + alt2txt(latlng.alt);
      }
    }

    if (toadd) {
      div.appendChild(toadd);
    }

    if (editMode != EDIT_NONE) {
      let btn;
      // Previous point
      if (gotopt && latlng.i > 0) {
        p = L.DomUtil.create("div", "popupdiv ptbtn", div);
        btn = L.DomUtil.create('a', "", p);
        btn.href = "#";
        btn.title = "Previous point";
        btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>navigate_before</i></span>";
        btn.onclick = function () {
          gotopt(-1);
          return false;
        };
      }
      // Delete button
      p = L.DomUtil.create("div", "popupdiv ptbtn", div);
      btn = L.DomUtil.create('a', "", p);
      btn.href = "#";
      btn.title = "Delete";
      btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>delete</i></span>";
      btn.onclick = deletefn;

      if (splitfn) {
        // Split button
        p = L.DomUtil.create("div", "popupdiv ptbtn", div);
        p.id = "split";
        btn = L.DomUtil.create('a', "", p);
        btn.href = "#";
        btn.title = "Split segment from this point";
        btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>content_cut</i></span>";
        btn.onclick = splitfn;
      }

      // Next point
      if (gotopt && latlng.i < (track.getLatLngs().length - 1)) {
        p = L.DomUtil.create("div", "popupdiv ptbtn", div);
        btn = L.DomUtil.create('a', "", p);
        btn.href = "#";
        btn.title = "Next point";
        btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>navigate_next</i></span>";
        btn.onclick = function () {
          gotopt(+1);
          return false;
        };
      }

    }

    return div;
  }

  function getRecordedTime(segmentPts) {
    var lastPt = segmentPts[segmentPts.length - 1];
    var firstPt = segmentPts[0];
    let segDuration;
    if (lastPt.time && firstPt.time) {
      segDuration = Math.abs((new Date(lastPt.time).getTime() - new Date(firstPt.time).getTime()) / 1000);
    }
    return segDuration;
  }

  function showStats() {
    var pts = track ? track.getLatLngs() : undefined;
    if (pts && pts.length > 0) {
      var last = pts[pts.length - 1];
      var first = pts[0];
      $("#distow").html(dist2txt(L.PolyStats.getPointDistance(last)));
      $("#distrt").html(dist2txt(2 * L.PolyStats.getPointDistance(last)));
      let timeow, timert = 0;
      if (getCurrentActivityName() != ACTIVITY_RECORDED) {
        timeow = L.PolyStats.getPointTime(last);
        timert = L.PolyStats.getPointTimeRoundTrip(first);
      } else {
        timeow = getRecordedTime(pts);
      }
      $("#timeow").html(time2txt(timeow ? timeow : 0));
      $("#timert").html(time2txt(timert));
      var stats = L.PolyStats.getStats(track);
      $("#altmin").html(alt2txt(stats.minalt));
      $("#altmax").html(alt2txt(stats.maxalt));
      $("#climbing").html("+" + alt2txt(stats.climbing));
      $("#descent").html(alt2txt(stats.descent));
    } else {
      $("#distow").html(dist2txt(0));
      $("#distrt").html(dist2txt(0));
      $("#timeow").html(time2txt(0));
      $("#timert").html(time2txt(0));
      $("#altmin").html(alt2txt(0));
      $("#altmax").html(alt2txt(0));
      $("#climbing").html("+" + alt2txt(0));
      $("#descent").html("-" + alt2txt(0));
    }
  }

  map.on('popupclose', function () {
    //console.log(e.type);
    if ((editMode === EDIT_MANUAL_TRACK) && (track.editor)) {
      track.editor.continueForward();
    }
  });
  map.on('editable:enable', function () {
    //console.log(e.type);
  });
  map.on('editable:drawing:start', function () {
    //console.log(e.type);
  });
  map.on('editable:drawing:dragend', function () {
    //console.log(e.type);
  });
  map.on('editable:drawing:commit', function () {
    //console.log(e.type);
  });
  map.on('editable:drawing:end', function () {
    //console.log(e.type);
  });
  map.on('editable:drawing:click', function () {
    //console.log(e.type);
  });
  map.on('editable:shape:new', function () {
    //console.log(e.type);
  });

  function newVertex(e) {
    var latlng = e.vertex.getLatLng();
    var prev = e.vertex.getPrevious();
    let i = WU.isUndefined(prev) ? 0 : prev.latlng.i + 1;
    latlng.i = i;
    //console.log(e.type + ": " + latlng.i);
    if (i == getTrackLength() - 1) {
      // last vertex
      elevatePoint("newVertex", latlng, false, function () {
        polystats.updateStatsFrom(i);
      });
    }
    addUndo(UndoNewPt, { newPt: latlng });
    updateExtremity(latlng, i);
  }
  map.on('editable:vertex:new', newVertex);

  function dragVertex(e) {
    var latlng = e.vertex.getLatLng();
    var i = latlng.i;
    elevatePoint("dragVertex", latlng, false, function () {
      polystats.updateStatsFrom(i);
    });
    //console.log(e.type + ": " + i);
    updateExtremity(latlng, i);
  }
  map.on('editable:vertex:dragend', dragVertex);
  function dragVertexStart(e) {
    var latlng = e.vertex.getLatLng();
    addUndo(UndoMovePt, { pt: latlng });
  }
  map.on('editable:vertex:dragstart', dragVertexStart);

  map.on('editable:middlemarker:mousedown', function () {
    //console.log(e.type);
  });

  function draggedMark(e) {
    if (e.layer.getLatLng) {
      // Dragged a waypoint
      elevatePoint("draggedMark", e.layer.getLatLng(), false);
      //console.log(e.type);
    }
  }
  map.on('editable:dragend', draggedMark);

  map.on('editable:vertex:deleted', function (e) {
    if (!e.latlng.undoing) { // ensure we're not running an undo
      addUndo(UndoDeletePt, { pt: e.latlng });
    }
    var i = e.latlng.i;
    //console.log(e.type + ": " + i);
    polystats.updateStatsFrom(i);
    updateExtremities();
  });


  map.on('editable:created', function (/*event*/) {
    //console.log("Created: " + event.layer.getEditorClass());
  });

  function checkGraphHopperRes(e) {
    var message;

    // check GraphHopper response
    if ((e.status >= 400) || (e.remaining === 0)) {
      if (e.status >= 500) {
        message = "GraphHopper error";
        ga('send', 'event', 'api', 'gh.routing.ko', e.statusText);
      } else if (e.status == 401) {
        message = "Invalid GraphHopper API key, please fix in Settings";
        ga('send', 'event', 'api', 'gh.routing.ko', 'invalid-key');
      } else {
        ga('send', 'event', 'api', 'gh.routing.ko', 'no-credit');
        message = "You consumed all your GraphHopper daily quota";
      }
    }

    if (message) {
      setEditMode(EDIT_NONE);
      showRoutingError(message);
      return false;
    }
    return true;
  }

  // not triggered by gh, only ors
  function routingError(err) {
    console.log("Routing failed " + err.error.message);
    ga('send', 'event', 'api', 'ors.routing.ko', err.error.message);
    setEditMode(EDIT_NONE);
    showRoutingError("OpenRouting failed, check API key and account status");
  }

  function newMarker(e) {

    if (editMode == EDIT_MARKER) {
      ga('send', 'event', 'edit', 'new-marker');
      var marker = newWaypoint(e.latlng, { name: "New waypoint" }, waypoints);
      elevatePoint("newMarker", e.latlng, false);
      marker.enableEdit();
    } else if (editMode == EDIT_AUTO_TRACK) {
      if (!route) {
        if (!routeStart) {
          setRouteStart(e.latlng);
        } else {
          var fromPt = routeStart,
            toPt = e.latlng,
            router = routerFactory();

          route = L.Routing.control({
            router: router,
            waypoints: [fromPt, toPt],
            routeWhileDragging: false,
            autoRoute: true,
            fitSelectedRoutes: false,
            lineOptions: {
              styles: [{
                color: getSegmentColor(track),
                weight: trackWeight,
                opacity: 1,
                interactive: false
              }],
              addWaypoints: true
            },
            createMarker: newRouteWaypoint,
            show: false
          }).addTo(map);
          route.on("routingerror", routingError);
        }
      } else {
        var wpts = route.getWaypoints();
        if (wpts.length >= MAX_ROUTE_WPTS) { // up to 4 with free version
          try {
            mergeRouteToTrack();
            restartRoute();
            map.fireEvent("click", { latlng: e.latlng });
          } catch (err) {
            ga('send', 'event', 'error', 'merge-route-failed', err.toString() +
              ", " + navigator.userAgent, wpts.length);
          }
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

  function clickVertex(e, vertex) {
    vertex = vertex || e.vertex;
    let latlng = vertex.latlng;

    function deleteTrackPoint(event) {
      vertex.delete();
      map.closePopup(pop);
      event.preventDefault();
    }
    function splitSegment(event) {
      ga('send', 'event', 'edit', 'split-segment');
      setEditMode(EDIT_NONE);
      var i = latlng.i;
      var seg1 = track.getLatLngs().slice(0, i),
        seg2 = track.getLatLngs().slice(i);
      var xmlnsArr = track.xmlnsArr;
      track.setLatLngs(seg1);
      seg1 = track;
      polystats.updateStatsFrom(0);
      newSegment();
      track.setLatLngs(seg2);
      track.xmlnsArr = xmlnsArr;
      polystats.updateStatsFrom(0);
      saveState();
      setEditMode(EDIT_MANUAL_TRACK);
      map.closePopup(pop);
      event.preventDefault();
      // order new segment after split one
      let seg1Order, segIdx;
      if (!WU.isUndefined(seg1._wtOrder)) {
        seg1Order = seg1._wtOrder;
      } else {
        segIdx = 0;
      }
      forEachSegment((segment) => {
        // were segments ordered?
        if (WU.isUndefined(segIdx)) {
          // yes
          if (segment == track) {
            segment._wtOrder = seg1Order + 1; // set it just after seg1
          } else if (segment._wtOrder > seg1Order) {
            segment._wtOrder++;
          }
        } else {
          // no, assign order to segment
          segment._wtOrder = segIdx++;
          if (seg1 == segment) {
            seg1Order = segment._wtOrder;
            segIdx++; // book 1 index for new segment
          } else if (segment == track) {
            segment._wtOrder = seg1Order + 1; // set it just after seg1
          }
        }
      }, ALL_SEGMENTS);
    }
    function gotopt(diff) {
      const topt = diff > 0 ? vertex.getNext() : vertex.getPrevious();
      if (topt) {
        map.closePopup(pop);
        clickVertex(null, topt);
      }
    }

    if (e && e.originalEvent && e.originalEvent.shiftKey) {
      // shortcut to delete a vertex
      vertex.delete();
      return;
    }
    track.editor.commitDrawing();
    if (getTrackLength() === 0) {
      setEditMode(EDIT_MANUAL_TRACK);
      return;
    }
    if (e && e.cancel) {
      e.cancel();
    }
    var div = getTrackPointPopupContent(latlng);
    var splitfn,
      i = latlng.i,
      len = getTrackLength();
    if ((i > 1) & (i < len - 1)) {
      splitfn = splitSegment;
    }
    var pop = L.popup({ "className": "overlay" })
      .setLatLng(latlng)
      .setContent(getLatLngPopupContent(latlng, deleteTrackPoint, splitfn, gotopt, div))
      .openOn(map);
    $(".leaflet-popup-close-button").on("click", function () {
      if (track.editor) {
        track.editor.continueForward();
      }
      return false;
    });
  }
  map.on('editable:vertex:click', clickVertex);


  // ---- ELEVATION
  let elevation;

  function hideElevation() {
    if (elevation) toggleElevation();
  }

  function toggleElevation() {
    // is elevation currently displayed?
    if (!elevation) {
      // ignore if track has less than 2 points
      if (track && getTrackLength() > 1) {
        setEditMode(EDIT_NONE);
        map.closePopup();
        const options = $(document).width() < 600 ? {
          width: 355,
          height: 125,
          margins: {
            top: 10,
            right: 10,
            bottom: 25,
            left: 40
          }
        } : {};
        options.imperial = isImperial();
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
        } catch {
          console.log('no elevation');
        }
      }
    } else {
      elevation.gjl.remove();
      elevation.el.remove();
      elevation = undefined;
    }
  }

  $(".appname").text(config.appname);
  setStatus("Welcome to " + config.appname + "!", { timeout: 3 });

  // Prevent automatic translation on controls, icons, and user data
  WU.noTranslate();
  WU.noTranslate(".leaflet-control-layers-list label div span");
  WU.noTranslate(".leaflet-control-attribution");
  WU.noTranslate(".leaflet-control-scale-line");
  WU.noTranslate("#track-name");
  WU.noTranslate("input");
  WU.noTranslate("#share-libs");

  function menu(item, event) {
    $("#menu").show();
    $("#menu>table").hide();
    $(".tablinks").removeClass("active");
    $("#tab" + item).addClass("active");
    $("#menu #menu" + item).show();
    if (event) {
      event.preventDefault();
    }
    ga('send', 'event', 'menu', item);
  }
  $(".tablinks").on("click", function (event) {
    menu(event.currentTarget.id.replace("tab", ""), event);
  });
  $(".donatebtn").on("click", function (event) {
    ga('send', 'event', 'menu', 'donate', event.target.id);
  });

  if (WU.getValStorage()) {
    $("#cfgsave").on("change", function () {
      const saveCfg = WU.isChecked("#cfgsave");
      WC.setSaveState(saveCfg);
      setStateSaved(saveCfg);
      if (saveCfg) {
        saveState();
        saveSettings();
      } else {
        clearSavedState();
      }
    });
  } else {
    $("#cfgsave").attr("title", "Your browser prevents storing data. Did you block cookies?");
    $("#cfgsave").prop("disabled", true);
    $("#cfgsave").removeClass("no-trim");
  }

  function setStateSaved(save) {
    if (save != WU.isChecked()) {
      WU.setChecked("#cfgsave", save, true);
    }
    if (save) {
      $(".state-file").removeAttr("disabled");
      $(".state-file").removeClass("disabled-button");
    } else {
      $(".state-file").attr("disabled", true);
      $(".state-file").addClass("disabled-button", true);
    }
  }

  WU.setChecked("#merge", false);

  // get visit info
  const about = WU.getVal("wt.about", undefined);
  // set saving status
  setStateSaved(WC.isStateSaved());

  // make sure we have a track
  newTrack();

  // map parameter
  if (requestedMap) {
    ga('send', 'event', 'file', 'load-mapparam');
    changeBaseLayer(requestedMap);
  }

  const url = WU.getParameterByName("url");
  if (url) {
    ga('send', 'event', 'file', 'load-urlparam');
    const qr = WU.getParameterByName("qr");
    if (qr === "1") {
      ga('send', 'event', 'file', 'load-qrcode');
    }
    showLocation = LOC_NONE;
    loadFromUrl(url, {
      ext: WU.getParameterByName("ext"),
      noproxy: WU.getParameterByName("noproxy"),
      withCredentials: WU.getParameterByName("noproxy"),
      key: WU.getParameterByName("key")
    });
    setEditMode(EDIT_NONE);
  } else {
    const reqpos = {
      lat: parseFloat(WU.getParameterByName("lat")),
      lng: parseFloat(WU.getParameterByName("lng"))
    };
    if (reqpos.lat && reqpos.lng) {
      showLocation = LOC_ONCE;
      setLocation(reqpos, true);
    } else {
      restorePosition();
    }
    restoreState();
  }

  /* Show About dialog if not shown since a while */
  const now = new Date();
  const ONE_MONTH = Math.round(1000 * 60 * 60 * 24 * 30.5); // 1 month in ms
  const FIRST_VISIT = "1";
  if (about) {
    if ((about == FIRST_VISIT) || (now.getTime() > new Date(about).getTime() + ONE_MONTH)) {
      // reset about tag
      WU.storeVal("wt.about", now.toISOString());
      // wait for potential urlparam to be loaded
      setTimeout(function () { openMenu("about"); }, 4000);
    }
  } else {
    WU.storeVal("wt.about", FIRST_VISIT);
  }

  // Suggest setting API keys
  if (!elevationService || !routerFactory) {
    openApiKeyInfo();
  }

  initTrackDisplaySettings();

  /* -------------- Share libs --------------- */

  const pasteLibSelect = $("#share-libs")[0];
  function initShareLib() {
    WU.arrayForEach(PasteLibs.libNames, function (i, name) {
      const lib = PasteLibs.get(name);
      if (lib.enabled) {
        WU.addSelectOption(pasteLibSelect, name, lib.name);
      }
    });
  }
  function changeShareLib() {
    const libname = WU.getSelectedOption(pasteLibSelect);
    share = PasteLibs.get(libname);
    $("#share-web").html("<a href='" + share.web + "' title='" + share.web + "' >" + share.web + "</a>");
    $("#share-max-size").html(share.maxSize);
    $("#share-max-time").html(share.maxTime);
    $("#share-max-downloads").html(share.maxDownloads);
    $("#share-status").html("?");
    share.ping(
      function () { $("#share-status").html("working <span class='green material-icons notranslate'>check_circle_outline</span>"); },
      function () { $("#share-status").html("NOT working <span class='red material-icons notranslate'>highlight_off</span>"); }
    );
    // share prompt dialog
    $("#wtshare-name").text(share.name);
    $("#wtshare-web").attr("href", share.web);
    WC.saveValOpt("wt.share", libname);
  }
  initShareLib();
  WU.selectOption(pasteLibSelect, sharename);
  changeShareLib();
  $("#share-libs").on("change", changeShareLib);

  /* ------------------------------------------- */

  // specific style for personal maps & overlays
  $(".leaflet-control-layers-list .leaflet-control-layers-selector").each(function (idx, elt) {
    const mname = $(elt.parentNode).find("span");
    if (mname && mname.text) {
      const name = mname.text().substring(1);
      const props = WC.getMapListEntryProps(name);
      if (props && (props.in == WC.MAP_MY)) {
        mname.addClass("mymap-name");
      }
    }
  });
  // add "settings" link in map selector
  $(".leaflet-control-layers-base").append(
    "<label><div>&nbsp;<i class='material-icons notranslate'>settings&nbsp;</i><a href='./maps.html'>More...</a></div></label>"
  );
  // add option to automatically close map selector when a listed entry is clicked
  $(".leaflet-control-layers-base").append(
    "<label for='close-on-click'><div><input type='checkbox' id='close-on-click'> Auto close</div></label>"
  );
  WU.setChecked("#close-on-click", mapsCloseOnClick);
  $("#close-on-click").on("change", function () {
    mapsCloseOnClick = WU.isChecked("#close-on-click");
    WC.saveValOpt("wt.mapsCloseOnClick", mapsCloseOnClick);
  });

  // Persist joinOnLoad option
  joinOnLoad = WU.getBoolVal("wt.joinOnLoad", false);
  WU.setChecked("#joinonload", joinOnLoad);
  $("#joinonload").on("change", function () {
    joinOnLoad = WU.isChecked("#joinonload");
    WC.saveValOpt("wt.joinOnLoad", joinOnLoad);
  });

  // ready
  $("#menu-button").on("click", function () {
    if (isMenuVisible()) {
      closeMenu();
    } else {
      openMenu();
    }
    return false;
  });

  // Remove potential query parameters from URL
  WU.clearUrlQuery();

  // handling GPX file handler
  // https://github.com/WICG/file-handling/blob/main/explainer.md
  // https://web.dev/file-handling/
  console.debug("launchQueue: " + window.launchQueue);
  console.debug("launchParams: " + window.launchParams);
  if ('launchQueue' in window && 'files' in LaunchParams.prototype) {
    console.info("We've got a launch file!!!");
    launchQueue.setConsumer((launchParams) => {
      // Nothing to do when the queue is empty.
      if (!launchParams.files.length) {
        return;
      }
      // Handle the files
      fileloader.loadMultiple(launchParams.files);
    });
  }

  $(window).on("unload", function () {
    saveState();
  });

});
