// -------- ACTIVITIES
var activities = getJsonVal("activities");
// initialize activities on first use
if (!activities) {
  activities = config.activities.defaults;
  storeJsonVal("activities", activities);
}

/*** dummy track required for polystats ***/
var track = L.polyline([]);
var polystats = L.Util.polyStats(track, {
  chrono: true
});

// --------- Drop down menu utils

// add a drop down menu item
function addSelectOption(select, optval) {
  var opt = document.createElement("option");
  opt.innerHTML = optval;
  opt.value = optval;
  select.appendChild(opt);
}

// select a drop down menu item
function selectOption(select, optval) {
  select.children(":selected").prop("selected", false);
  select.children("option[value='"+optval+"']").prop("selected", true);
}

var activity;
var activityname;


// vehicle menu
var selectVehicle = $("#activityvehicle")[0];
// add vehicles to menu
for (var i = 0; i < config.activities.vehicles.length; i++) {
  addSelectOption(selectVehicle, config.activities.vehicles[i]);
}

// utility function to sort speedRefs by increasing slope
function sortSpeedRefs(speedRefs) {
  speedRefs.sort(function(a, b) {
    return a[0] - b[0];
  });
}

// save an activity: add it to menu, and save it to browser local storage
function saveActivity(name, a) {
  if (!activities[name]) {
    addSelectOption(selectActivity, name);
  }
  selectOption($("#activities"), name);

  if (a.speedprofile.method == L.Util.PolyStats.REFSPEEDS) {
    sortSpeedRefs(a.speedprofile.parameters);
    spFormula[a.speedprofile.method]();
  }
  // clear potential refspeeds used for computation
  a.refspeeds = undefined;
  activities[name] = a;
  storeJsonVal("activities", activities);
}

// activity menu
var selectActivity = $("#activities")[0];
// add activities to menu
for (var a in activities) {
  if (hasOwnProperty.call(activities, a)) {
    addSelectOption(selectActivity, a);
  }
}

// listen to activity change from menu
$("#activities").change(displaySelectedActivity);

// activity deletion button
$("#activitydel").click(function() {
  var name = $("#activities").children(':selected').val()
  if (confirm("Delete " + name + "?")) {
    activities[name] = undefined;
    storeJsonVal("activities", activities);
    activityname = $("#activities").children(':selected').remove();
  }
});

// activity save button
$("#activitysave").click(function() {
  var name = $("#activities").children(':selected').val()
  if (activity && activityname) {
    saveActivity(activityname, activity);
    displaySelectedActivity();
  }
});

function moveActivity(inc) {
  var name = $("#activities").children(':selected').val();
  var idx = selectActivity.selectedIndex + inc;
  var newActivities = {};
  var i = 0;
  for (var a in activities) {
    if (hasOwnProperty.call(activities, a)) {
      if (i == idx) {
        newActivities[name] = activities[name];
        i++;
      }
      if (a != name) {
        newActivities[a] = activities[a];
        i++;
      }
    }
  }
  if (i == idx) {
    newActivities[name] = activities[name];
    i++;
  }
  // save
  activities = newActivities;
  storeJsonVal("activities", activities);
  // update menu
  var curIdx = selectActivity.selectedIndex;
  var moved = selectActivity.children[curIdx];
  var beforeIdx = (inc == -1) ? curIdx - 1 : curIdx + 2;
  selectActivity.insertBefore(moved, selectActivity.children[beforeIdx]);
  selectOption($("#activities"), name);
}

// activity up button
$("#activityup").click(function(event) {
  if (selectActivity.selectedIndex > 0) {
    moveActivity(-1);
  }
  event.preventDefault();
});
// activity down button
$("#activitydown").click(function(event) {
  if (selectActivity.selectedIndex < selectActivity.children.length - 1) {
    moveActivity(1);
  }
  event.preventDefault();
});


function exportA(json) {
  var data = b64EncodeUnicode(json);
  $("#prompt-text").text("Copy and share data below (Ctrl+C & Enter):");
  $("#prompt-ok").hide();
  $("#prompt-val").val(data);
  $("#prompt").show();
  $("#prompt-val").focus();
  $("#prompt-val").select();
}

function promptA() {
  $("#prompt-text").text("Paste exported activity data:");
  $("#prompt-val").val("");
  $("#prompt-ok").show();
  $("#prompt").show();
  $("#prompt-val").focus();
}

$("#prompt-close").click(function(){
  $("#prompt").hide();
});

$("#prompt-val").keyup(function(event){
  if ( event.which == 27 ) {
    $("#prompt").hide();
  } else if (event.keyCode == 13) {
    var isImport = $("#prompt-ok").is(":visible");
    $("#prompt").hide();
    if (isImport) {
      importA();
    }
  }
});

$("#prompt-ok").click(importA);

