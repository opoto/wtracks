/* ----------------- My maps editing ------------------- */

var OVERLAY_ICON = "<i class='material-icons map-overlay notranslate' 'translate'='no' title='Map overlay'>layers</i> ";
var MYMAPS_BTNS = "<i class='material-icons map-edit notranslate' 'translate'='no' title='Edit'>create</i> "
                  + "<i class='material-icons map-share notranslate' 'translate'='no' title='Share'>share</i> "
                  + "<i class='material-icons map-delete notranslate' 'translate'='no' title='Delete'>delete</i> ";


// --------------------------------------------
//  Workaround for Android Chrome display bug
var needsAndroidChromiumTweak = false;
if (navigator.userAgentData && navigator.userAgentData.platform == 'Android') {
  arrayForEach(navigator.userAgentData.brands, function(i, brand) {
    if (brand.brand == "Chromium") {
      needsAndroidChromiumTweak = true;
      return true;
    }
  });
}
function doAndroidChromiumTweak(item) {
  if (needsAndroidChromiumTweak) {
    item.hide().show(0);
  }
}
// --------------------------------------------

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
    mymapbtns = MYMAPS_BTNS;
    mymapclass = " mymap-name";
  }
  var inList = props.in == MAP_MY ? mymaps : config.maps;
  var mapv = inList[name];

  var mapitem = "<li><span class='map-item'>";
  mapitem += "<i class='material-icons map-drag notranslate' title='Drag to reorder'>drag_indicator</i> ";
  // TODO: "overlay" type is a deprecated legacy, should be discarded in Dec 2022
  if (mapv.type === "overlay") {
    // migrate overlay type to map attribute
    mapv.type = "base";
    mapv.overlay = true;
    saveJsonValOpt("wt.mymaps", mymaps);
  }
  if (mapv.overlay) {
    mapitem += OVERLAY_ICON;
    mymapclass += " overlay-name";
  }
  mapitem += "<span class='map-name notranslate" + mymapclass + "' 'translate'='no'></span> ";
  mapitem += "<i class='material-icons map-visibility notranslate' title='Show/Hide' isVisible=''></i>";
  mapitem += mymapbtns;
  mapitem += "</span></li>";
  $("#mymaps-list").append(mapitem);
  var newitem = $("#mymaps-list li:last");
  newitem.find(".map-name").text(name);
  setMapItemVisibility(newitem.find(".map-visibility"), props);
  if (addHandlers) {
    addMapItemHandlers(newitem);
  }
  // TODO: Workaround for Android Chrome display bug
  doAndroidChromiumTweak(newitem);
}

function getMapName(elt) {
  try {
    return $(elt).parents(".map-item").find(".map-name").text();
  } catch (err) {
    window.onerror("no map name: " + elt.parentNode.innerHTML, "map.js", "getMapName", "", err);
    return "";
  }
}

function getMapProps(elt) {
  var name = getMapName(elt);
  var idx = mapsListNames.indexOf(name);
  return mapsListProps[idx];
}

function getMapItem(name) {
  var res;
  $("#mymaps-list .map-name").each(function(i, v) {
    if (name == v.innerText) {
      res = $(v).parents("li");
      return true;
    }
  });
  return res;
}

function updateMapItem(oldname, newname, oldoverlay, newoverlay) {
  var mapItem = getMapItem(oldname);
  if (mapItem) {
    if (newname) {
      if (newname != oldname) {
        // name changed
        mapItem.find(".map-name").text(newname);
      }
      if (oldoverlay != newoverlay) {
        if (oldoverlay)  {
          // remove overlay icon
          mapItem.find(".map-overlay").remove();
          mapItem.find(".map-name").removeClass("overlay-name");
        } else if (newoverlay) {
          // add overlay icon
          mapItem.find(".map-name").before(OVERLAY_ICON);
          mapItem.find(".map-name").addClass("overlay-name");
        }
      }

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
  var mprops = getMapProps(e.currentTarget);
  mprops.on = !mprops.on;
  saveMapList();
  setMapItemVisibility($(e.currentTarget), mprops);
  ga('send', 'event', 'map', 'visibility');
}

function editMapItem(e) {
  var name = getMapName(e.currentTarget);
  editMymap(name);
}
function deleteMapItem(e) {
  var name = getMapName(e.currentTarget);
  deleteMymap(name);
}
function shareMapItem(e) {
  var name = getMapName(e.currentTarget);
  openExportMymaps(null, name);
}

function addMapItemHandlers(selector) {
  selector.find(".map-edit").click(editMapItem);
  selector.find(".map-visibility").click(toggleMapVisibility);
  selector.find(".map-delete").click(deleteMapItem);
  selector.find(".map-share").click(shareMapItem);
}

// ----------------------- Personal map editing ----------------------

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
  setChecked("#mymap-overlay", mymap.overlay);
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
  var oldoverlay = mymap.overlay;
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
    mymap.overlay = isChecked("#mymap-overlay");
    mymap.options = {};
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
      updateMapItem(oldname, newname, oldoverlay, mymap.overlay);
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
      updateMapItem(mymapname);
      saveMapList();
      ga('send', 'event', 'map', 'delete');
    }
  }
}

