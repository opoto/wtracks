var map;
var track;
var waypoints;
var extremities;
var editLayer;
var route;
var routeStart;
var polystats;

/*
  setInteractive "plugin" from
  https://github.com/Leaflet/Leaflet/issues/5442#issuecomment-424014428
  Thanks https://github.com/Jadaw1n
*/
L.Layer.prototype.setInteractive = function (interactive) {
  if (this.getLayers) {
    arrayForEach(getLayers(), function (idx, layer) {
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

function setStatus(msg, options) {
  $("#status-msg").text(msg);
  var statusclass = options && options.class ? options.class : "status-info";
  $("#status-msg").attr("class", statusclass);
  var showspinner = options && !isUnset(options.spinner) && options.spinner;
  $("#spinner").toggle(showspinner);
  $("#status").fadeIn();
  if (options && options.timeout) {
    setTimeout(clearStatus, 1000 * options.timeout);
  }
}

function clearStatus() {
  $("#status").fadeOut(800);
}

setStatus("Loading...", { spinner: true });

var wtReady = false;
// on ready event (HTML + scripts loaded and executed):
$(function(){
  if (wtReady) {
    onerror("duplicate ready event", {
      "Stack":  new Error().stack
    });
    return;
  }
  wtReady = true;

  consentCookies();

  /* folding settings */
  function toggleElement(e) {
    $("." + this.id.slice(0, -1) + "-toggle").toggle();
  }
  $(".toggle").click(toggleElement);

  /* folding settings */
  function openFolder(id) {
    eltInfo = id.split("-");
    // hide all group
    $(".fold-" + eltInfo[0] + ":not(.fold-link)").hide();
    $(".fold-" + eltInfo[0] + "-closed").show();
    $(".fold-link.fold-" +  eltInfo[0]).removeClass("fold-selected");
    $(".fold-" + eltInfo[0] + "-closed").parent("div").removeClass("fold-selected-title");
    // show
    $("." + eltInfo[1]).show();
    $("#" + eltInfo[0] + "-" + eltInfo[1] + "-closed").hide();
    $("#" + eltInfo[0] + "-" + eltInfo[1]).addClass("fold-selected");
    $("#" + eltInfo[0] + "-" + eltInfo[1]).parent("div").addClass("fold-selected-title");
  }
  $(".fold").click(function(e) { openFolder(e.currentTarget.id); });

  // defaults
  openFolder("file-newtrk");
  openFolder("settings-savstg");

  function updateMapStyle() {
    if (!map.editTools) {
      // editor not yet intialized
      map.options.editOptions.lineGuideOptions.color = trackColor;
      map.options.editOptions.lineGuideOptions.weight = fwdGuide ? trackWeight : 0;
    } else {
      // update editor
      map.editTools.forwardLineGuide.options.color = trackColor;
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

  var NEW_TRACK_NAME = "New Track";
  var EMPTY_METADATA = { name: NEW_TRACK_NAME, desc: "" };

  var metadata = EMPTY_METADATA;
  var prunedist = getVal("wt.prunedist", config.compressdefault);
  var prunealt = getBoolVal("wt.prunealt", false);
  var wptLabel = getBoolVal("wt.wptLabel", config.display.wptLabel);
  var fwdGuide = getBoolVal("wt.fwdGuide", config.display.fwdGuide);
  var fwdGuideGa = true; // collect stats on this user preference
  var extMarkers = getBoolVal("wt.extMarkers", config.display.extMarkers);
  var autoGrayBaseLayer = getBoolVal("wt.autoGrayBaseLayer", config.display.autoGrayBaseLayer);
  var wasDragged;

  var EDIT_NONE = 0;
  var EDIT_MANUAL_TRACK = 1;
  var EDIT_AUTO_TRACK = 2;
  var EDIT_MARKER = 3;
  var EDIT_DRAG = 4;
  var EDIT_DEFAULT = EDIT_MANUAL_TRACK;
  var editMode = -1;

  var mapsCloseOnClick = getBoolVal("wt.mapsCloseOnClick", config.mapsCloseOnClick);

  var apikeys = {};
  arrayForEach(["ghkey", "ggkey", "orskey"], function name(i, kname) {
    apikeys[kname] = getVal("wt."+kname, undefined);
  });

  var apikeyNoMore = getBoolVal("wt.apikeyNoMore", false);

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
  var START_MARKER_ICON = L.icon({
    iconUrl: 'img/marker-start.png',
    iconSize: [17, 17],
    iconAnchor: [8, 8],
    popupAnchor: [0, 0]
  });
  var END_MARKER_ICON = L.icon({
    iconUrl: 'img/marker-end.png',
    iconSize: [17, 17],
    iconAnchor: [8, 8],
    popupAnchor: [0, 0]
  });

  var OFF_KEY = "OFF_";
  function getApiKey(apikey, defkey) {
    return !apikey || apikey.startsWith(OFF_KEY) ? defkey : apikey;
  }
  function getApiKeyVal(apikey) {
    return apikey.replace(OFF_KEY, "");
  }

  // load Google Maps API
  var gk = getApiKey(apikeys.ggkey, config.google.mapsapikey());
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

  let warns = 0;
  function showWarning(title, msg, timeout) {
    let warnElt = $("<div class='warning'>")
    warnElt.append($("<div class='box-header'><span class='warning-title'>" 
      + title + "</span><a href='#' class='close-button'>×</a></div>"))
    let warnMsg = $("<div class='warning-msg'>")
    warnMsg.html(msg)
    warnElt.append(warnMsg)
    $("#warning-box").append(warnElt)
    warns++
    let closeButton = warnElt.find(".close-button")
    closeButton.click(function() {
      warnElt.remove()
      if (--warns <= 0) {
        $("#warning-box").hide();
      }
    })
    $("#warning-box").show();
    /* */
    setTimeout(function() {
      closeButton.click()
    }, timeout ? timeout: 7000);
    /* */
  }
  
  $("#prompt-name").keyup(promptKeyEvent);
  $("#prompt-desc").keyup(promptKeyEvent);

  $("#prompt-ok").click(validatePrompt);
  $("#prompt-cancel").click(closeTrackNamePrompt);
  $("#track-name-edit").click(promptTrackName);

  /* ----------------------------------------------------- */

  function changeApikeyNomore(v) {
    apikeyNoMore = v;
    saveValOpt("wt.apikeyNoMore", apikeyNoMore);
    ga('send', 'event', 'setting', 'keysNomore', undefined, apikeyNoMore ? 1 : 0);
  }

  function openApiKeyInfo(force) {
    if ((force || !apikeyNoMore) && $(".apikeys-dont").length == 0) {
      let apiKeyInfo = $("<a href='doc/#api-keys'>Set your API keys</a> to enable elevation and routing services."
      + "<span class='apikeys-dont'><br /><label class='no-select'>Don't show anymore <input class='apikeys-nomore' type='checkbox'/></label></span>")
      apiKeyInfo.find(".apikeys-dont").toggle(!force);
      apiKeyInfo.find(".apikeys-nomore").change(function(evt) {
        changeApikeyNomore(isChecked(evt.target))
      });
      showWarning("No API key defined", apiKeyInfo, 10000);
    }
  }
  
  /* ----------------------------------------------------- */

  var selectActivity = $("#activity")[0];
  var activities = getJsonVal("wt.activities");
  var loadedActivities = ""; // bug tracking

  function loadActivities() {
    loadedActivities = "Loaded ";
    if (jQuery.isEmptyObject(activities)) {
      activities = config.activities.defaults;
      saveJsonValOpt("wt.activities", activities);
    }
    loadedActivities += " " + Object.keys(activities).length + " activities";
    // append activities
    objectForEach(activities, function(aname, aobj) {
      if (!selectActivity.options[aname]) {
        addSelectOption(selectActivity, aname);
      }
    });
    loadedActivities += " in " + $("#activity option").length + " options";
    // remove deleted activities
    $("#activity option").each(function(i, v) {
      if (!activities[v.value]) {
        v.remove();
      }
    });
    loadedActivities += ", kept " + $("#activity option").length;
  }
  loadActivities();
  selectOption(selectActivity, getVal("wt.activity", Object.keys(activities)[0]));

  function getCurrentActivityName() {
    return getSelectedOption("#activity");
  }

  function getCurrentActivity() {
    var aname = getCurrentActivityName();
    if (!aname) {
      aname = Object.keys(activities)[0];
      var dbgactivities = "";
      $("#activity option").each(function(i, a) {
        i > 0 && (dbgactivities += "; ");
        dbgactivities += (a.innerText + ($(a).is(":selected") ? "*" : ""))
      });
      $("#activity option").each(function(a) {console.log(a)});
      onerror( "No current activity", {
        "Saved": getVal("wt.activity"),
        "First": aname,
        "Nb activities": Object.keys(activities).length,
        "Menu": dbgactivities,
        "Loaded": loadedActivities,
        "Stack":  new Error().stack
      });
      selectOption(selectActivity, aname);
    }
    var cura = activities[aname];
    if (!cura) {
      onerror( "Activity not found", {
        "Activity": aname,
        "Nb activities": Object.keys(activities).length
      });
      if (jQuery.isEmptyObject(activities)) {
        onerror( "No activity");
        loadActivities();
        aname = Object.keys(activities)[0];
        selectOption(selectActivity, aname);
        cura = activities[aname];
      }
    }
    saveValOpt("wt.activity", aname);
    return cura;
  }
  $("#activity").click(loadActivities);
  $("#activity").change(function() {
    ga('send', 'event', 'activity', 'change', getCurrentActivityName());
    polystats.setSpeedProfile(getCurrentActivity().speedprofile);
  });

  /* ------------------------------------------------------------*/

  function forEachSegment(func) {
    var count = 0;
    if (editLayer) {
      arrayForEach(editLayer.getLayers(), function(idx, segment) {
        // check if it is a polyline
        if (segment.getLatLngs) {
          count++;
          return func(segment);
        }
      });
    }
    return count;
  }

  function applySegmentTool(toolFunc) {
    var onAllSegments = isChecked("#allsegments");
    if (onAllSegments) {
      forEachSegment(toolFunc);
    } else {
      toolFunc(track);
    }
  }

  /* ------------------------------------------------------------*/

  function updateTrackStyle() {
    track.setStyle({
      color: trackUI.trk.getColor(),
      weight: trackUI.trk.getWeight()
    });
    track.setInteractive(false);
  }

  function updateOverlayTrackStyle(segment) {
    segment.setStyle({
      color: trackUI.ovl.getColor(),
      weight: trackUI.ovl.getWeight()
    });
    segment.setInteractive(true);
  }

  function updateAllOverlayTrackStyle() {
    forEachSegment(function(segment) {
      // check it is not current track
      if (segment != track) {
        updateOverlayTrackStyle(segment);
      }
    });
  }

  function setPolyStats() {
    polystats = L.polyStats(track, {
      chrono: true,
      speedProfile: getCurrentActivity().speedprofile,
      onUpdate: showStats,
    });
    if (!track.stats) {
      polystats.updateStatsFrom(0);
    }
    showStats();
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
      var mkOpts = {
        title: name,
        alt: name,
        icon: icon,
        keyboard: false,
        interactive: false
      };
      var marker = L.marker([0,0], mkOpts);
      extremities.addLayer(marker);
    }
    extremities = L.featureGroup([]);
    editLayer.addLayer(extremities);
    createExtremity("Start", START_MARKER_ICON);
    createExtremity("End", END_MARKER_ICON);
    setExtrimityVisibility(extMarkers);
  }

  function setExtrimityVisibility(visible) {
    if (extremities) {
      if (visible && extMarkers && (getTrackLength() > 0)) {
        extremities.addTo(map);
      } else {
        extremities.remove();
      }
    }
  }

  function updateExtremity(latlng, i) {
    var eidx = -1;
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
      var last = getTrackLength() - 1;
      if (last >= 0) {
        updateExtremity(track.getLatLngs()[0], 0);
        updateExtremity(track.getLatLngs()[last], last);
      }
    }
  }

  $("#extMarkers").change(function(evt){
    extMarkers = !extMarkers;
    storeVal("wt.extMarkers", extMarkers);
    setExtrimityVisibility(extMarkers);
  });

  function newTrack() {
    metadata = jsonClone(EMPTY_METADATA);
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
    createExtremities();
    setTrackName(NEW_TRACK_NAME);
  }

  // =================== UNDO ====================

  var UNDO_ICON = "undo";
  var EDIT_AUTO_ICON = "navigation";
  var EDIT_AUTO_ID = "edit-auto";
  var EDIT_MANUAL_ICON = "timeline";
  var EDIT_MANUAL_ID = "edit-manual";
  var EDIT_DRAG_ID = "edit-drag";
  var EDIT_DRAG_ICON = "open_with";
  var EDIT_MARKER_ID = "edit-marker";
  var EDIT_ADDSEGMENT_ID = "add-segment";
  var EDIT_ADDSEGMENT_ICON = "add-segment-icon";
  var EDIT_DELSEGMENT_ID = "delete-segment";
  var EDIT_DELSEGMENT_ICON = "delete-segment-icon";

  var UndoRoute = {
    getType: function() {
      return "route";
    },
    init: function(args) {
      this.fromPt = args.fromPt;
    },
    undo: function() {
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
    getIconId: function() {
      return EDIT_AUTO_ID;
    }
  }

  var UndoNewPt = {
    getType: function() {
      return "newPt";
    },
    init: function(args) {
      this.newPt = args.newPt;
    },
    undo: function() {
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
    getIconId: function() {
      return EDIT_MANUAL_ID;
    }
  }

  var UndoMovePt = {
    getType: function() {
      return "movePt";
    },
    init: function(args) {
      this.pt = args.pt;
      this.backupPt = jsonClone(args.pt);
    },
    undo: function() {
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
    getIconId: function() {
      return EDIT_MANUAL_ID;
    }
  }

  var UndoDeletePt = {
    getType: function() {
      return "deletePt";
    },
    init: function(args) {
      this.pt = args.pt;
    },
    undo: function() {
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
    getIconId: function() {
      return EDIT_MANUAL_ID;
    }
  }

  var undos = [];
  function undo() {
    if (undos.length < 1) {
      debug("nothing to undo");
      return;
    }
    var toUndo = undos.pop();
    ga('send', 'event', 'edit', 'undo', toUndo.getType());
    toUndo.undo();
    if (undos.length < 1) {
      endUndo(toUndo.getIconId());
    }
  }
  function addUndo(undoObjectType, args) {
    var newUndo = Object.create(undoObjectType);
    newUndo.init(args);
    undos.push(newUndo);
    if (undos.length == 1) {
      var id = newUndo.getIconId();
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
    var ttip = wpt.getTooltip();
    if (wpt.options.title) {
      if (ttip) {
        // already exists, just update text
        ttip.setContent(wpt.options.title);
      } else{
        // new tooltip
        var ttip = wpt.bindTooltip(wpt.options.title, {permanent: wptLabel});
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
      var div = L.DomUtil.create('div', "popupdiv"),
        label;

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
          setWaypointTooltip(marker);
          var elt = marker.getElement();
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
      var markerDiv = getLatLngPopupContent(latlng, deleteMarker, undefined, undefined, div);
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
      marker.getElement().removeAttribute("title"); // remove default HTML tooltip
      setWaypointTooltip(marker);
      marker.on("click", function() {
        if (editMode == EDIT_DRAG) return;
        pop = L.popup({ "className" : "overlay" })
          .setLatLng(marker.getLatLng())
          .setContent(getMarkerPopupContent(marker))
          .openOn(map);
      });
    }

    return marker;
  }

  $("#wptLabel").change(function(evt){
    wptLabel = !wptLabel;
    storeVal("wt.wptLabel", wptLabel);
    arrayForEach(waypoints.getLayers(), function (idx, wpt) {
      // create new tooltip (they're not mutable!)
      wpt.unbindTooltip();
      setWaypointTooltip(wpt);
    })
  });

  $("#fwdGuide").change(function(evt){
    fwdGuide = !fwdGuide;
    storeVal("wt.fwdGuide", fwdGuide);
    updateMapStyle();
    fwdGuideGa = true;
  });

  /* ------------------------ TRIMMING ---------------------------------- */

  var polytrim;

  function prepareTrim() {
    var trimMax = Math.round(getTrackLength() / 2);
    $("#trim-txt").text("");
    $("#trim-range").attr("max", trimMax);
    $("#trim-range").val(0);
    $('.no-trim:not([class*="isdisabled"])').prop('disabled', false);
    var trimType = $("#trim-type")[0].selectedIndex;
    polytrim = L.polyTrim(track, trimType);
  }

  function trimTrack(e) {
    var n = parseInt($("#trim-range").val());
    log("trimming " + n);
    $("#trim-txt").text(n + "/" + polytrim.getPolySize());
    $('.no-trim:not([class*="isdisabled"])').prop('disabled', (n !== 0));
    polytrim.trim(n);
  }

  function finishTrim() {
    var n = parseInt($("#trim-range").val());
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

  var elevationService;
  var routerFactory;

  function showApiKey(name) {
    var value = apikeys[name];
    var useDefault = isUndefined(getApiKey(value));
    var input = $("#" + name + "-value");
    //debug(name + ": " + value);
    setChecked("#" + name + "-chk", !useDefault);
    input.val(isUndefined(value) ? "" : getApiKeyVal(value));
    input.attr("disabled", useDefault);
  }

  function updateApiKey(name) {
    var useDefault = !isChecked("#" + name + "-chk");
    var key = $("#" + name + "-value").val().trim();
    if (key === "") {
      key = undefined;
    } else if (useDefault) {
      key = OFF_KEY + key;
    }
    var gav = useDefault ? -1 : key ? 1 : 0;
    ga('send', 'event', 'setting', 'keys', name, gav);
    //debug(name + "= " + key + " (" + gav + ")");
    saveValOpt("wt." + name, key);
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

    $("#elevate").prop('disabled', isUnset(elevationService));
    var classOp = elevationService ? "removeClass" : "addClass";
    $("#elevate")[classOp]("isdisabled");
    $("#elevatetxt-help-enable").html(elevationService ? "" :
        "<br><a href='doc/#api-keys'>Set your API keys</a> to enable elevation services.");

    routerFactory = getApiKey(apikeys.ghkey) ?
      createGraphHopperRouter : getApiKey(apikeys.orskey) ?
      createOrsRouter : null;

  }

  function checkApikey(name) {
    var useDefault = !isChecked("#" + name + "-chk");
    $("#" + name + "-value").attr("disabled", useDefault);
    var key = updateApiKey(name);
    return key;
  }

  function apiKeyChange(evt) {
    var keyname = evt.target.id.match(/^[^\\-]+/)[0];
    apikeys[keyname] = checkApikey(keyname);
    updateApiServices();
  }
  $(".key-chk").on("change", apiKeyChange);
  $(".key-value").on("focusout", apiKeyChange);

  function resetApiKey(name) {
    setChecked("#" + name + "-chk", false);
    $("#" + name + "-value").val("");
    $("#" + name + "-chk").change();
  }

  $("#keys-reset").on("click", function() {
    ga('send', 'event', 'setting', 'keys', 'reset');
    objectForEach(apikeys, function name(kname, kval) {
      resetApiKey(kname);
    });
  });

  objectForEach(apikeys, function name(kname, kval) {
    showApiKey(kname);
  });
  updateApiServices();

  $("#apikeys-suggest").change(function() {
    changeApikeyNomore(!isChecked("#apikeys-suggest"));
  });

  /* ------------------------ MENU ---------------------------------- */

  function closeMenu() {
    if (! $("#menu").is(":hidden")) {
      $("#menu").hide();
      finishTrim();
    }
  }

  function openMenu(tab) {
    if (isMenuVisible()) return;
    setEditMode(EDIT_NONE);
    setChecked("#merge", false);
    setChecked("#apikeys-suggest", !apikeyNoMore);
    setChecked("#fwdGuide", fwdGuide);
    setChecked("#wptLabel", wptLabel);
    setChecked("#extMarkers", extMarkers);
    setChecked("#autoGrayBaseLayer", autoGrayBaseLayer);
    prepareTrim();
    $("#prunedist").val(prunedist);
    setChecked("#prunealt", prunealt);
    menu(tab ? tab : "file");
    if (($("#savetimingdate input").val() == "")
      && (getTrackLength() > 0)
      && track.getLatLngs()[0].time) {
        $("#savetimingdate input").val(track.getLatLngs()[0].time.substring(0,16));
    }
  }
  function isMenuVisible() {
    return $("#menu").is(":visible");
  }

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

  function LatLngToGPX(ptindent, latlng, gpxelt, properties) {

    var gpx = ptindent + "<" + gpxelt;
    gpx += " lat=\"" + latlng.lat + "\" lon=\"" + latlng.lng + "\">";
    if (!isNaN(latlng.alt)) {
      gpx += "<ele>" + latlng.alt + "</ele>";
    }
    if (properties.time) {
      gpx += "<time>" + properties.time + "</time>";
    }
    if (properties.title) {
      gpx += "<name>" + htmlEncode(properties.title) + "</name>";
    }
    if (properties.cmt) {
      gpx += "<cmt>" + htmlEncode(properties.cmt) + "</cmt>";
    }
    if (properties.desc) {
      gpx += "<desc>" + htmlEncode(properties.desc) + "</desc>";
    }
    if (properties.ext) {
      gpx += "\n" + ptindent + "  <extensions>";
      gpx += properties.ext;
      gpx += "</extensions>\n" + ptindent;
    }
    gpx += "</" + gpxelt + ">\n";
    return gpx;
  }

  function getSegmentGPX(segment, ptindent, pttag, startdate) {
    var gpx = "";
    var latlngs = segment ? segment.getLatLngs() : undefined;
    if (latlngs && latlngs.length > 0) {
      var j = 0;
      while (j < latlngs.length) {
        var pt = latlngs[j];
        var time = pt.time;
        try {
          if (startdate && Date.prototype.toISOString && !isUndefined(pt.chrono)) {
            time = new Date(startdate + (pt.chrono * 1000)).toISOString();
          }
        } catch (error) {
          onerror('Failed to build ISO time', {
            "Error": error,
            "Chrono": pt.chrono
          });
        }
        gpx += LatLngToGPX(ptindent, pt, pttag, { 'time': time, 'ext' : pt.ext });
        j++;
      }
    }
    return gpx;
  }

  function getGPX(trackname, savealt, savetime, asroute, nometadata) {

    var startdate = new Date();
    if (savetime) {
      // get track's start date from user input
      var startStr = $("#savetimingdate input").val().trim().replace(" ", "T");
      if (startStr) try {
        // browser uses text input, parse it
        var b = startStr.split(/\D/);
        startdate = new Date(b[0], b[1]-1, b[2], b[3], b[4]);
        startdate.toISOString(); // make sure it works
      } catch(err) {
        // use current date in case of error
        error("Invalid start date: " + startStr + ". Using current date");
        startdate = new Date();
      }
    }
    var xmlname = "<name>" + htmlEncode(trackname) + "</name>";
    var gpx = '<\?xml version="1.0" encoding="UTF-8" standalone="no" \?>\n';
    gpx += '<gpx creator="' + config.appname + '"\n';
    gpx += '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" version="1.1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"';

    // xmlns from each segment
    var xmlnsArr = [];
    arrayForEach(editLayer.getLayers(), function(idx, segment) {
      if (segment.xmlnsArr && segment.xmlnsArr.length) {
        for (var i = 0; i < segment.xmlnsArr.length; i++) {
          var item = segment.xmlnsArr[i];
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
      gpx += "  <desc>" + (metadata.desc ? htmlEncode(metadata.desc) : "") + "</desc>\n";
      gpx += "  <author><name>" + config.appname + "</name></author>\n";
      gpx += "  <link href='" + window.location.href + "'>\n";
      gpx += "    <text>" + config.appname + "</text>\n";
      gpx += "    <type>text/html</type>\n";
      gpx += "  </link>\n";
      gpx += "  <time>" + startdate.toISOString() + "</time>\n";
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
        gpx += LatLngToGPX("", wpt.getLatLng(), "wpt", wpt.options);
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

    startdate = startdate.getTime();
    var selectedSegment = track;
    // for each segment
    forEachSegment(function(segment) {
      segmentClickListener({ target: segment }, true);
      // check if it is a polyline
      if (segtag) {
        gpx += "  <" + segtag + ">\n";
      }
      gpx += getSegmentGPX(segment, ptindent, pttag, savetime ? startdate : undefined);
      if (segtag) {
        gpx += "  </" + segtag + ">\n";
      }
      if (savetime) {
        var lastPt = segment.getLatLngs().slice(-1)[0];
        if (lastPt && !isUndefined(lastPt.chrono)) {
          // start date of next segment (if any) is the end of current segment
          startdate = new Date(startdate + (lastPt.chrono * 1000)).getTime();
        }
      }
    });
    segmentClickListener({ target: selectedSegment }, true);

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

  function savetimingChanged() {
    $("#savetimingdate").toggle(isChecked("#savetiming"));
  }
  $("#savetiming").change(savetimingChanged);
  $("#savetimingdate input").keyup(function(event) {
    var startStr = $("#savetimingdate input").val();
    if (startStr && !/^([0-2][0-9]{3}-[0-1][0-9]-[0-3][0-9][ T][0-2][0-9]:[0-5][0-9])$/.test(startStr)) {
      $("#savetimingdate input").addClass("invalid");
    } else {
      $("#savetimingdate input").removeClass("invalid");
    }
  });
  savetimingChanged();

  $("#track-download").click(function() {
    setEditMode(EDIT_NONE);
    setStatus("Formatting..", { spinner: true });
    var gpx = getTrackGPX(true);
    ga('send', 'event', 'file', 'save', undefined, Math.round(gpx.length / 1000));
    try {
      var blob = new Blob([gpx],
        isSafari() ? {type: "text/plain;charset=utf-8"} : {type: "application/gpx+xml;charset=utf-8"}
      );
      saveAs(blob, getTrackName() + ".gpx");
      clearStatus();
    } catch (err) {
      setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
    }
    closeMenu();
  });

  //---------------------------------------------------
  // Share

  $("#track-share").click(function() {
    closeMenu();
    $("#wtshare-map-name").text(baseLayer);
    $("#wtshare-ask").show();
    $("#wtshare-processing").hide();
    $("#wtshare-done").hide();
    $("#wtshare-val").val("");
    $("#wtshare-box").show();
    $("#wtshare-start").focus();
    if (isCryptoSupported()) {
      $(".if-encrypt").show();
    }
  });
  function closeShareBox(){
    $("#wtshare-box").hide();
  }
  $("#wtshare-box-close").click(closeShareBox);
  $("#wtshare-cancel").click(closeShareBox);
  $("#wtshare-ok").click(closeShareBox);

  function uploadClicked(){
    $("#wtshare-ask").hide();
    $("#wtshare-processing").show();
    var gpx = getTrackGPX(true);
    var params = "";
    if (isChecked("#wtshare-map")) {
      params += "&map=" + encodeURIComponent(baseLayer);
      overlays = []
      objectForEach(overlaysOn, function(oname, oon) {
        if (oon) overlays.push(oname);
      });
      params += "&overlays=" + encodeURIComponent(overlays.join(','));
    }
    if (isChecked("#wtshare-enc")) {
      var pwd = Math.random().toString(36).substring(2);
      aesGcmEncrypt(gpx, pwd)
      .then(function(cipher) {
        //log("iv  : " + cipher.iv);
        //log("pwd : " + pwd);
        var encversion = "01";
        params += "&key=" + encversion + strencode(cipher.iv + pwd);
        gpx = cipher.ciphertext;
        ga('send', 'event', 'file', 'encrypt', undefined, Math.round(gpx.length / 1000));
        shareGpx(gpx, params, "cipher-yes");
      })
      .catch(function(err) {
        onerror('Crypto-encrypt :' + err);
        setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
        $("#wtshare-box").hide();
      });
    } else {
      shareGpx(gpx, params, isCryptoSupported() ? "cipher-no" : "cipher-unavailable");
    }
  }

  function uploadFailed(share, gpx, error) {
    var errmsg = error.statusText || error;
    var gpxkb = Math.round(gpx.length / 1000);
    onerror('Upload failed', {
      "Lib" : share.name,
      "Error": errmsg,
      "GPX KB": gpxkb
    });
    alert("Upload failed, is file too big? Your file is "
     + gpxkb + "KB while " + share.name + " accepts " + share.maxSize
     + ". Try to reduce it using Tools/Compress");
    setStatus("Failed: " + errmsg, { timeout: 5, class: "status-error" });
  }

  function shareGpx(gpx, params, cryptoMode) {
    ga('send', 'event', 'file', 'share', share.name + ', ' + cryptoMode, Math.round(gpx.length / 1000));
    share.upload(
      getTrackName(), gpx,
      function (gpxurl, rawgpxurl) {
        var url = window.location.toString();
        url = url.replace(/#+.*$/,""); // remove fragment
        url = url.replace(/\?.*$/,""); // remove parameters
        url = url.replace(/index\.html$/,""); // remove index.html
        url = url.replace(/\/*$/,"/"); // keep 1 and only 1 trailing /
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
      }, function(error) {
        uploadFailed(share, gpx, error);
        $("#wtshare-box").hide();
      });
  }

  function showQRCode(e){
    $("#wtshare-links").hide();
    $("#wtshare-qrcode").show();
    return false;
  }
  function hideQRCode(e){
    $("#wtshare-links").show();
    $("#wtshare-qrcode").hide();
    return false;
  }

  $("#wtshare-start").click(uploadClicked);
  $("#wtshare-viewqr").click(showQRCode);
  $("#wtshare-back").click(hideQRCode);

  function closeShareBoxOnEscape(event) {
    if (event.which == 27) {
      closeShareBox();
      event.stopPropagation();
    }
  }
  $("#wtshare-start").keyup(closeShareBoxOnEscape);
  $("#wtshare-cancel").keyup(closeShareBoxOnEscape);
  $("#wtshare-val").keyup(closeShareBoxOnEscape);
  $("#wtshare-ok").keyup(closeShareBoxOnEscape);

  var sharename = getVal("wt.share", undefined);
  var share = (sharename && pastesLib[sharename]) || pastesLib[Object.keys(pastesLib)[0]];

  // fileio automatically deletes paste after download, perfect for dropbox use case
  var dropboxTempShare = pastesLib.fileio;
  //var dropboxTempShare = sharename ? pastesLib[sharename] : pastesLib.fileio;

  //---------------------------------------------------

  function setInactiveSegmentClickable(clickable) {
    forEachSegment(function(segment) {
      if (segment != track) {
        segment.setInteractive(clickable);
      }
    });
  }

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
    routeStart = undefined;
    if (!route) return;
    var initlen = getTrackLength();
    var pts = route._selectedRoute ? route._selectedRoute.coordinates : undefined;
    if (pts && (pts.length > 0)) {
      pts = L.PolyPrune.prune(pts, { tolerance: config.compressdefault, useAlt: true });
      ga('send', 'event', 'edit', 'merge', undefined, pts.length);
      for (var j = 0; j < pts.length; j++) {
        track.addLatLng(pts[j]);
      }
      updateExtremities();
      elevate(pts, function(success) {
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
      "<a href='https://openrouteservice.org'>OpenRoute Service</a>" ;
    $("#map").append("<span class='routing-credit'>Powered by " + credit + "</span>");
  }

  function hideRoutingCredit() {
    $(".routing-credit").remove();
  }

  function showRoutingError(msg) {
    setStatus(msg, { timeout: 5, class: "status-error" });
  }

  function enterDragMode() {
    setExtrimityVisibility(true);
    track.setInteractive(true);
    track.on("dragend", function(e) {
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
        toolCleanup(["alt"]);
        toolElevate();
        // 2. update stats
        polystats.updateStatsFrom(0);
      }
      ga('send', 'event', 'edit', 'drag-track', reelevate);
    }
  }

  function setEditMode(mode) {
    closeOverlays();
    if (mode === editMode) {
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
    switch (editMode) {
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
    setExtrimityVisibility(false);
    switch (mode) {
      case EDIT_NONE:
        setExtrimityVisibility(true);
        setInactiveSegmentClickable(true);
        break;
      case EDIT_MANUAL_TRACK:
        $("#" + EDIT_MANUAL_ID).addClass("control-selected");
        try {
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
            "points" : track.getLatLngs().length,
            "wasMode" : wasMode,
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
        setExtrimityVisibility(true);
        $("#" + EDIT_MARKER_ID).addClass("control-selected");
        $("#map").css("cursor", "url(img/marker-icon.cur),text");
        $("#map").css("cursor", "url(img/marker-icon.png) 7 25,text");
        editableWaypoints(true);
        setInactiveSegmentClickable(false);
        break;
      default:
        error("invalid edit mode: " + mode);
        return;
    }
    editMode = mode;
    saveEditMode();
    $("#edit-tools").toggle(editMode > 0);
  }

  $("#compress").click(function() {

    // get & check input value
    var prunedistelt = $("#prunedist");
    var input = prunedistelt.val().trim();
    if (input && input.match(/^\d+\.?\d*$/)) {
      prunedist = parseFloat(input);
    } else {
      input = undefined;
    }
    if (!input || (prunedist === undefined) || isNaN(prunedist)) {
      alert("Enter distance in meters");
      prunedistelt.focus();
      return;
    }
    if (isImperial()) {
      prunedist *= 0.9144;
    }
    prunealt = isChecked("#prunealt");

    saveValOpt("wt.prunedist", prunedist);
    saveValOpt("wt.prunealt", prunealt);

    if (track) {

      var removedpts = 0;
      var totalpts = 0;

      applySegmentTool(function (segment) {
        var pts = segment.getLatLngs();
        var pruned = L.PolyPrune.prune(pts, { tolerance: prunedist, useAlt: prunealt });
        totalpts += pts.length;
        var reduced = pts.length - pruned.length;
        if (reduced > 0) {
          // switch to new values
          removedpts += reduced;
          segment.setLatLngs(pruned);
          if (segment == track) {
            polystats.updateStatsFrom(0);
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

  function joinSegments() {
    var seg1;
    var count = forEachSegment(function(segment) {
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
      segmentClickListener({target: seg1}, true);
      saveState();
      polystats.updateStatsFrom(0);
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
    $.get(config.ipLookup.url())
    .done(function(res) {
      setLocation({
        lat: res.lat,
        lng: res.lon
      }, false);
    })
    .fail(function(jqxhr, settings, exception) {
      showWarning("IP Geolocation failed", "Do you you have an ad blocker?<br>Try deactivating it on this page to get geolocation working.")
    });
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
    showLocation = LOC_ONCE;

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


    if (false && navigator.geolocation) {
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
    // Count points to save
    // 1. waypoints
    var numPts = waypoints.getLayers().length;
    // 2. All segment points
    forEachSegment(function(segment) {
        numPts += segment.getLatLngs().length;
    });
    // Don't save if more than 1500 points
    if (numPts < 1500) {
      var gpx = getGPX(trackname, /*savealt*/ false, /*savetime*/ false, /*asroute*/ false, /*nometadata*/ false);
      saveValOpt("wt.gpx", gpx);
    }
  }

  function saveSettings() {
    saveValOpt("wt.activity", getCurrentActivityName());
    saveJsonValOpt("wt.activities", activities);
    saveValOpt("wt.baseLayer", baseLayer);
    objectForEach(apikeys, function name(kname, kval) {
      saveValOpt("wt."+kname, kval);
    });
    saveValOpt("wt.joinOnLoad", joinOnLoad);
    saveJsonValOpt("wt.mymaps", mymaps);
    saveJsonValOpt("wt.overlaysOn", overlaysOn);
    saveValOpt("wt.ovlTrackColor", ovlTrackColor);
    saveValOpt("wt.ovlTrackWeight", ovlTrackWeight);
    saveValOpt("wt.lengthUnit", lengthUnit);
    saveValOpt("wt.trackColor", trackColor);
    saveValOpt("wt.trackWeight", trackWeight);
    saveValOpt("wt.prunedist", prunedist);
    saveValOpt("wt.prunealt", prunealt);
    saveValOpt("wt.mapslist", mapsList);
    saveValOpt("wt.mapsCloseOnClick", mapsCloseOnClick);
    saveValOpt("wt.apikeyNoMore", apikeyNoMore);
    saveValOpt("wt.fwdGuide", fwdGuide);
    saveValOpt("wt.wptLabel", wptLabel);
    saveValOpt("wt.extMarkers", extMarkers);
    saveValOpt("wt.autoGrayBaseLayer", autoGrayBaseLayer);
  }

  function saveStateFile() {
    var fullState = {};
    var n = localStorage.length;
    for (i = 0; i < n; i++) {
      var key = localStorage.key(i);
      // include all "wt." storage items
      // but exclude current edited track
      if (key.startsWith("wt.") && (key != "wt.gpx")) {
        var val = localStorage.getItem(key);
        fullState[key] = val;
      }
    }
    var blob = new Blob([JSON.stringify(fullState)],
      isSafari() ? {type: "text/plain;charset=utf-8"} : {type: "application/json;charset=utf-8"}
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
    objectForEach(state, function (name, value) {
      if (name.startsWith("wt.")) {
        saveValOpt(name, value);
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
      reader.onload = function(le) {
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
    setLocation(defpos);
  }

  function restoreTrack() {
    var gpx = getVal("wt.gpx", null);
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
    for (var i=localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (key.startsWith("wt.") && (key != "wt.saveState")) {
        storeVal(key, undefined);
      }
    }
  }

  function getProvider(mapobj) {
    var url = typeof mapobj.url === "string" ? mapobj.url : mapobj.url();
    var p = null;
    var protocol = url.split('/')[0];
    // skip HTTP URLs when current is HTTPS
    if ((protocol.length == 0) || (protocol == "https:") || (location.protocol == "http:")) {
      var tileCtor;
      var mapopts = mapobj.options;
      // By default, extend zoom range with down- & up-sampling
      if (mapopts.minZoom && !mapopts.minNativeZoom) {
        mapopts.minNativeZoom = mapopts.minZoom
        mapopts.minZoom = mapopts.minZoom - 1
      }
      if (mapopts.maxZoom && !mapopts.maxNativeZoom) {
        mapopts.maxNativeZoom = mapopts.maxZoom
        mapopts.maxZoom = mapopts.maxZoom + 2
      }
      if (isUnset(mapobj.type) || (mapobj.type === "base") || (mapobj.type === "overlay")) {
        tileCtor = L.tileLayer;
      } else if (mapobj.type === "pmtiles") {
        const pmTileCtor = new PMTiles(url,{allow_200:true})
        p = pmTileCtor.leafletLayer(mapopts)
      } else {
        tileCtor = L.tileLayer[mapobj.type];
        if (mapobj.type === "wms" && mapopts.crs) {
          // warning: no deep copy
          mapopts = jsonClone(mapopts);
          mapopts.crs = getCrsFromName(mapopts.crs);
        }
      }
      if (tileCtor) {
        p = tileCtor(url, mapopts);
      }
    }
    return p;
  }

  // Add maps and overlays
  var baseLayers = {};
  var overlays = {};
  var baseLayer = getVal("wt.baseLayer", config.display.map);
  var requestedMap = getParameterByName("map");
  var requestedOverlays = getParameterByName("overlays")?.split(',');
  mapsForEach(function(name, props) {
    if (props.on ||  name == baseLayer || name === requestedMap || requestedOverlays?.includes(name)) {
      var inList = props.in == MAP_MY ? mymaps : config.maps;
      var tile = getProvider(inList[name]);
      if (tile) {
        // TODO: "overlay" type is a deprecated legacy, should be discarded in Dec 2022
        if ((inList[name].type === "overlay") || (inList[name].overlay)) {
          tile.options.className = "blend-multiply";
          overlays[name] = tile;
        } else {
          baseLayers[name] = tile;
        }
      }
    }
  });

  var baseLayerControl = L.control.layers(baseLayers, overlays);
  baseLayerControl.addTo(map);

  // ----------------------

  var initialLayer = baseLayers[baseLayer] || baseLayers[config.display.map];
  if (!initialLayer) {
    //var availableLayerNames = "";
    objectForEach(baseLayers, function(name) {
      //availableLayerNames += name + "; ";
      if (!initialLayer) {
        initialLayer = baseLayers[name]; // use first one
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
    if (mapsCloseOnClick) {
      $(".leaflet-control-layers").removeClass("leaflet-control-layers-expanded");
    }
    setAutoGrayBaseLayer(e.layer);
  });
  map.on('zoomstart zoom zoomend', function(ev){
    debug('Zoom level: ' + map.getZoom());
  })

  function changeBaseLayer(mapname) {
    var found = false;
    $(".leaflet-control-layers-base .leaflet-control-layers-selector").each(function(idx,elt) {
      if (mapname === elt.nextSibling.innerText.substring(1)) {
        $(elt).click();
        found = true;
        return false; // stop each loop
      }
    });
    if (!found) {
      // map is missing, inform user
      setTimeout(function(){
        setStatus("Requested map not visible/configured: " + mapname, { timeout: 5, class: "status-error" });
      }, 4000);
    }
  }

  var overlaysOn = getJsonVal("wt.overlaysOn", {});

  function setOverlay(name, yesno) {
    overlaysOn[name] = yesno;
    saveJsonValOpt("wt.overlaysOn", overlaysOn);
    setAutoGrayBaseLayer(null)
  }

  /********* Overlay opacity control *************/
  function addOpacityControl(ovlname, ovl) {
    var layerId = L.Util.stamp(ovl);
    var initialOpacity = isUndefined(ovl.options.opacity) ? 1 : ovl.options.opacity*1
    // add slider
    var slider = $('<input class="overlay-opacity-slider" type="range" min="0" max="100" value="'
       + initialOpacity*100 + '"></input>')
    .insertAfter($(".leaflet-control-layers-overlays span:contains('" + ovlname + "')"))
    slider.on("change", function(evt) {
      // search layer
      objectForEach(map._layers, function(lId, layer) {
        if (layer && L.Util.stamp(layer) === layerId) {
          // set opacity
          layer.setOpacity(Number(evt.target.value / 100));
          return true;
        }
      });
    });
  }
  function removeOpacityControl(ovlname,ovl) {
    // remove slider
    $(".leaflet-control-layers-overlays span:contains('" + ovlname + "')")
    .parent()
    .find(".overlay-opacity-slider")
    .remove()
  }

  if (requestedOverlays) {
    requestedOverlays.forEach(function(oname) {
      var ovl =  overlays[oname];
      if (ovl) {
        map.addLayer(ovl);
      }
    });
  } else {
    objectForEach(overlaysOn, function(oname, oon) {
      var ovl =  overlays[oname];
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

  map.on("overlayadd", function(e) {
    ga('send', 'event', 'map', 'overlay', e.name);
    setOverlay(e.name, true);
    setTimeout(function(){
      addOpacityControl(e.name, overlays[e.name]);
    },100);
  });

  map.on("overlayremove", function(e) {
    setOverlay(e.name, false);
    removeOpacityControl(e.name);
  });

  $("#autoGrayBaseLayer").change(function(evt){
    autoGrayBaseLayer = !autoGrayBaseLayer;
    storeVal("wt.autoGrayBaseLayer", autoGrayBaseLayer);
    setAutoGrayBaseLayer(null);
  });

  function hasOverlaysOn() {
    return Object.values(overlaysOn).some(oon => oon);
  }
  function setAutoGrayBaseLayer(layer) {
    if (!layer) {
      const layerId = L.Util.stamp(baseLayers[baseLayer]);
      layer = map._layers[layerId];
    }
    const container = layer.getContainer()
    if (container) {
      if (autoGrayBaseLayer && hasOverlaysOn()) {
        container.classList.add('filter-grayscale');
      } else {
        container.classList.remove('filter-grayscale');
      }
    }
  }

  setLocation({lat: 0, lng: 0}); // required to initialize map

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
      if (status === google.maps.ElevationStatus.OK) {
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
        done("gg.elevate.ok");
      } else {
        fail('gg.elevate.ko', status);
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
      ajaxreq = {
        url: "https://api.open-elevation.com/api/v1/lookup?locations=" + strpts,
        method: "GET",
        timeout: config.elevationTimeout,
      };
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
        timeout: config.elevationTimeout,
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
      done("oe.elevate.ok");
    })
    .fail(function(err, msg) {
      fail('oe.elevate.ko', msg ? msg : err.status);
    });
  }


  // https://openrouteservice.org/dev/#/api-docs/elevation/line/post
  function orsElevationService(locations, points, inc, done, fail) {
    var i, len,
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
          "geometry": [ locations[0].lng, locations[0].lat ]
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
          points.alt = json.geometry.coordinates[2];
          done('ors.elevate1.ok');
        } else {
          // "Server error"
          fail('ors.elevate1.ko', (json.message ? json.message + ". ": "") + "Area not covered?");
        }
      })
      .fail(function(err) {
        var errmsg = "";
        if (err.responseJSON && err.responseJSON.message) {
          errmsg = err.responseJSON.message;
        } else {
          if (err.error) {
            errmsg = err.error + ". ";
          } else {
            errmsg = "Request failed. ";
          }
          errmsg += "Check API key"
        }
        fail('ors.elevate1.ko', errmsg);
      });
      return;
    }
    // multi-points
    for (i = 0, len=locations.length; i < len; i++) {
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
    .done(function(json) {
      if (json.geometry && json.geometry[0]) {
        var results = json.geometry;
        for (var i = 0; i < results.length; i++) {
          var pos = i * inc;
          if (pos >= points.length) {
            // we reached last point from track
            pos = points.length - 1;
          }
          points[pos].alt = results[i][2];
        }
        done("ors.elevate.ok");
      } else {
          // "Server error"
          fail('ors.elevate.ko', (json.message ? json.message + ". ": "") + "Area not covered?");
      }
    })
    .fail(function(err) {
      var errmsg;
      if (err.responseJSON && err.responseJSON.message) {
        errmsg = err.responseJSON.message;
      } else {
        errmsg = "Request failed. Check API key"
      }
      fail('ors.elevate.ko', errmsg);
    });
  }

  // multi-point elevation API
  function elevatePoints(points, cb) {
    if (!elevationService) {
      // no elevation service configured, go directly to callback
      if (cb) cb(true);
      return;
    }
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
        if (cb) cb(true);
      },
      function(eventName, msg){
        ga('send', 'event', 'api', eventName,
          JSON.stringify({ "op": callerName, "msg": msg}), locations.length);
        warn("elevation request failed: " + msg);
        setStatus("Elevation failed (" + msg + ")" , {
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
      profile: getCurrentActivity().vehicle == "foot" ? "foot-hiking" : "cycling-regular",
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
      { urlParameters: { vehicle: getCurrentActivity().vehicle } }
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
    customIcon: L.divIcon({html:'<span class="material-icons notranslate">search</span>'}),
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
      link.title = 'My location (l)';
      link.innerHTML = '<span id="myloc" class="material-icons wtracks-control-icon notranslate">my_location</span>';
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
    var elt = document.activeElement;
    var tag = elt ? elt.tagName.toLowerCase() : undefined;
    if ((tag == "input") || (tag == "textarea")) {
      return true;
    }
    return false;
  }

  function openedOverlays() {
    return $(".overlay:visible").length;
  }

  $("body").keydown(function(event) {
    // number of currently opened overlays
    nOverlays = openedOverlays();
    // ignore control keys
    if (event.which == 17) return;
    // on escape
    if ((event.which == 27) && (nOverlays == 1)) {
      if (isMenuVisible()) {
        // close menu
        closeMenu();
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
    //console.log("key: ", event.which)
    switch (event.which) {
      case 27: // escape - exit edit tool
        if (editMode == EDIT_NONE) {
          openMenu();
        } else {
          setEditMode(EDIT_NONE);
        }
        break;
      case 69: // 'e' - edit
        if (editMode != EDIT_MANUAL_TRACK) {
          $("#" + EDIT_MANUAL_ID).click();
        }
        break;
      case 65: // 'a' - auto
        if (editMode != EDIT_AUTO_TRACK) {
          $("#" + EDIT_AUTO_ID).click();
        }
        break;
      case 87: // 'w' - waypoint
        $("#" + EDIT_MARKER_ID).click();
        break;
      case 70: // 'f' - find address
        $(".glass")[0].click();
        return false;
      case 76: // 'l' - my location
        showLocation = LOC_ONCE;
        gotoMyLocation();
        break;
      case 77: // 'm' - move/drag
        $("#" + EDIT_DRAG_ID).click();
        break;
      case 113: // 'F2' - rename
        promptTrackName();
        break;
      case 90: // 'z' - undo
        undo();
        break;
      case 84: // 't' - Tools
        openMenu("tools");
        break;
    }
  });


  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_MANUAL_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_AUTO_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_MARKER_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_ADDSEGMENT_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_DELSEGMENT_ID));
  L.DomEvent.disableClickPropagation(L.DomUtil.get(EDIT_DRAG_ID));
  $("#" + EDIT_MANUAL_ID).click(function(e) {
    e.preventDefault();
    if (editMode == EDIT_MANUAL_TRACK) {
      undo();
    } else {
      ga('send', 'event', 'edit', 'manual');
      setEditMode(EDIT_MANUAL_TRACK);
    }
  });
  $("#" + EDIT_AUTO_ID).click(function(e) {
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
  $("#" + EDIT_MARKER_ID).click(function(e) {
    e.preventDefault();
    ga('send', 'event', 'edit', 'marker');
    setEditMode(EDIT_MARKER);
  });
  $("#" + EDIT_ADDSEGMENT_ID).click(function(e) {
    e.preventDefault();
    // shortcut
    if ((editMode == EDIT_MANUAL_TRACK) && getTrackLength() == 0) {
      // current track is empty, just use it
      return;
    }
    ga('send', 'event', 'edit', 'new-segment');
    setEditMode(EDIT_NONE);
    newSegment();
    setEditMode(EDIT_MANUAL_TRACK);
    saveState();
  });

  $("#" + EDIT_DELSEGMENT_ID).click(function(e) {
    e.preventDefault();
    if ((getTrackLength() == 0) ||
      !confirm("Delete current segment?")) {
      return;
    }
    ga('send', 'event', 'edit', 'delete-segment');
    deleteSegment(track);
    saveState();
  });
  $("#" + EDIT_DRAG_ID).click(function(e) {
    e.preventDefault();
    setEditMode(EDIT_DRAG);
  });

  function selectFirstSegment() {
    forEachSegment(function(segment) {
      segmentClickListener({ target: segment }, true);
      // stop on first segment
      return true;
    });
  }

  function deleteSegment(segment) {
    setEditMode(EDIT_NONE);
    if (editLayer.getLayers().length > 2) {
      editLayer.removeLayer(segment);
      track = null;
      selectFirstSegment();
      if (!track) {
        newSegment();
        setEditMode(EDIT_MANUAL_TRACK);
      }
    } else {
      segment.setLatLngs([]);
      polystats.updateStatsFrom(0);
      setEditMode(EDIT_MANUAL_TRACK);
    }
  }

  function toolElevate(e) {
    if (e) {
      ga('send', 'event', 'tool', 'elevate', undefined, getTrackLength());
      $("#menu").hide();
    }

    setStatus("Elevating...", { spinner: true });
    var count = 0;
    applySegmentTool(function (segment) {
      count++;
      elevate(segment.getLatLngs(), function(success) {
        if (segment == track) {
          polystats.updateStatsFrom(0);
        }
        if (--count == 0) {
          saveState();
          if (success) {
            clearStatus();
          }
        }
      });
    });

    return false;
  }

  $("#elevate").click(toolElevate);

  function toolCleanup(toclean) {
    var count = 0;
    applySegmentTool(function(segment) {
      var points = segment ? segment.getLatLngs() : undefined;
      if (points && (points.length > 0)) {
        count += points.length;
        for (var i = 0; i < points.length; i++) {
          for (var j = 0; j < toclean.length; j++) {
            points[i][toclean[j]] = undefined;
          }
        }
        if (segment == track) {
          polystats.updateStatsFrom(0);
        }
      }
    });
    return count;
  }

  $("#cleanup").click(function(e) {
    var toclean = [];
    if (isChecked("#cleanupalt")) {
      toclean.push("alt");
    }
    if (isChecked("#cleanuptime")) {
      toclean.push("time");
    }
    if (toclean.length == 0) {
      // nothing to clean
      return;
    }
    var count = toolCleanup(toclean);
    if (count) {
      ga('send', 'event', 'tool', 'cleanup', toclean.toString(), count);
      saveState();
    }
    return false;
  });

  $("#revert").click(function(e) {
    var count = 0;
    applySegmentTool(function (segment) {
      var points = segment ? segment.getLatLngs() : undefined;
      if (points && (points.length > 0)) {
        var newpoints = [];
        count += points.length;
        for (var i = points.length - 1; i >= 0; i--) {
          newpoints.push(points[i]);
        }
        segment.setLatLngs(newpoints);
        if (segment == track) {
          polystats.updateStatsFrom(0);
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

  $(".statistics").click(function(e) {
    var tag = e.target.tagName.toUpperCase();
    if ((tag !== "SELECT") && (tag !== "OPTION")) {
      toggleElevation(e);
    }
  });

  function segmentClickListener(event, noGaEvent) {
    if ((event.target != track)
    && ((editMode <= EDIT_NONE) || (editMode == EDIT_DRAG))) {
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
    var merge = loadCount > 0 || isChecked("#merge");
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
      if (!isUndefined(time)) {
        point.time = time;
      }
      if (!isUndefined(ext)) {
        point.ext = ext;
      }
      if (!isUndefined(i)) {
        point.i = i;
      }
      return point;
    }

    function importSegment(name, coords, times, ptExts, xmlnsArr) {
      var v;

      if (joinOnLoad || getTrackLength() == 0) {
        // extend current 'track'
        track.stats = undefined;
      } else {
        newSegment(true);
      }
      v = track.getLatLngs();
      if ((v.length === 0) && (getTrackName() == NEW_TRACK_NAME)) {
        setTrackName(name);
      }

      // import polyline vertexes
      for (var i = 0; i < coords.length; i++) {
        v.push(newPoint(coords[i],
          times ? times[i] : undefined,
          ptExts ? ptExts[i] : undefined,
          i));
      }
      track.setLatLngs(v);
      bounds.extend(track.getBounds());

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
      onEachFeature: function(f) {
        var name, coords, times, ptExts, xmlnsArr;
        if (f.geometry.type === "LineString") {
          name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
          coords = f.geometry.coordinates;
          times = f.properties.coordTimes && (f.properties.coordTimes.length == coords.length) ?
            f.properties.coordTimes : undefined;
          ptExts = f.properties.ptExts
            && (f.properties.ptExts.length == coords.length) ?
            f.properties.ptExts : undefined;
          xmlnsArr = f.properties.xmlnsArr;
          importSegment(name, coords, times, ptExts, xmlnsArr);
        }
        if (f.geometry.type === "MultiLineString") {
          name = f.properties.name ? f.properties.name : NEW_TRACK_NAME;
          for (var i = 0; i < f.geometry.coordinates.length; i++) {
            coords = f.geometry.coordinates[i];
            times = f.properties.coordTimes && f.properties.coordTimes[i] &&
              (f.properties.coordTimes[i].length == coords.length) ?
              f.properties.coordTimes[i] : undefined;
            ptExts = f.properties.ptExts && f.properties.ptExts[i] &&
              (f.properties.ptExts[i].length == coords.length) ?
              f.properties.ptExts[i] : undefined;
            xmlnsArr = f.properties.xmlnsArr && f.properties.xmlnsArr[i] ?
                f.properties.xmlnsArr[i] : undefined;
            importSegment(name, coords, times, ptExts, xmlnsArr);
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
      // no segment added, but existing one was (possibly) extended, update it
      polystats.updateStatsFrom(0);
    }
    saveState();
    closeMenu();
    updateExtremities();
    setExtrimityVisibility(extMarkers);
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

  function loadFromUrl(url, options) {
    if (!options) {
      options = {};
    }
    setStatus("Loading...", { "spinner": true });
    var _url = options.noproxy ? url : corsUrl(url);
    var req = {
      url: _url,
      success: function(data) {
        loadCount = 0;
        if (options.key) {
          if (!isCryptoSupported()) {
            onerror('Crypto-not-supported');
            alert("Sorry, you cannot load this file: it is encrypted, and your browser does not provide the required services to decrypt it.");
            newTrack();
            return;
          }
          var encversion = options.key.substring(0,2); // version, ignored for now
          var key = encodeURIComponent(options.key.substring(2));
          var deckey = strdecode(key, key);
          var iv = deckey.substring(0,24);
          var pwd = deckey.substring(24);
          //log("iv  : " + iv);
          //log("pwd : " + pwd);
          ga('send', 'event', 'file', 'decrypt', undefined, Math.round(data.length / 1000));
          aesGcmDecrypt(data, iv, pwd)
          .then(function(gpx) {
            fileloader.loadData(gpx, url, options.ext);
          })
          .catch(function(err) {
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

    $.ajax(req).fail(function(resp) {
      setStatus("Failed: " + resp.statusText, { 'class': 'status-error', 'timeout': 3 });
      if (!track) {
        newTrack();
        restorePosition();
      }
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
    loadFromUrl(url, {
      ext: getLoadExt(),
      noproxy: noproxy,
      withCredentials: noproxy
    });
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
      loadFromUrl(files[0].link, {
        ext: getLoadExt(),
        noproxy: true
      });
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
    // Check Dropbox is supported
    if (!Dropbox.isBrowserSupported()){
    alert("Sorry, your browser does not support Dropbox loading");
    return;
    }
    try {
      Dropbox.choose(dropboxLoadOptions);
    } catch (err) {
      setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
      alert("Dropbox popup could not open. Make sure you did not forbid popups.")
      ga('send', 'event', 'error', 'Dropbox.choose error', err);
    }
  });

  var dropboxSaveOptions = {
    files: [{}], // to be completed when uploading

    // Success is called once all files have been successfully added to the user's
    // Dropbox, although they may not have synced to the user's devices yet.
    success: function() {
      // Indicate to the user that the files have been saved.
      setStatus("File saved in your Dropbox", { timeout: 3 });
      $("#menu").hide();
      dropboxSaveOptions.deleteTemp();
    },

    // Progress is called periodically to update the application on the progress
    // of the user's downloads. The value passed to this callback is a float
    // between 0 and 1. The progress callback is guaranteed to be called at least
    // once with the value 1.
    progress: function(progress) {},

    // Cancel is called if the user presses the Cancel button or closes the Saver.
    cancel: function() {
      dropboxSaveOptions.deleteTemp();
    },

    // Error is called in the event of an unexpected response from the server
    // hosting the files, such as not being able to find a file. This callback is
    // also called if there is an error on Dropbox or if the user is over quota.
    error: function(errorMessage) {
      setStatus(errorMessage || "Failed", { timeout: 5, class: "status-error" });
      dropboxSaveOptions.deleteTemp();
    },

    deleteTemp: function(res) {
      dropboxTempShare.delete(
        dropboxSaveOptions.gpxurl,
        dropboxSaveOptions.files[0].url,
        dropboxSaveOptions.passcode,
        undefined, function(msg) {
          warn("Failed to delete temp share");
        }
      );
    }

  };

  function dropboxSaver(evt) {
    $("#confirm-dropbox").hide();
    try {
      Dropbox.save(dropboxSaveOptions);
    } catch (err) {
        setStatus("Failed: " + err, { timeout: 5, class: "status-error" });
        ga('send', 'event', 'error', 'Dropbox.save error', error);
    }
  }
  $("#dbs-ok").click(dropboxSaver);
  $("#dbs-cancel").click(function(){
    dropboxSaveOptions.deleteTemp();
    $("#confirm-dropbox").hide();
  });

  $("#dropbox-saver").click(function(e) {
    // Check Dropbox is supported
    if (!Dropbox.isBrowserSupported()){
      alert("Sorry, your browser does not support Dropbox saving");
      return;
    }
    var name = getConfirmedTrackName().replace(/[\\\/:\*\?"<>|]/g, "_"); // remove forbidden path chars
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
      }, function(error) {
        uploadFailed(dropboxTempShare, gpx, error);
      }
    );
  });

  /* ------------ */

  var MAX_ROUTE_WPTS = 2;

  function newRouteWaypoint(i, waypoint, n) {

    function getRouteWaypoinContent(latlng, index, marker) {
      if (!route) {
        marker.off("click");
        return; // ignore
      }
      var div = document.createElement("div");

      p = L.DomUtil.create("div", "popupdiv ptbtn", div);
      var del = L.DomUtil.create('a', "", p);
      del.href = "#";
      del.title = "Delete";
      del.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>delete</i></span>";
      del.onclick = function(e) {
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
      error("route-pts-overlimit");
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

    marker.on("click", function(e) {

      L.popup({ "className" : "overlay" })
        .setLatLng(e.latlng)
        .setContent(getRouteWaypoinContent(e.latlng, i, marker))
        .openOn(map);

    });

    var ename = routerFactory == createOrsRouter ?
      "ors.routing" : (routerFactory == createGraphHopperRouter ?
      "gh.routing" : "unknownrouter");
    ga('send', 'event', 'api', ename +'.ok');

    addUndo(UndoRoute, { fromPt : routeStart });

    return marker;
  }


  // ------------ Length Unit

  var LENGTH_UNIT_METRIC = "0";
  var LENGTH_UNIT_IMPERIAL = "1";

  var defaultLengthUnit = window.navigator.language === "en-US" ?
    LENGTH_UNIT_IMPERIAL : LENGTH_UNIT_METRIC;
  var lengthUnit = getVal("wt.lengthUnit", defaultLengthUnit);

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
    return alt;
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

  // ------------ Scale control and unit toggling

  var scaleCtrl;

  function updateUnitSystem(event) {
    if (scaleCtrl) {
      scaleCtrl.remove();
    }
    if (event) {
      // setting changed
      lengthUnit = $("input[name=unitopt]:checked").val();
      saveValOpt("wt.lengthUnit", lengthUnit);
      ga('send', 'event', 'setting', 'lengthUnit', undefined, parseFloat(lengthUnit));
      showStats();
    } else {
      // init
      $("input:radio[name=unitopt][value=" +  lengthUnit + "]").prop("checked",true);
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
  $("input:radio[name=unitopt]").change(updateUnitSystem);

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

  // ---------------- Popups

  function getTrackPointPopupContent(latlng) {
    var div = L.DomUtil.create('div', "popupdiv"),
      data;

    var pts = track.getLatLngs();
    var last = pts[pts.length - 1];

    data = L.DomUtil.create('div', "popupdiv", div);
    data.innerHTML = "<span class='popupfield'>Distance:</span> " +
      dist2txt(latlng.dist) + " / " + dist2txt(last.dist * 2 - latlng.dist);
    data = L.DomUtil.create('div', "popupdiv", div);
    data.innerHTML = "<span class='popupfield'>Est. time:</span> " +
      time2txt(latlng.chrono) + " / " + time2txt(latlng.chrono_rt);
    var trackStart = track.getLatLngs()[0];
    if (latlng.time && trackStart.time) {
      data = L.DomUtil.create('div', "popupdiv", div);
      data.innerHTML = "<span class='popupfield'>Rec. time:</span> " +
      time2txt((new Date(latlng.time) - new Date(trackStart.time))/1000);
    }
    return div;

  }

  function getLatLngPopupContent(latlng, deletefn, splitfn, gotopt, toadd) {
    var div = L.DomUtil.create("div");
    var p;

    p = L.DomUtil.create("div", "popupdiv", div);
    p.innerHTML = "<span class='popupfield'>Position:</span> " + rounddec(latlng.lat,5) + "," + rounddec(latlng.lng,5);

    if (editMode != EDIT_NONE) {

      p = L.DomUtil.create("div", "popupdiv", div);
      p.innerHTML = "<span class='popupfield'>Altitude:</span> ";
      var altinput = L.DomUtil.create('input', "", p);
      altinput.type = "text";
      altinput.placeholder = "Numeric altitude";
      altinput.class = altinput.className = "atlInput";
      $(altinput).val(isUndefined(latlng.alt) || !isNumeric(latlng.alt) ? "" : alt2txt(latlng.alt, true));
      altinput.onkeyup = function() {
        try {
          latlng.alt = isNumeric(altinput.value) ? txt2alt(altinput.value) : undefined;
        } catch (e) {}
      };
      p = L.DomUtil.create("span", "", p);
      p.innerHTML = altUnit();
    } else {
      if (!isUndefined(latlng.alt)) {
        p = L.DomUtil.create("div", "popupdiv", div);
        p.innerHTML = "<span class='popupfield'>Altitude:</span> " + alt2txt(latlng.alt);
      }
    }

    if (toadd) {
      div.appendChild(toadd);
    }

    if (editMode != EDIT_NONE) {
      // Previous point
      if (gotopt && latlng.i > 0) {
        p = L.DomUtil.create("div", "popupdiv ptbtn", div);
        var btn = L.DomUtil.create('a', "", p);
        btn.href = "#";
        btn.title = "Previous point";
        btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>navigate_before</i></span>";
        btn.onclick = function() { gotopt(-1); };
      }
      // Delete button
      p = L.DomUtil.create("div", "popupdiv ptbtn", div);
      var btn = L.DomUtil.create('a', "", p);
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
        btn.onclick = splitfn
      }

      // Next point
      if (gotopt && latlng.i < (track.getLatLngs().length - 1)) {
        p = L.DomUtil.create("div", "popupdiv ptbtn", div);
        var btn = L.DomUtil.create('a', "", p);
        btn.href = "#";
        btn.title = "Next point";
        btn.innerHTML = "<span class='popupfield'><i class='material-icons notranslate'>navigate_next</i></span>";
        btn.onclick = function() { gotopt(+1); };
      }

    }

    return div;
  }

  function showStats() {
    var pts = track ? track.getLatLngs() : undefined;
    if (pts && pts.length > 0) {
      var last = pts[pts.length - 1];
      var first = pts[0];
      var stats = track.stats;
      $("#distow").html(dist2txt(last.dist));
      $("#distrt").html(dist2txt(2 * last.dist));
      $("#timeow").html(time2txt(last.chrono));
      $("#timert").html(time2txt(first.chrono_rt));
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
    if (i == getTrackLength() - 1) {
      // last vertex
      elevatePoint(latlng, function(success) {
        polystats.updateStatsFrom(i);
      });
    }
    addUndo(UndoNewPt, {newPt: latlng});
    updateExtremity(latlng, i);
  }
  map.on('editable:vertex:new', newVertex);

  function dragVertex(e) {
    var latlng = e.vertex.getLatLng();
    var i = latlng.i;
    elevatePoint(latlng, function(success) {
      polystats.updateStatsFrom(i);
    });
    //console.log(e.type + ": " + i);
    updateExtremity(latlng, i);
  }
  map.on('editable:vertex:dragend', dragVertex);
  function dragVertexStart(e) {
    var latlng = e.vertex.getLatLng();
    addUndo(UndoMovePt, {pt: latlng});
  }
  map.on('editable:vertex:dragstart', dragVertexStart);

  map.on('editable:middlemarker:mousedown', function(e) {
    //console.log(e.type);
  });

  function draggedMark(e) {
    if (e.layer.getLatLng) {
      // Dragged a waypoint
      elevatePoint(e.layer.getLatLng());
      //console.log(e.type);
    }
  }
  map.on('editable:dragend', draggedMark);

  map.on('editable:vertex:deleted', function(e) {
    if (!e.latlng.undoing) { // ensure we're not running an undo
      addUndo(UndoDeletePt, {pt: e.latlng});
    }
    var i = e.latlng.i;
    //console.log(e.type + ": " + i);
    polystats.updateStatsFrom(i);
    updateExtremities();
  });


  map.on('editable:created', function(e) {
    //console.log("Created: " + e.layer.getEditorClass());
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
  function routingError(err, msg) {
    log("Routing failed " + err.error.message);
    ga('send', 'event', 'api', 'ors.routing.ko', err.error.message);
    setEditMode(EDIT_NONE);
    showRoutingError("OpenRouting failed, check API key and account status");
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
            router = routerFactory();

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
          } catch(err) {
            ga('send', 'event', 'error', 'merge-route-failed', err.toString()
                + ", " + navigator.userAgent, wpts.length);
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
    latlng = vertex.latlng;

    function deleteTrackPoint(event) {
      vertex.delete();
      map.closePopup(pop);
      event.preventDefault();
    }
    function splitSegment(event) {
      ga('send', 'event', 'edit', 'split-segment');
      setEditMode(EDIT_NONE);
      var i = latlng.i;
      var seg1 = track.getLatLngs().slice(0,i),
          seg2 = track.getLatLngs().slice(i);
      var xmlnsArr = track.xmlnsArr;
      track.setLatLngs(seg1);
      polystats.updateStatsFrom(0);
      newSegment();
      track.setLatLngs(seg2);
      track.xmlnsArr = xmlnsArr;
      polystats.updateStatsFrom(0);
      saveState();
      setEditMode(EDIT_MANUAL_TRACK);
      map.closePopup(pop);
      event.preventDefault();
    }
    function gotopt(diff) {
      topt = diff > 0 ? vertex.getNext() : vertex.getPrevious();
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
    e && e.cancel && e.cancel();
    var div = getTrackPointPopupContent(latlng);
    var splitfn,
        i = latlng.i,
        len = getTrackLength();
    if ((i>1) & (i<len-1)) {
      splitfn = splitSegment;
    }
    var pop = L.popup({ "className" : "overlay" })
      .setLatLng(latlng)
      .setContent(getLatLngPopupContent(latlng, deleteTrackPoint, splitfn, gotopt, div))
      .openOn(map);
    $(".leaflet-popup-close-button").click(function(e) {
      track.editor && track.editor.continueForward();
      return false;
    });
  }
  map.on('editable:vertex:click', clickVertex);


  // ---- ELEVATION
  var elevation;

  function hideElevation() {
    if (elevation) toggleElevation();
  }

  function toggleElevation(e) {
    // is elevation currently displayed?
    if (!elevation) {
      // ignore if track has less than 2 points
      if (track && getTrackLength() > 1) {
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
  setStatus("Welcome to " + config.appname + "!", { timeout: 3 });

  // Prevent automatic translation on controls, icons, and user data
  noTranslate();
  noTranslate(".leaflet-control-layers-list label div span");
  noTranslate(".leaflet-control-attribution");
  noTranslate(".leaflet-control-scale-line");
  noTranslate("#track-name");
  noTranslate("input");
  noTranslate("#share-libs");

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
  $(".tablinks").click(function(event) {
    menu(event.currentTarget.id.replace("tab", ""), event);
  });
  $(".donatebtn").click(function(event) {
    ga('send', 'event', 'menu', 'donate', event.target.id);
  });

  if (canValBeSaved()) {
    $("#cfgsave").change(function(e) {
      var saveCfg = isChecked("#cfgsave");
      setSaveState(saveCfg);
      setStateSaved(saveCfg);
      if (saveCfg) {
        saveState();
        saveSettings();
      } else {
        clearSavedState();
      }
    });
  } else {
    $("#cfgsave").attr("title", "Your browser prevents storing data. Did you block cookies?")
    $("#cfgsave").prop("disabled", true);
    $("#cfgsave").removeClass("no-trim");
  }

  function setStateSaved(save) {
    if (save != isChecked()) {
      setChecked("#cfgsave", save);
    }
    if (save) {
      $(".state-file").removeAttr("disabled");
      $(".state-file").removeClass("disabled-button");
    } else {
      $(".state-file").attr("disabled", true);
      $(".state-file").addClass("disabled-button");
    }
  }

  setChecked("#merge", false);

  // get visit info
  var about = getVal("wt.about", undefined);
  // set saving status
  setStateSaved(isStateSaved());

  // make sure we have a track
  newTrack();

  // map parameter
  if (requestedMap) {
    ga('send', 'event', 'file', 'load-mapparam');
    changeBaseLayer(requestedMap);
  }

  var url = getParameterByName("url");
  if (url) {
    ga('send', 'event', 'file', 'load-urlparam');
    var qr = getParameterByName("qr");
    if (qr === "1") {
      ga('send', 'event', 'file', 'load-qrcode');
    }
    showLocation = LOC_NONE;
    loadFromUrl(url, {
      ext: getParameterByName("ext"),
      noproxy: getParameterByName("noproxy"),
      withCredentials: getParameterByName("noproxy"),
      key: getParameterByName("key")
    });
    setEditMode(EDIT_NONE);
  } else {
    var reqpos = {
      lat: parseFloat(getParameterByName("lat")),
      lng: parseFloat(getParameterByName("lng"))
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
  var now = new Date();
  var ONE_MONTH = Math.round(1000*60*60*24*30.5); // 1 month in ms
  var FIRST_VISIT = "1";
  if (about) {
    if ((about == FIRST_VISIT) || (now.getTime() > new Date(about).getTime() + ONE_MONTH)) {
      // reset about tag
      storeVal("wt.about", now.toISOString());
      // wait for potential urlparam to be loaded
      setTimeout(function(){ openMenu("about"); }, 4000);
    }
  } else {
    storeVal("wt.about", FIRST_VISIT);
  }

  // Suggest setting API keys
  if (!elevationService || !routerFactory) {
    openApiKeyInfo();
  }

  initTrackDisplaySettings();

  /* -------------- Share libs --------------- */

  var pasteLibSelect = $("#share-libs")[0];
  function initShareLib() {
    objectForEach(pastesLib, function(name, pl) {
      if (pl.enabled) {
        addSelectOption(pasteLibSelect, name, pl.name);
      }
    });
  }
  function changeShareLib(evt) {
    var libname = getSelectedOption(pasteLibSelect);
    share = pastesLib[libname] || share;
    $("#share-web").html("<a href='" + share.web + "' title='" + share.web + "' >" + share.web + "</a>");
    $("#share-max-size").html(share.maxSize);
    $("#share-max-time").html(share.maxTime);
    $("#share-max-downloads").html(share.maxDownloads);
    $("#share-status").html("?");
    share.ping(
      function() { $("#share-status").html("working <span class='green material-icons notranslate'>check_circle_outline</span>");},
      function() { $("#share-status").html("NOT working <span class='red material-icons notranslate'>highlight_off</span>");}
    );
    // share prompt dialog
    $("#wtshare-name").text(share.name);
    $("#wtshare-web").attr("href", share.web);
    saveValOpt("wt.share", libname);
  }
  initShareLib();
  selectOption(pasteLibSelect, sharename);
  changeShareLib();
  $("#share-libs").on("change", changeShareLib);

  /* ------------------------------------------- */

  // specific style for personal maps & overlays
  $(".leaflet-control-layers-list .leaflet-control-layers-selector").each(function(idx, elt) {
    var mname = $(elt.parentNode).find("span");
    if (mname && mname.text) {
      var name = mname.text().substring(1);
      var props = getMapListEntryProps(name);
      if (props && (props.in == MAP_MY)) {
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
  setChecked("#close-on-click", mapsCloseOnClick);
  $("#close-on-click").change(function (event) {
    mapsCloseOnClick = isChecked("#close-on-click");
    saveValOpt("wt.mapsCloseOnClick", mapsCloseOnClick);
  });

  // Persist joinOnLoad option
  joinOnLoad = getBoolVal("wt.joinOnLoad", false);
  setChecked("#joinonload", joinOnLoad);
  $("#joinonload").change(function(e) {
    joinOnLoad = isChecked("#joinonload");
    saveValOpt("wt.joinOnLoad", joinOnLoad);
  });

  // ready
  $("#menu-button").click(function() {
    if (isMenuVisible()) {
      closeMenu();
    } else {
      openMenu();
    }
    return false;
  });

  // Remove potential query parameters from URL
  clearUrlQuery()

  $(window).on("unload", function() {
    saveState();
  });

});
