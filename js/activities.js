// ESM module for activities functionality
// Import dependencies from other modules
import config from './config.js';
import * as WC from './wtracks-commons.js';
import * as WDS from './dataset.js';
import * as WU from './utils.js';

// Dependencies loaded as globals via script tags in the HTML
/* globals $, ga, L */

let polystats;
let activity;
let activityname;
let activities;

WU.noTranslate();

// vehicle menu
let selectVehicle = $("#activityvehicle")[0];

// utility function to sort speedRefs by increasing slope
function sortSpeedRefs(speedRefs) {
  speedRefs.sort(function (a, b) {
    return a[0] - b[0];
  });
}

// save an activity: add it to menu, and save it to browser local storage
function saveActivity(name, a) {
  if (!activities[name]) {
    WU.addSelectOption(selectActivity, name);
  }
  WU.selectOption($("#activities"), name);

  if (a.speedprofile.method == L.PolyStats.REFSPEEDS) {
    sortSpeedRefs(a.speedprofile.parameters);
    displayFormula(a.speedprofile.method);
  }
  // clear potential refspeeds used for computation
  a.refspeeds = undefined;
  activities[name] = a;
  WU.storeJsonVal("wt.activities", activities);
}

// activity menu
let selectActivity = $("#activities")[0];

function activitiesLen() {
  return selectActivity.length;
}

// listen to activity change from menu
$("#activities").change(displaySelectedActivity);

// activity deletion button
$("#activitydel").click(function () {
  let name = $("#activities").children(':selected').val();
  if (confirm("Delete " + name + "?")) {
    ga('send', 'event', 'activity', 'delete', undefined, activitiesLen());
    activities[name] = undefined;
    WU.storeJsonVal("wt.activities", activities);
    activityname = $("#activities").children(':selected').remove();
  }
});

// activity save button
$("#activitysave").click(function () {
  ga('send', 'event', 'activity', 'save', undefined, activitiesLen());
  let name = $("#activityname").val();
  if (activity && name) {
    saveActivity(name, activity);
    displaySelectedActivity();
  }
});

function moveActivity(inc) {
  let name = $("#activities").children(':selected').val();
  let idx = selectActivity.selectedIndex + inc;
  let newActivities = {};
  let i = 0;
  WU.objectForEach(activities, function (a) {
    if (i == idx) {
      newActivities[name] = activities[name];
      i++;
    }
    if (a != name) {
      newActivities[a] = activities[a];
      i++;
    }
  });
  if (i == idx) {
    newActivities[name] = activities[name];
    i++;
  }
  // save
  activities = newActivities;
  WU.storeJsonVal("wt.activities", activities);
  // update menu
  let curIdx = selectActivity.selectedIndex;
  let moved = selectActivity.children[curIdx];
  let beforeIdx = (inc == -1) ? curIdx - 1 : curIdx + 2;
  selectActivity.insertBefore(moved, selectActivity.children[beforeIdx]);
  WU.selectOption($("#activities"), name);
}

// activity up button
$("#activityup").click(function (event) {
  if (selectActivity.selectedIndex > 0) {
    moveActivity(-1);
  }
  event.preventDefault();
});
// activity down button
$("#activitydown").click(function (event) {
  if (selectActivity.selectedIndex < selectActivity.children.length - 1) {
    moveActivity(1);
  }
  event.preventDefault();
});


function exportA(json) {
  let data = WU.b64EncodeUnicode(json);
  $("#prompt-text").text("Copy and share data below (Ctrl+C & Enter):");
  $("#prompt-ok").hide();
  $("#prompt-val").val(data);
  $("#import-error").hide();
  $("#prompt").show();
  $("#prompt-val").focus();
  $("#prompt-val").select();
}

function promptA() {
  $("#prompt-text").text("Paste exported activity data (Ctrl+V & Enter):");
  $("#prompt-val").val("");
  $("#prompt-ok").show();
  $("#import-error").hide();
  $("#prompt").show();
  $("#prompt-val").focus();
}

$("#prompt-close").click(function () {
  $("#prompt").hide();
});

$("#prompt-val").keyup(function (event) {
  if (event.which == 27) {
    $("#prompt").hide();
  } else if (event.keyCode == 13) {
    let isImport = $("#prompt-ok").is(":visible");
    if (isImport) {
      importA();
    } else {
      $("#prompt").hide();
    }
  }
});