function importA() {
  var data = $("#prompt-val").val();
  var importedActivities = JSON.parse(b64DecodeUnicode(data));
  var imported = false;
  for (var a in importedActivities) {
    if (hasOwnProperty.call(importedActivities, a)) {
      var msg = activities[a] ? "Overwrite " : "Import ";
      if (confirm(msg + a + "?")) {
        activities[a] = importedActivities[a];
        imported = true;
      }
    }
  }
  if (imported) {
    storeJsonVal("activities", activities);
    // reload page
    window.location.reload();
  }
}

$("#activityexportall").click(function() {
  var str = JSON.stringify(activities);
  exportA(str);
});
$("#activityexport").click(function() {
  var str = "{\"" + activityname + "\":" + JSON.stringify(activity)+"}"
  exportA(str);
});
$("#activityimport").click(function() {
  promptA();
});

if (!supportsBase64()) {
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
  }
}

// activity creation button: initialize editor with new activity name
// and some defaults activity parameters
$("#activitynew").click(function() {
  var index = 1;
  activityname = "New";
  while (activities[activityname]) {
    ++index;
    activityname = "New#" + index;
  }
  activity = createActivity("feet", L.Util.PolyStats.POLYNOMIAL, [1.2, -0.002, -0.002]);
  displayActivity();
});

// reset stored activities to defaults
$("#activityreset").click(function() {
  if (confirm("Delete current activities and restore defaults?")) {
    activities = config.activities.defaults;
    storeJsonVal("activities", activities);
    window.location = window.location;
  }
});

function refSpeedInput(val, paramidx, col) {
  var rs = document.createElement("input");
  rs.setAttribute("type", "text");
  rs.setAttribute("value", val);
  rs.onkeyup = function() {
    activity.speedprofile.parameters[paramidx][col] = parseFloat(this.value);
    displaySpeedProfile(activity.speedprofile);
  };
  return rs;
}
function delRefSpeed(i) {
  activity.speedprofile.parameters.splice(i, 1);
  $("#spformula #refspeeds table tr:nth-of-type(" + (i+1) + ")").remove();
  displaySpeedProfile(activity.speedprofile);
}
function addRefSpeedLine(i) {
  var p = activity.speedprofile.parameters[i];
  $("#spformula #refspeeds table tbody").append("<tr><td></td><td></td></tr>");
  var tr = $("#spformula #refspeeds table tbody tr:last-of-type()")[0];
  tr.children[0].append(refSpeedInput(p[0], i, 0));
  tr.children[1].append(refSpeedInput(p[1], i, 1));
  var delrs = document.createElement("a");
  delrs.setAttribute("href", "#");
  delrs.setAttribute("class", "btn-link");
  delrs.innerHTML = "×";
  delrs.addEventListener("click", function(e) {
    // compute parameter index
    // (it may have changed since lines may have been deleted)
    var line = this.parentElement.parentElement;
    var index = 0;
    while (line.previousElementSibling) {
      line = line.previousElementSibling;
      index++;
    }
    delRefSpeed(index);
    e.preventDefault();
  });
  tr.children[1].append(delrs);
}
function addRefSpeed() {
  var p = activity.speedprofile.parameters;
  var i = p.length;
  p.push([0,0]);
  addRefSpeedLine(i);
  displaySpeedProfile(activity.speedprofile);
}
function genericSpFormula(method, defparams) {
  function updParam(method, idx) {
    return function() {
      activity.speedprofile.parameters[idx] = parseFloat($("#spformula #" + method + " #p"+idx).val());
      displaySpeedProfile(activity.speedprofile);
    }
  }
  if (activity.speedprofile.method !== method) {
    activity.speedprofile.method = method;
    activity.speedprofile.parameters = defparams;
  }
  $("#spformula input").off("keyup");
  for (var i = activity.speedprofile.parameters.length - 1; i >= 0; i--) {
    $("#spformula #" + method + " #p"+i).val(activity.speedprofile.parameters[i]);
    $("#spformula #" + method + " #p"+i).on("keyup", updParam(method, i));
  }
}

