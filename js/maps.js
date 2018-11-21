/* ----------------- My maps edition ------------------- */

var mymaps = getJsonVal("wt.mymaps", {});
var mymap;


function addMymapsItem(name) {
  var mapitem = "<li draggable='true'><span class='map-item'>";
  mapitem += "<i class='material-icons map-drag'>drag_indicator</i> ";
  mapitem += "<span class='map-name'>" + name + "</span> ";
  mapitem += "<i class='material-icons map-edit'>create</i> ";
  mapitem += "<i class='material-icons map-visibility' isVisible='true'>visibility</i> ";
  mapitem += "<i class='material-icons map-share'>share</i> ";
  mapitem += "<i class='material-icons map-delete'>delete</i> ";
  mapitem += "</span></li>";
  $("#mymaps-list").append(mapitem);
}

function getMapName(elt) {
  return elt.parentNode.querySelector(".map-name").innerText;
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

function deleteMymap(mymapname) {
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
$("#mymap-reset").click(resetMymap);
$("input:radio[name=mymap-type]").change(changeMymapType);

listMymaps();

// ---------------- Import / export my maps

function openExportMymaps(mymapname) {
  var toexport = mymapname ? { mymapname : mymaps[mymapname] } : mymaps;
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
    ga('send', 'event', 'map', 'export', undefined, mymaps.length);
  }
}

function openImportMymaps() {
  $("#input-text").text("Paste exported map data (Ctrl+V & Enter):");
  $("#input-val").val("");
  $("#input-ok").show();
  $("#input-box").show();
  $("#input-val").focus();
  $("#input-val").attr("readonly", undefined);
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

// ----------------- draggable list ----------------

var dragSrcEl = null;

function handleDragStart(e) {
  dragSrcEl = e.currentTarget;
  dragSrcEl.classList.add('dragElem');

  e.originalEvent.dataTransfer.effectAllowed = 'move';
  e.originalEvent.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Necessary. Allows us to drop.
  }
  e.currentTarget.classList.add('over');

  e.originalEvent.dataTransfer.dropEffect = 'move';  // See the section on the DataTransfer object.
  return false;
}

function handleDragEnter(e) {
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation(); // Stops some browsers from redirecting.
  }
  var dropOn = e.currentTarget;

  // Don't do anything if dropping the same map item we're dragging.
  if (dragSrcEl != dropOn) {
    dropOn.parentNode.removeChild(dragSrcEl);
    var dropHTML = e.originalEvent.dataTransfer.getData('text/html');
    dropOn.insertAdjacentHTML('beforebegin',dropHTML);
    dragSrcEl = dropOn.previousSibling;
    addDnDHandlers($(dragSrcEl));

  }
  dropOn.classList.remove('over');
  dragSrcEl.classList.remove('dragElem');
  return false;
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('over');
}

function addDnDHandlers(selector) {
  selector.on("dragstart", handleDragStart);
  selector.on("dragenter", handleDragEnter);
  selector.on("dragover", handleDragOver);
  selector.on("dragleave", handleDragLeave);
  selector.on("drop", handleDrop);
  selector.on("dragend", handleDragEnd);
}

$(document).ready(function() {
  addDnDHandlers($('#mymaps-list li'));

  $(".map-edit").click(function(e){
    var name = getMapName(e.target);
    editMymap(name);
  });
  $(".map-visibility").click(function(e){
    var name = getMapName(e.target);
    var isVisible = e.target.getAttribute("isVisible") == "true";
    isVisible = !isVisible;
    e.target.setAttribute("isVisible", "" + isVisible);
    e.target.innerText = isVisible ? "visibility" : "visibility_off";
  });
  $(".map-delete").click(function(e){
    var name = getMapName(e.target);
    deleteMymap(name);
  });
  $(".map-share").click(function(e){
    var name = getMapName(e.target);
    openExportMymaps(name);
  });
});

$(window).on("unload", function() {
});
