if (window.document.documentMode) {
  alert("Internet Explorer is not supported anymore. Please use a modern browser, such as Edge, Firefox or Chrome")
  window.location = "https://www.mozilla.org/firefox/new/"
}

/* ----------------------- LOGGING SHORTCUTS -------------------------- */

function debug(msg) {
  if (console && console.debug) {
    console.debug(msg);
  }
}

function log(msg) {
  if (console && console.log) {
    console.log(msg);
  }
}

function error(msg) {
  if (console && console.error) {
    console.error(msg);
  }
}

function warn(msg) {
  if (console && console.warn) {
    console.warn(msg);
  }
}

/* ----------------------- Testing values and types ---------------------- */

function isNumeric(obj) {
  return isFinite(String(obj));
}

function isUndefined(v) {
  return typeof v === "undefined";
}

function isUnset(v) {
  return (typeof v === "undefined") || (v === null);
}

// IE polyfill
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position) {
    position = position || 0;
    return this.indexOf(searchString, position) === position;
  };
}

function rounddec(number, decimals) {
  var coef = Math.pow(10, decimals);
  return Math.round(number * coef) / coef;
}

/* ----------------------- Html encode/decode ---------------------- */

function htmlEncode(txt) {
    return $('<div/>').text(txt).html();
}
function htmlDecode(html) {
    return $('<div/>').html(html).text();
}

/* ----------------------- Browser utilities ---------------------- */

// is current bowser safari?
function isSafari() {
  return /^((?!chrome|android|ubuntu).)*safari/i.test(navigator.userAgent);
}

// Extract URL parameters from current location, or optLocation if set
function getParameterByName(name, defaultValue, optLocation) {
  let val = new URLSearchParams(optLocation ? optLocation : window.location.search).get(name)
  return val ? val : defaultValue
}

// Remove query parameters from URL if it has some
function clearUrlQuery() {
  if (window.location.search && window.history && window.history.pushState) {
    window.history.pushState({}, document.title, window.location.pathname);
  }
}

function jsonClone(obj) {
  return $.extend(true, {}, obj);
}

function noTranslate(selector) {
    // default selector
    selector = selector ? selector : ".material-icons";
    $(selector).addClass("notranslate");
    $(selector).attr("translate", "no");
}

/* ------------------ Html utils -------------------- */

// add a drop down menu item
function addSelectOption(select, optval, optdisplay) {
  var opt = document.createElement("option");
  opt.innerHTML = optdisplay || optval;
  opt.value = optval;
  opt.setAttribute("name", optval);
  select.appendChild(opt);
}

// select a drop down menu item
function selectOption(select, optval) {
  jqselect = $(select);
  jqselect.children(":selected").prop("selected", false);
  jqselect.children("option[value='" + optval + "']").prop("selected", true);
}
// get selected drop down option
function getSelectedOption(select) {
  return $(select).children(':selected').val();
}

// get checkbox status
function isChecked(selector) {
  return $(selector).is(':checked');
}
// set checkbox status
function setChecked(selector, val) {
  $(selector).prop('checked', val === true);
}

function enableInput(condition, inputSelector) {
  if (condition) {
    $(inputSelector).removeAttr("disabled")
  } else {
    $(inputSelector).attr("disabled", "disabled")
  }
}