var spFormula = {
  "refspeeds": function() {
    $("#spformula #refspeeds").empty();
    $("#spformula #refspeeds").append("<table></table>");
    $("#spformula #refspeeds table").append("<thead><tr><th>Slope (%)</th><th>Speed (m/s)</th></tr></thead><tbody></tbody>");
    if (activity.speedprofile.method !== L.Util.PolyStats.REFSPEEDS) {
      activity.speedprofile.method = L.Util.PolyStats.REFSPEEDS;
      activity.speedprofile.parameters = [ [-35, 0.4722], [-20, 0.6944], [-12, 0.9722],
            [-10, 1.1111], [-6, 1.25], [-3, 1.25], [2, 1.1111], [6, 0.9722],
            [10, 0.8333], [19, 0.5555], [38, 0.2777] ]
    }
    for (var i=0; i<activity.speedprofile.parameters.length; i++) {
      addRefSpeedLine(i);
    }
    var addrs = document.createElement("a");
    addrs.setAttribute("href", "#");
    addrs.setAttribute("class", "btn-link");
    addrs.innerHTML = "+";
    addrs.addEventListener("click", function(e) {
      addRefSpeed();
      $("#refspeeds table tbody").scrollTop($("#refspeeds table tbody")[0].scrollHeight);
      e.preventDefault();
    });
    $("#spformula #refspeeds").append(addrs);
    $("#refspeeds table tbody").scrollTop($("#refspeeds table tbody")[0].scrollHeight);
  },
  "linear": function() {
    genericSpFormula("linear", [4,0.2]);
  },
  "power": function() {
    genericSpFormula("power", [1,2]);
  },
  "polynomial": function() {
    genericSpFormula(L.Util.PolyStats.POLYNOMIAL, [ 1.1, -0.1, -0.001]);
  },
}

function displayActivity() {
  $("#activityname").val(activityname);
  selectOption($("#activityvehicle"), activity.vehicle);
  selectOption($("#method"), activity.speedprofile.method);
  updateMethod();
}

$("#activityname").keyup(function() {
  activityname = $("#activityname").val();
});

function displaySelectedActivity() {
  activityname = $("#activities").children(':selected').val()
  // clone a copy to edit
  var a = activities[activityname];
  activity = createActivity(a.vehicle, a.speedprofile.method,
      a.speedprofile.parameters);
  displayActivity();
}
displaySelectedActivity();

var selectdata = $("#data")[0];
forEachDataset(function(name) {
  addSelectOption(selectdata, name)
});


/*** display speed profile graph ***/

var importfnname;
var inputdata;
var refspeeds;
var speedprofile;


function displaySpeedProfile(sp) {

  // draw line from profile
  var speedline = [];
  var minslope = -40;
  var maxslope = 40;
  if (refspeeds && refspeeds.length > 1) {
    minslope = refspeeds[0][0];
    maxslope = refspeeds[refspeeds.length-1][0];
  }
  var incslope = (maxslope - minslope) / 20;
  for (var slope = minslope; slope <= maxslope; slope += incslope) {
    speedline.push([slope, polystats.getSpeed(slope, sp)]);
  }

  // Plot graph
  var data = [];
  if (refspeeds) {
    data.push({data: refspeeds, lines: { show: false }, points: { show: true }});
  }
  data.push({data: speedline, points: { show: false }});
  $.plot($('.graph'), data);

}

function computeSpeedProfile() {

  var method = $( "#method option:selected" ).text();
  var degree = Number($( "#degree option:selected" ).text());
  var iterations = Number($( "#iterations option:selected" ).text());
  var pruning = Number($( "#pruning option:selected" ).text());

  activity.speedprofile = polystats[importfnname](inputdata, method, iterations, pruning, degree);

  if (activity.speedprofile) {
    refspeeds = activity.speedprofile.refspeeds;
    updateMethod();
  }

}

$("#method").change(updateMethod);

function updateMethod(){
  var method = $( "#method option:selected" ).text();
  $("#spformula > div").hide();
  $("#spformula > div#"+method).show();
  spFormula[method]();
  displaySpeedProfile(activity.speedprofile);
}
/********* speed profile from track *********/

function importGeoJson(geojson) {
  importfnname = "computeSpeedProfileFromTrack";
  inputdata = geojson;
  var sp = polystats[importfnname](inputdata, L.Util.PolyStats.REFSPEEDS);
  refspeeds = sp.refspeeds;
  displaySpeedProfile(activity.speedprofile);
}
var fileloader = L.Util.fileLoader(undefined, {
    layer: importGeoJson,
    addToMap: false,
    fileSizeLimit: 1024*1024,
    formats: [ 'gpx', 'geojson', 'kml' ]
});
$("#trackfile").change(function() {
  selectOption($("#data"), "none");
  var file = $("#trackfile")[0].files[0];
  fileloader.load(file);
})

/********* speed profile from reference speeds *********/

function changeData() {
  var dataname = $( "#data option:selected" ).text();
  refspeeds = inputdata = getDataset(dataname);
  importfnname = "computeSpeedProfileFromSpeeds";
  displaySpeedProfile(activity.speedprofile);
}


/********* init *********/

function resetComputeParams() {
  /*
  selectOption($("#data"), "none");
  $("#trackfile").val("");
  */
  selectOption($("#degree"), "2");
  selectOption($("#iterations"), "1");
  selectOption($("#pruning"), "0.3");
}

function toggleHelp(e) {
  $("#" + this.id + "-help").toggle();
}

$(".help-b").click(toggleHelp)
$("#data").change(changeData);
$("#compute").click(computeSpeedProfile);
$("#resetcompute").click(resetComputeParams);
changeData();

