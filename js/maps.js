/* ----------------- My maps edition ------------------- */

function setMapItemVisibility(elt, props) {
  //var isVisible = e.target.getAttribute("isVisible") == "true";
  var isVisible = props.on;
  elt.attr("isVisible", "" + isVisible);
  elt.text(isVisible ? "visibility" : "visibility_off");
  var parent = elt.parent(".map-item");
  if (isVisible && parent.length) {
    parent.removeClass("map-invisible");
  } else {
    parent.addClass("map-invisible");
  }
}

function addMymapsItem(name, props, addHandlers) {
  var mymapbtns = "",
    mymapclass = "";
  if (props.in == MAP_MY) {
    mymapbtns += "<i class='material-icons map-edit'>create</i> ";
    mymapbtns += "<i class='material-icons map-share'>share</i> ";
    mymapbtns += "<i class='material-icons map-delete'>delete</i> ";
    mymapclass = " mymap-name";
  }
  var mapitem = "<li><span class='map-item'>";
  mapitem += "<i class='material-icons map-drag'>drag_indicator</i> ";
  mapitem += "<span class='map-name" + mymapclass + "'>" + name + "</span> ";
  mapitem += "<i class='material-icons map-visibility' isVisible='??'>??</i> ";
  mapitem += mymapbtns;
  mapitem += "</span></li>";
  $("#mymaps-list").append(mapitem);
  var newitem = $("#mymaps-list").children().last();
  setMapItemVisibility(newitem.find(".map-visibility"), props);
  if (addHandlers) {
    addMapItemHandlers(newitem);
  }
}

function getMapName(elt) {
  return elt.parentNode.querySelector(".map-name").innerText;
}

function getMapProps(elt) {
  var name = getMapName(elt);
  var idx = mapsListNames.indexOf(name);
  return mapsListProps[idx];
}

function getMapItem(name) {
  var res = undefined;
  $("#mymaps-list .map-name").each(function(i, v) {
    if (name == v.innerText) {
      res = $(v).parents("li");
      return true;
    }
  });
  return res;
}

function changeMymapsItem(oldname, newname) {
  var mapItem = getMapItem(oldname);
  if (mapItem) {
    if (newname) {
      // name changed
      mapItem.find(".map-name").text(newname);
    } else {
      // item deleted
      mapItem.remove();
    }
  }
}

function showMapsList() {
  $("#mymaps-list").empty();
  mapsForEach(function(name, value) {
    addMymapsItem(name, value);
  });
  addMapItemHandlers($('#mymaps-list li'));
}

function toggleMapVisibility(e) {
  var mprops = getMapProps(e.target);
  mprops.on = !mprops.on;
  ga('send', 'event', 'map', 'visibility');
  saveMapList();
  setMapItemVisibility($(e.target), mprops)
}

function editMapItem(e) {
  var name = getMapName(e.target);
  editMymap(name);
}
function deleteMapItem(e) {
  var name = getMapName(e.target);
  deleteMymap(name);
}
function shareMapItem(e) {
  var name = getMapName(e.target);
  openExportMymaps(null, name);
}

function addMapItemHandlers(selector) {
  selector.find(".map-edit").click(editMapItem);
  selector.find(".map-visibility").click(toggleMapVisibility);
  selector.find(".map-delete").click(deleteMapItem);
  selector.find(".map-share").click(shareMapItem);
}

// ----------------------- Personal map edition ----------------------

var mymap;

function initCrsSelector() {
  var crsSelect = $("#mymap-crs")[0];
  for (var i = CrsValues.length - 1; i >=0; i--) {
    var crs = CrsValues[i];
    addSelectOption(crsSelect, crs ? crs.code : "");
  }
}
initCrsSelector();

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

function newMymap(evt) {
  mymap = { options: {} };
  openMymapBox();
}