function clearLayerList() {
  $("#mymap-layerslist").hide();
  $("#mymap-layerslist-error").hide();
  $("#mymap-getlayerslist-processing").hide();
  $("#mymap-getlayerslist").show();
  $("#mymap-layerslist").empty();
}

function getMapType() {
  return $('input:radio[name=mymap-type]:checked').val();
}

function changeMymapType(evt) {
  var type = getMapType();
  $(".map-wmts").hide();
  $(".map-wms").hide();
  if ((type != "base")) {
    $(".map-" + type).show();
  }
  clearLayerList();
}

function deleteAllMymaps(evt) {
  if (!$.isEmptyObject(mymaps) &&
      confirm("Delete all your personal maps?")) {
    mymaps = {};
    saveJsonValOpt("wt.mymaps", undefined);
    getMapList();
    showMapsList();
    ga('send', 'event', 'map', 'deleteall');
  }
}
function reorderMapList(evt) {
  if (confirm("Re-order map list according to defaults, with personal maps at the end?")) {
    resetMapList();
    getMapList();
    showMapsList();
    ga('send', 'event', 'map', 'reorder');
  }
}

function getLayersList(evt) {
  $("#mymap-getlayerslist").hide();
  $("#mymap-layerslist").hide();
  $("#mymap-layerslist-error").hide();
  $("#mymap-getlayerslist-processing").show();
  var mapType = getMapType().toUpperCase(),
    layerSelector,
    valfield;
  if (mapType == "WMS") {
    layerSelector = "Layer>Name";
    $("#mymap-layerslist").off("change").change(onWmsLayerChanged);
    valfield = "mymap-layers";
  } else {
    layerSelector = "Capabilities>Contents>Layer>Identifier";
    $("#mymap-layerslist").off("change").change(onWmtsLayerChanged);
    valfield = "mymap-layer";
  }

  function setLayerAttr(option, attrName, node, selector) {
    try {
      var value;
      arrayForEach(node.querySelectorAll(selector), function(idx,item) {
        value = value ? value + "|" + item.textContent : item.textContent;
      });
      option.attr(attrName, value);
    } catch(e) {}
  }

  $.ajax({
    url: $("#mymap-url").val().trim() + "?SERVICE=" + mapType + "&REQUEST=GetCapabilities",
    dataType: "xml"
  })
  .done(function (resp) {
    $("#mymap-layerslist").empty();
    var ids = resp.querySelectorAll(layerSelector);
    arrayForEach(ids, function (idx, val) {
      var id = val.textContent;
      $("#mymap-layerslist").append("<option value='" + id + "' name='" + id + "'>" + id +
        "</option>");
      var opt = $($("#mymap-layerslist>option[value='"+id+"']")[0]);
      var layerElt = val.parentElement;
      if (mapType == "WMTS") {
        setLayerAttr(opt, "style", layerElt, "Style>Identifier");
        setLayerAttr(opt, "tilematrixSet", layerElt, "TileMatrixSet");
        setLayerAttr(opt, "format", layerElt, "Layer>Format");
      }
    });
    var curval = $("#"+valfield).val().trim();
    selectOption("#mymap-layerslist", curval);
    $("#mymap-layerslist").show();
  })
  .fail(function(err) {
   $("#mymap-layerslist-error").show();
  })
  .always(function() {
    $("#mymap-getlayerslist").show();
    $("#mymap-getlayerslist-processing").hide();
  });
}

function onWmtsLayerChanged(evt) {
  var opt = $($("#mymap-layerslist>option:selected")[0]);
  $("#mymap-layer").val(opt.val());
  $("#mymap-style").val(opt.attr("style"));
  $("#mymap-format").val(opt.attr("format"));
  $("#mymap-tilematrixSet").val(opt.attr("tilematrixSet"));
}
function onWmsLayerChanged(evt) {
  $("#mymap-layers").val(getSelectedOption("#mymap-layerslist"));
}

$("#mymap-getlayerslist").click(getLayersList);

$("#mymap-ok").click(validateMymapBox);
$("#mymap-cancel").click(cancelMymapBox);

$("#mymaps-new").click(newMymap);
$("#mymaps-deleteall").click(deleteAllMymaps);

$("#maps-reorder").click(reorderMapList);
$("input:radio[name=mymap-type]").change(changeMymapType);

// ---------------- Export my maps

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
    $("#export-val").val(window.location.toString() + "?import=" + data);
    $("#export-box").show();
    $("#export-val").focus();
    $("#export-val").select();
    ga('send', 'event', 'map', 'export', undefined, mymapname ? 1 : mymaps.length);
  }
}

