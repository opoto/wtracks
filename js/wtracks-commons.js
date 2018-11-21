if (config.google && config.google.analyticsid) {
  initGoogleAnalytics(config.google.analyticsid());
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
  e.stopPropagation();
  return false;
}
$(".help-b").click(toggleHelp);

function copyOnClick(event) {
  if (event.target && document.execCommand) {
    var elt = $("#" + event.target.id.substring(1));
    elt.removeAttr("disabled");
    elt.select();
    document.execCommand("copy");
    var tmp = elt.val();
    elt.val("Text copied to clipboard");
    elt.attr("disabled", "disabled");
    setTimeout(function(){
      elt.removeAttr("disabled");
      elt.val(tmp);
      elt.select();
      elt.attr("disabled", "disabled");
     }, 2000);
  }
}
$(".copyonclick").click(copyOnClick);