$("#prompt-ok").click(importA);

function importA() {
  $("#import-error").hide();
  let data = $("#prompt-val").val();
  let imported = false;
  try {
    let importedActivities = JSON.parse(WU.b64DecodeUnicode(data));
    WU.objectForEach(importedActivities, function (a) {
      let msg = activities[a] ? "Overwrite " : "Import ";
      if (confirm(msg + a + "?")) {
        activities[a] = importedActivities[a];
        imported = true;
      }
    });
    $("#prompt").hide();
  } catch (err) {
    $("#import-error").show();
  }
  if (imported) {
    WU.storeJsonVal("wt.activities", activities);
    // reload page
    window.location.reload();
  }
}

$("#activityexportall").click(function () {
  ga('send', 'event', 'activity', 'export-all', undefined, activitiesLen());
  let str = JSON.stringify(activities);
  exportA(str);
});
$("#activityexport").click(function () {
  ga('send', 'event', 'activity', 'export', undefined, activitiesLen());
  let str = "{\"" + activityname + "\":" + JSON.stringify(activity) + "}";
  exportA(str);
});
$("#activityimport").click(function () {
  ga('send', 'event', 'activity', 'import', undefined, activitiesLen());
  promptA();
});

if (!WU.supportsBase64()) {
  $("#activityexportall").attr("disabled", "disabled");
  $("#activityexport").attr("disabled", "disabled");
  $("#activityimport").attr("disabled", "disabled");
}

function createActivity(vehicle, method, params) {
  return {
    vehicle: vehicle,
    speedprofile: {
      method: method,
      parameters: params.slice(0)
    }
  };
}

// activity creation button: initialize editor with new activity name
// and some defaults activity parameters
$("#activitynew").click(function () {
  ga('send', 'event', 'activity', 'new', undefined, activitiesLen());
  let index = 1;
  activityname = "New";
  while (activities[activityname]) {
    ++index;
    activityname = "New#" + index;
  }
  activity = createActivity(config.activities.vehicles[0], L.PolyStats.POLYNOMIAL, [1.2, -0.002, -0.002]);
  displayActivity();
});

// reset stored activities to defaults
$("#activityreset").click(function () {
  if (confirm("Delete current activities and restore defaults?")) {
    activities = config.activities.defaults;
    WU.storeJsonVal("wt.activities", activities);
    window.location = window.location;
  }
});

function refSpeedInput(val, col) {
  let rs = document.createElement("input");
  rs.setAttribute("type", "text");
  rs.setAttribute("value", val);
  rs.onkeyup = function () {
    // compute parameter index
    // (it may have changed since lines may have been deleted)
    let rowIdx = $(this).closest("tr").index();
    activity.speedprofile.parameters[rowIdx][col] = parseFloat(this.value);
    displaySpeedProfile(activity.speedprofile);
  };
  return rs;
}

function delRefSpeed(i) {
  activity.speedprofile.parameters.splice(i, 1);
  $("#spformula table tr:nth-of-type(" + (i + 1) + ")").remove();
  displaySpeedProfile(activity.speedprofile);
}

function addRefSpeedLine(i) {
  let p = activity.speedprofile.parameters[i];
  $("#spformula table tbody").append("<tr><td></td><td></td></tr>");
  let tr = $("#spformula table tbody tr:last-of-type()")[0];
  $(tr.children[0]).append(refSpeedInput(p[0], 0));
  $(tr.children[1]).append(refSpeedInput(p[1], 1));
  let delrs = document.createElement("a");
  delrs.setAttribute("href", "#");
  delrs.setAttribute("class", "btn-link");
  delrs.innerHTML = "×";
  delrs.addEventListener("click", function (e) {
    // compute parameter index
    // (it may have changed since lines may have been deleted)
    let index = $(this).closest("tr").index();
    delRefSpeed(index);
    e.preventDefault();
  });
  $(tr.children[1]).append(delrs);
}

function addRefSpeed() {
  let p = activity.speedprofile.parameters;
  let i = p.length;
  p.push([0, 0]);
  addRefSpeedLine(i);
  displaySpeedProfile(activity.speedprofile);
}