$("#export-box-close").click(function() {
  $("#export-box").hide();
  return false;
});

$("#export-val").keyup(function(event) {
  if ((event.which == 27) || (event.keyCode == 13)) {
    $("#export-box").hide();
  }
});

$("#mymaps-export").click(openExportMymaps);

if (!supportsBase64() || !JSON || !JSON.parse || !JSON.stringify) {
  $("#mymaps-export").attr("disabled", "disabled");
}

// ------------------- Import maps

var importedMymaps;
function openImportBox(event, data) {
  $("#input-val").val(data ? data : "");
  $("#import-input").show();
  $("#import-select").hide();
  $("#import-box").show();
  if (data) {
    readImportMymaps(event);
  } else {
    $("#input-error").hide();
    $("#input-error-url").hide();
    $("#import-ok").off("click").click(readImportMymaps);
    $("#input-val").focus();
  }
}

function readImportMymaps(event) {
  $("#input-error").hide();
  $("#input-error-url").hide();
  var data = $("#input-val").val();
  if (data.match(/^https?\:\/\//)) {
    data = new URLSearchParams(new URL(data).search).get("import")
  }
  if (data) {
    try {
      importedMymaps = data ? JSON.parse(b64DecodeUnicode(data)) : {};
      $("#import-list").empty();
      var i = 0;
      objectForEach(importedMymaps, function(name, value) {
        var id = "import-i" + i++;
        var limap = "<tr><td><input id='" + id  + "' type='checkbox' checked='checked'/></td>";
        limap += "<td><label for='" + id + "'><span>" ;
        var count = 0;
        var ext = "";
        while (true) {
          if (count > 0) {
            ext = " (" + count + ")";
          }
          if (!mymaps[name + ext]) {
            if (ext) {
              // replace name
              importedMymaps[name] = undefined;
              name += ext;
              importedMymaps[name] = value;
            }
            break;
          }
          count++;
        }
        limap += name + "</span></td></tr>";
        $("#import-list").append(limap);
      });
      // show info about persistence activation if needed
      if (isStateSaved()) {
        $("#importv-savecfg").hide();
      } else {
        $("#importv-savecfg").show();
      }
      $("#import-input").hide();
      $("#import-select").show();
      $("#import-ok").off("click").click(importMymaps);
      $("#import-ok").focus();
    } catch (ex) {
      console.log("Failed to parse data: " + data)
      if (event) {
        $("#input-error").show();
      } else {
        $("#input-val").val("");
        $("#input-error-url").show();
      }
      $("#input-val").focus();
    }
  }
}
$("#import-ok").off("click").click(readImportMymaps);
$("#import-box").keyup(function(event) {
  if (event.which == 27) {
    $("#import-box").hide();
  } else if (event.keyCode == 13) {
    readImportMymaps(event);
  }
});

function closeImportBox() {
  $("#import-box").hide();
  window.history.pushState({}, document.title, window.location.pathname);
  importedMymaps = undefined;
  return false;
}

function importMymaps() {
  var imported = 0;
  $("#import-list input:checked").each(function(i,elt) {
    var name = $(elt).parents("tr").find("span").text();
    var isnew = !mymaps[name];
    mymaps[name] = importedMymaps[name];
    if (isnew) {
      addMymapsItem(name, addMapListEntry(name, MAP_MY, true), true);
    }
    imported++;
  });
  if (imported > 0) {
    // requires saved state
    setSaveState(true);
    saveJsonValOpt("wt.mymaps", mymaps);
    saveMapList();
    ga('send', 'event', 'map', 'import', undefined, imported);
  }
  closeImportBox();
}

$("#mymaps-import").click(openImportBox);
$("#import-box-close").click(closeImportBox);

// ------------------- ready?

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

  noTranslate();
  noTranslate("label");
  consentCookies();

  showMapsList();
  // ----- drag & drop list -----
  $("#mymaps-list").sortable({
    //scroll: true,
    handle: ".map-drag, .map-name",
    update: function(evt) {
      var moved = false;
      // reorder MapListEntry according to MapItems
      $("#mymaps-list .map-name").each(function(i, v) {
        var name = v.innerText;
        // get new index
        var item = getMapItem(name);
        var toIdx = item.index();
        // get old index
        var fromIdx = getMapListEntryIndex(name);
        if (fromIdx != toIdx) {
          // update list data
          moveMapListEntry(fromIdx, toIdx);
          saveMapList();
          ga('send', 'event', 'map', 'move');
          moved = true;
        }
        // TODO: Workaround for Android Chrome display bug
        moved && doAndroidChromiumTweak(item);
      });
    }
  });

  // import maps?
  var toimport = getParameterByName("import")
  if (toimport) {
    openImportBox(null, toimport);
  }
});

$(window).on("unload", function() {
  $("#mymaps-list").sortable('destroy');
});