function setDateTimeInput(input, ptTime) {
  // get point's recorded date
  const d = new Date(ptTime)
  // get this time in local value in "normalized" format
  const v=d.getFullYear() + "-" + ("0" + (d.getMonth()+1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + "T" + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)+ ":" + ("0" + d.getSeconds()).slice(-2)
  // set input value
  input.val(v)
}

/* ----------------------- Local storage -------------------------- */

var valStorage = undefined
function getValStorage() {
  if (valStorage === undefined) {
    try {
      window.localStorage.setItem("wt_test_storage", "1");
      window.localStorage.removeItem("wt_test_storage");
      valStorage = localStorage
    } catch (err) {
      valStorage = window.sessionStorage
    }
  }
  return valStorage
}

function storeVal(name, val) {
  //log("store " + name + "=" + val);
  var store = getValStorage();
  if (store) {
    if (isUnset(val)) {
      store.removeItem(name);
    } else {
      if (typeof val != "string") {
        val = val.toString()
      }
      try {
        store.setItem(name, val);
      } catch (err) {
        var kbsz = val.length ? Math.round(val.length/1024) : 0;
        error("Cannot store value " + name + ": " + kbsz + "KB");
        ga('send', 'event', 'error', 'storeVal failed: ' + err.toString(), name, kbsz);
        // switch to sessionStorage?
      }
    }
  }
}

function storeJsonVal(name, val) {
  if (JSON && JSON.stringify) {
    v = JSON.stringify(val);
    storeVal(name, v);
  }
}

function getVal(name, defval) {
  var store = getValStorage();
  var v = store ? store.getItem(name) : undefined;
  return isUnset(v) ? defval : v;
}

function getNumVal(name, defval) {
  var v = getVal(name, defval);
  return v && parseFloat(v);
}

function getBoolVal(name, defval) {
  var v = getVal(name, defval);
  return v && (v == "true" || v === true);
}

function getJsonVal(name, defval) {
  var v = getVal(name);
  var val;
  try {
    val = v && JSON && JSON.parse ? JSON.parse(v) : undefined;
  } catch (ex) {
    error("Invalid json preference for " + name);
    v = undefined;
  }
  return isUnset(v) ? defval : val;
}

/* ---------------------- GOOGLE ANALYTICS ------------------------- */

// ga('send', 'event', category, action, label, value)

function initGoogleAnalytics(trackingid) {
  var gaScriptUrl = 'https://www.google-analytics.com/analytics.js';
  var gadbg = getVal("wt.ga.dbg", "0");
  if (gadbg != '0') {
    gaScriptUrl = 'https://www.google-analytics.com/analytics_debug.js';
  }
  /**/
  (function(i, s, o, g, r, a, m) {
    i['GoogleAnalyticsObject'] = r;
    i[r] = i[r] || function() {
      (i[r].q = i[r].q || []).push(arguments);
    }, i[r].l = 1 * new Date();
    a = s.createElement(o),
      m = s.getElementsByTagName(o)[0];
    a.async = 1;
    a.src = g;
    a.onerror = function(err) {
      error("Google Analytics blocked. Ad blocker?");
    };
    try {
      m.parentNode.insertBefore(a, m);
    } catch (err) {
      error("Google Analytics blocked. Ad blocker?");
    }
  })(window, document, 'script', gaScriptUrl, 'ga');
  if (gadbg === "2") {
    window.ga_debug = {trace: true};
  }
  ga('create', trackingid, 'auto');
  if (getBoolVal("wt.ga.off", false)) {
    log('Turning off GA reporting');
    ga('set', 'sendHitTask', null);
  }
  ga('send', 'pageview');
}

/* ---------------------- EMAIL ------------------------- */
/*
 * Open a new mail in default mail client with recipent and subject.
 * It protects the email address from spam robots by splitting the address in several parts,
 * and only assemblying them when needed for the duration of a click.
 *
 * parameters:
 * - selector: the css selector of the link or button which should open the email
 * - name: the name part of the recepient email address
 * - domain: the domain part of the recepient email address
 * - subject: the subject string of the newly created email
 *
 * Attachs a click handler to the html element designated by <selector>
 * that opens the following URL:
 * "mailto:<name>@<domain>?subject=<subject>
 */
function setEmailListener(selector, name, domain, subject) {
  $(selector).click(function() {
    function doEmail(d, i, tail) {
      location.href = "mailto:" + i + "@" + d + tail;
    }
    doEmail(domain, name, "?subject=" + subject);
    return false;
  });
}
if (config.email && config.email.selector) {
  setEmailListener(config.email.selector, config.email.name,
    config.email.domain, config.email.subject);
}

/* ------------------------------ CORS URL  --------------------------------- */
// /!\ Some set a cookie, which fails with Safari when 'prevent cross site tracking' is activated
var corsProxy =
"https://wtracks-cors-proxy.herokuapp.com/"
;
/*
"https://api.codetabs.com/v1/proxy/?quest=" // cookie
"https://api.allorigins.win/raw?url="// cookie
"https://cors-nowhere.glitch.me/"
"https://yacdn.org/proxy/"
"https://thingproxy.freeboard.io/fetch/"
"http://cors-proxy.htmldriven.com/get?url="
"http://www.whateverorigin.org/get?url="
"https://cors-anywhere.herokuapp.com/"
  */
function corsUrl(url) {
  return corsProxy + url;
  // config.corsproxy.url() + config.corsproxy.query + encodeURIComponent(url);
}

/* ------------------------------ Encoding --------------------------------- */
function n10dLocation() {
  var res = window.location.toString();
  res = res.replace(/\?.*$/, "").replace(/\#.*$/, "");
  res = res.replace(/^.*:\/\//, "//");
  res = res.replace(/index.html$/, "");
  res = res.replace(/\/*$/, "/");
  return res;
}

function getLocalCode() {
  var res = getVal("wtracks.code");
  return res;
}

function strxor(s, k) {
  var enc = "";
  // make sure that input is string
  s = s.toString();
  for (var i = 0; i < s.length; i++) {
    // create block
    var a = s.charCodeAt(i);
    // bitwise XOR
    var b = a ^ k.charCodeAt(i % k.length);
    enc = enc + String.fromCharCode(b);
  }
  return enc;
}

function getEncodeParams(s1, s2) {
  var islocal = (window.location.toString().indexOf("file:") === 0) ||
    (window.location.toString().indexOf(".dev.local:") > 0);
  var res = {
    k: islocal ? getLocalCode() : n10dLocation()
  };
  if (s1 || s2) {
    res.s = islocal ? s2 : s1;
  }
  return res;
}

function strencode(s) {
  var param = getEncodeParams();
  return encodeURIComponent(strxor(s, param.k));
}

function strdecode(s1, s2) {
  var param = getEncodeParams(s1, s2);
  return param.s ? strxor(decodeURIComponent(param.s), param.k ? param.k : "") : param.s;
}

// Base 64 encoding / decoding

function supportsBase64() {
  return btoa && atob ? true : false;
}

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode('0x' + p1);
  }))
  // Convert to URL safe base 64: replace  + and / by - and _
  .replaceAll("+", "-").replaceAll("/", "_")
}

function b64DecodeUnicode(str) {
  // Assume URL safe base 64, with - and _ instead of + and /
  str = str.replaceAll("-", "+").replaceAll("_", "/")
  return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

/* ----------------- Clipboard helpers -------------------- */

function copyToClipboard(msg, text) {
  window.prompt(msg + "\nCopy to clipboard: Ctrl+C, Enter", text);
}

/**
 * Copies the value of an HTML <input> element to the clipboard when another element is clicked
 *
 * @param {string} selector - Selector of the copy button/element
 *    This HTML element MUST HAVE a "data-copyonclick-from" attribute with the id of the input element to copy
 * @param {Object} options - Optional options:
 *    'copyOk': string to display on successful copy (default is "Copied to clipboard")
 *    'copyKO': string to display on successful copy (default is "! Cannot copy !")
 *    'statusDelay': time in ms during which the status message is displayed (default is 1 sec)
 *    'preCopy': function to call before copy (default is none)
 *    'postCopy': function to call after copy (default is none)
 */
 function copyOnClick(selector, options) {

  let copyOk = (options && options.copyOk) || "Copied to clipboard"
  let copyKO = (options && options.copyKO) || "! Cannot copy !"
  let statusDelay = (options && options.statusDelay) || 1000

  function showCopyStatus(clicked, input, statusText) {
    let temp = input.val()
    let type = input.attr("type")
    if (type == "password") {
      input.attr("type", "text")
    } else {
      type = undefined;
    }
    input.val(statusText)

    clicked.prop("disabled", true)
    input.prop("disabled", true)
    setTimeout(function() {
      if (type) {
        input.attr("type", type)
      }
      input.val(temp)
      clicked.prop("disabled", false)
      input.prop("disabled", false)
      if (options && options.postCopy) {
        options.postCopy(input)
      }
    }, statusDelay);
  }

  $(selector).click(function (event) {
    if (event.target.disabled) {
      return
    }
    let clicked = $(event.target)
    let input
    if (event.target.attributes["data-copyonclick-from"]) {
      let inputId = event.target.attributes["data-copyonclick-from"].value
      input = $("#"+inputId)
    }
    if(!input || input.length == 0) {
      console.error("copyOnClick: invalid or missing 'data-copyonclick-from' attribute")
    }
    if (options && options.preCopy) {
      options.preCopy(input)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.val())
      .then(function() { showCopyStatus(clicked, input, copyOk) })
      .catch(function() { showCopyStatus(clicked, input, copyKO) })
    } else {
      input[0].select();
      try {
        document.execCommand("copy")
        showCopyStatus(clicked, input, copyOk)
      } catch(err) {
        showCopyStatus(clicked, input, copyKO)
      }
    }
  })
}

/* ------------------ Iteration helpers ----------------- */

function arrayMove(arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr;
}

function objectForEach(object, func) {
  if (object) {
    for (var o in object) {
      if (hasOwnProperty.call(object, o)) {
        if (func(o, object[o])) break;
      }
    }
  }
}
function arrayForEach(array, func) {
  if (array) {
    var i = 0;
    var len = array.length;
    while (i < len) {
      if (func(i, array[i])) break;
      if (len > array.length) {
        len = array.length;
      } else {
        i++;
      }
    }
  }
}

function arrayLast(array) {
  return array.slice(-1)[0]
}

/* ---------------------- track errors ------------------------ */
var errors = [];

window.onerror = function(messageOrEvent, source, line, row, err) {
  var label, errmsg, notWTracks;
  try {
    label = {
      path: window.location.pathname,
      ua: navigator.userAgent,
    };
    errmsg = messageOrEvent.toString();
    notWTracks =
      (errmsg.match(/'getReadMode(Render|Extract|Config)'/g)
      && (navigator.userAgent.indexOf("HeyTapBrowser") > 0))
      ||
      errmsg.startsWith("Script error.")
      ||
      errmsg.indexOf("Refused to evaluate a string as JavaScript because 'unsafe-eval'") >= 0
      ||
      errmsg.indexOf("chrome-extension://") >= 0
      ;
    if (typeof source == "string") {
      label.location =  source + ": " + line + ", " + row;
    } else if (source) {
      label.details = source;
    }
    error(errmsg);
    if (errors.length > 0) {
      label.prev = errors;
    }
    if (err && err.stack) {
      label.stack = err.stack;
    }
    if (notWTracks) {
      label.details = label.details || {};
      label.details.notWTracks = errmsg;
      errmsg = "notWTracks";
    }
  } catch(ex) {
    errmsg = ex.toString();
    label = ex;
  }
  if (getLocalCode()) {
    alert(errmsg);
  } else if (ga) {
    ga('send', 'event', 'error', errmsg, JSON.stringify(label));
  }
  errors.push(errmsg);
}