function genericSpFormula() {
  function updParam(idx) {
    return function () {
      activity.speedprofile.parameters[idx] = parseFloat($("#spformula #p" + idx).val());
      displaySpeedProfile(activity.speedprofile);
    };
  }
  $("#spformula input").off("keyup");
  WU.arrayForEach(activity.speedprofile.parameters, function (i, params) {
    $("#spformula #p" + i).val(params);
    $("#spformula #p" + i).on("keyup", updParam(i));
  });
}

let spFormula = {};
spFormula[L.PolyStats.REFSPEEDS] = {
  defaultFormulaParams: [
    [-35, 0.4722], [-20, 0.6944], [-12, 0.9722], [-10, 1.1111], [-6, 1.25],
    [-3, 1.25], [2, 1.1111], [6, 0.9722], [10, 0.8333], [19, 0.5555], [38, 0.2777]
  ],
  displayFormulaParams: function () {
    $("#spformula").empty();
    $("#spformula").append("<table></table>");
    $("#spformula table").append("<thead><tr><th>Slope (%)</th><th>Speed (m/s)</th></tr></thead><tbody></tbody>");
    WU.arrayForEach(activity.speedprofile.parameters, function (idx, params) {
      addRefSpeedLine(idx);
    });
    let addrs = document.createElement("a");
    addrs.setAttribute("href", "#");
    addrs.setAttribute("class", "btn-link");
    addrs.innerHTML = "+";
    addrs.addEventListener("click", function (e) {
      addRefSpeed();
      $("#spformula table tbody").scrollTop($("#spformula table tbody")[0].scrollHeight);
      e.preventDefault();
    });
    $("#spformula").append(addrs);
    $("#spformula table tbody").scrollTop($("#spformula table tbody")[0].scrollHeight);
  }
};
spFormula[L.PolyStats.LINEAR] = {
  defaultFormulaParams: [0.2, 4],
  displayFormulaParams: function () {
    $("#spformula").html("speed = <input id='p0' type='text'/> * slope + <input id='p1' type='text'/>");
    genericSpFormula(L.PolyStats.LINEAR);
  }
};
spFormula[L.PolyStats.POWER] = {
  defaultFormulaParams: [1, 2],
  displayFormulaParams: function () {
    $("#spformula").html("speed = <input id='p0' type='text'/> * slope ^ <input id='p1' type='text'/>");
    genericSpFormula(L.PolyStats.POWER);
  }
};
spFormula[L.PolyStats.POLYNOMIAL] = {
  defaultFormulaParams: [1.1, -0.1, -0.001],
  displayFormulaParams: function () {
    let i = 0;
    let html = "";
    while (i < activity.speedprofile.parameters.length) {
      let param = "<input id='p" + i + "' type='text'/>";
      if (i > 0) {
        param += " * slope";
        if (i > 1) {
          param += "<span class='pow'>" + i + "</span>";
        }
        param += " + ";
      }
      html = param + html;
      i++;
    }
    $("#spformula").html("speed = " + html);
    genericSpFormula(L.PolyStats.POLYNOMIAL);
  }
};

function displayFormula(method) {
  let spf = spFormula[method];
  if (!spf) {
    window.onerror("No speed profile for " + method, "activities.js", "displayFormula", "-");
    return;
  }
  if (!activity.speedprofile) {
    window.onerror("Activity has no speed profile", "activities.js", "displayFormula", "-");
    return;
  }
  if (activity.speedprofile.method !== method) {
    activity.speedprofile.method = method;
    if (spf.defaultFormulaParams) {
      activity.speedprofile.parameters = spf.defaultFormulaParams;
    }
  }
  spf.displayFormulaParams();
}

function displayActivity() {
  $("#activityname").val(activityname);
  WU.selectOption($("#activityvehicle"), activity.vehicle);
  WU.selectOption($("#method"), activity.speedprofile.method);
  updateMethod();
}

$("#activityname").keyup(function () {
  activityname = $("#activityname").val();
});

function displaySelectedActivity() {
  activityname = $("#activities").children(':selected').val();
  if (activityname) {
    // clone a copy to edit
    let a = activities[activityname];
    activity = createActivity(a.vehicle, a.speedprofile.method,
      a.speedprofile.parameters);
    displayActivity();
  }
}