function editMymap(mymapname) {
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
  var oldname = mymap.name;
  var newname = $("#mymap-name").val().trim();
  if ((oldname != newname) && (getMapListEntryIndex(newname) >= 0)) {
    $("#mymap-name").trigger("invalid");
    warn("Map name already used: " + newname);
    valid = false;
  }
  if (valid) {
    //mymapsInputs.removeClass("invalid");
    $("#mymap-box").hide();
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
        objectForEach(mymaps, function(name, value) {
          if (name == oldname) {
            tmp[newname] = mymap;
          } else {
            tmp[name] = value;
          }
        });
        mymaps = tmp;
        renameMapListEntry(oldname, newname);
        changeMymapsItem(oldname, newname);
        saveMapList();
      } else {
        mymaps[newname] = mymap;
      }
      ga('send', 'event', 'map', 'edit');
    } else {
      mymaps[newname] = mymap;
      addMymapsItem(newname, addMapListEntry(newname, MAP_MY, true), true);
      saveMapList();
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

function deleteMymap(mymapname) {
  if (mymapname) {
    mymap = mymaps[mymapname];
    if (mymap && confirm("Delete \"" + mymapname + "\"?")) {
      mymaps[mymapname] = undefined;
      saveJsonValOpt("wt.mymaps", mymaps);
      // delete map in lists
      delMapListEntry(getMapListEntryIndex(mymapname));
      changeMymapsItem(mymapname);
      saveMapList();
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

function deleteAllMymaps(evt) {
  if (!$.isEmptyObject(mymaps) &&
      confirm("Delete all your personal maps?")) {
    mymaps = {};
    saveJsonValOpt("wt.mymaps", undefined);
    ga('send', 'event', 'map', 'deleteall');
    getMapList();
    showMapsList()
  }
}
function reorderMapList(evt) {
  if (confirm("Re-order map list according to defaults, with personal maps at the end?")) {
    ga('send', 'event', 'map', 'reorder');
    resetMapList();
    getMapList();
    showMapsList();
  }
}


$("#mymap-ok").click(validateMymapBox);
$("#mymap-cancel").click(cancelMymapBox);

$("#mymaps-new").click(newMymap);
$("#mymaps-deleteall").click(deleteAllMymaps);

$("#maps-reorder").click(reorderMapList);
$("input:radio[name=mymap-type]").change(changeMymapType);

// ---------------- Import / export my maps

function openExportMymaps(evt, mymapname) {
  var toexport = {};
  if (mymapname) {
    toexport[mymapname] = mymaps[mymapname];
  } else {
    toexport = mymaps;
  }
  if (!$.isEmptyObject(toexport)) {
    var json = JSON.stringify(toexport);
    var data = b64EncodeUnicode(json);
    $("#input-text").text("Copy and share map data below (Ctrl+C & Enter):");
    $("#input-ok").hide();
    $("#input-val").val(data);
    $("#input-box").show();
    $("#input-val").focus();
    $("#input-val").select();
    $("#input-val").attr("readonly", "readonly");
    $(".prompt-content .copyonclick").show();
    ga('send', 'event', 'map', 'export', undefined, mymapname ? 1 : mymaps.length);
  }
}

function openImportMymaps() {
  $("#input-text").text("Paste exported map data (Ctrl+V & Enter):");
  $("#input-val").val("");
  $("#input-ok").show();
  $("#input-box").show();
  $("#input-val").removeAttr("readonly");
  $(".prompt-content .copyonclick").hide();
  $("#input-val").focus();
}


function importMymaps() {
  var imported = 0;
  try {
    var data = $("#input-val").val().trim();
    var importedMymaps = data ? JSON.parse(b64DecodeUnicode(data)) : {};
    objectForEach(importedMymaps, function(name, value) {
      var overwrite = mymaps[name];
      var msg = overwrite ? "Overwrite \"" : "Import \"";
      if (confirm(msg + name + "\"?")) {
        if (overwrite) {
          // useless
          //changeMymapsItem(name, name);
        } else {
          addMymapsItem(name, addMapListEntry(name, MAP_MY, true), true);
        }
        mymaps[name] = value;
        imported++;
      }
    });
  } catch (ex) {
    error("Invalid import data");
  }
  if (imported > 0) {
    saveJsonValOpt("wt.mymaps", mymaps);
    ga('send', 'event', 'map', 'import', undefined, imported);
    saveMapList();
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

$("#mymaps-import").click(openImportMymaps);
$("#mymaps-export").click(openExportMymaps);

if (!supportsBase64() || !JSON || !JSON.parse || !JSON.stringify) {
  $("#mymaps-import").attr("disabled", "disabled");
  $("#mymaps-export").attr("disabled", "disabled");
}

// ------------------- ready?

$(document).ready(function() {
  showMapsList();
  // ----- drag & drop list -----
  $("#mymaps-list").sortable({
    //scroll: true,
    handle: ".map-drag, .map-name",
    update: function(evt) {
      // get map-item
      var item = $(evt.target).parents(".map-item");
      // NOTE: item may be detached from the list at this step
      // moved item name
      var name = item.find(".map-name").text();
      // get new index
      var toIdx = getMapItem(name).index();
      // get old index
      var fromIdx = getMapListEntryIndex(name);
      if (fromIdx != toIdx) {
        // update list data
        moveMapListEntry(fromIdx, toIdx);
        saveMapList();
        ga('send', 'event', 'map', 'move');
      }
    }
  });
});

$(window).on("unload", function() {
  $("#mymaps-list").sortable('destroy');
});