/*** display speed profile graph ***/

let importfnname;
let inputdata;
let refspeeds;

function displaySpeedProfile(sp) {

  // draw line from profile
  const speedline = [];
  let minslope = -40;
  let maxslope = 40;
  if (refspeeds && refspeeds.length > 1) {
    minslope = refspeeds[0][0];
    maxslope = refspeeds[refspeeds.length - 1][0];
  }
  const incslope = (maxslope - minslope) / 20;
  for (let slope = minslope; slope <= maxslope; slope += incslope) {
    speedline.push([slope, polystats.getSpeed(slope, sp)]);
  }

  // Plot graph
  let data = [];
  if (refspeeds) {
    data.push({
      data: refspeeds,
      lines: { show: false },
      points: { show: true }
    });
  }
  data.push({
    data: speedline,
    points: { show: false }
  });
  $.plot($('.graph'), data);

}

function computeSpeedProfile() {

  if (inputdata.features) {
    importGeoJson(inputdata);
  } else if (!inputdata.length) {
    alert("Select input data first");
    return;
  }

  let method = $("#method option:selected").val();
  let degree = Number($("#degree option:selected").val());
  let iterations = Number($("#iterations option:selected").val());
  let pruning = Number($("#pruning option:selected").val());

  activity.speedprofile = polystats[importfnname](inputdata, method, iterations, pruning, degree);

  if (activity.speedprofile) {
    refspeeds = activity.speedprofile.refspeeds;
    updateMethod();
  }

}

$("#method").change(updateMethod);

function updateMethod() {
  let method = $("#method option:selected").val();
  displayFormula(method);
  displaySpeedProfile(activity.speedprofile);
}
/********* speed profile from track *********/

function importGeoJson(geojson) {
  importfnname = "computeSpeedProfileFromTrack";
  inputdata = geojson;
  let sp = polystats[importfnname](inputdata, L.PolyStats.REFSPEEDS);
  refspeeds = sp.refspeeds;
  displaySpeedProfile(activity.speedprofile);
}

/********* speed profile from reference speeds *********/

function changeData() {
  let dataidx = $("#data option:selected").val();
  if (!WU.isUnset(dataidx)) {
    refspeeds = inputdata = WDS.getDataset(dataidx);
  }
  importfnname = "computeSpeedProfileFromSpeeds";
  if (activity && activity.speedprofile) {
    displaySpeedProfile(activity.speedprofile);
  }
}


/********* init *********/

function resetComputeParams() {
  /*
  WU.selectOption($("#data"), "none");
  $("#trackfile").val("");
  */
  WU.selectOption($("#degree"), "2");
  WU.selectOption($("#iterations"), "1");
  WU.selectOption($("#pruning"), "0.3");
}

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

  // -------- ACTIVITIES
  activities = WU.getJsonVal("wt.activities");
  // initialize activities on first use
  if (!activities) {
    activities = config.activities.defaults;
    WU.storeJsonVal("wt.activities", activities);
  }

  /*** dummy track required for polystats ***/
  let track = L.polyline([]);
  polystats = L.polyStats(track, {
    chrono: true
  });


  // add vehicles to menu
  WU.arrayForEach(config.activities.vehicles, function (idx, vehicle) {
    WU.addSelectOption(selectVehicle, vehicle);
  });

  // add activities to menu
  WU.objectForEach(activities, function (activity) {
    WU.addSelectOption(selectActivity, activity);
  });

  let selectdata = $("#data")[0];
  WDS.forEachDataset(function (idx, data) {
    WU.addSelectOption(selectdata, idx, data.name);
  });

  displaySelectedActivity();

  const fileloader = L.FileLayer.fileLoader(undefined, {
    layer: importGeoJson,
    addToMap: false,
    fileSizeLimit: 1024 * 1024,
    formats: ['gpx', 'geojson', 'kml']
  });
  $("#trackfile").change(function () {
    WU.selectOption($("#data"), "none");
    let file = $("#trackfile")[0].files[0];
    fileloader.load(file);
  });

  $("#data").change(changeData);
  $("#compute").click(computeSpeedProfile);
  $("#resetcompute").click(resetComputeParams);
  changeData();
  ga('send', 'event', 'activity', 'editor', undefined, activitiesLen());

});
