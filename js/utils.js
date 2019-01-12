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

// Extract URL parameters from current location
function getParameterByName(name, defaultValue) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null ? (isUnset(defaultValue) ? defaultValue : "") : decodeURIComponent(results[1].replace(/\+/g, " "));
}

/* ------------------ Drop down menu utils -------------------- */

// add a drop down menu item
function addSelectOption(select, optval) {
  var opt = document.createElement("option");
  opt.innerHTML = optval;
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
  $(selector).prop('checked', val);
}
/* ----------------------- Local storage -------------------------- */

// Cookie Consent plugin by Silktide - http://silktide.com/cookieconsent
window.cookieconsent_options = {
  "message": "This website uses cookies to ensure you get the best experience on our website",
  "dismiss": "Got it!",
  "learnMore": "More",
  "link": "doc/#privacy",
  "target": "_blank",
  //"container":"#map",
  "theme": "dark-bottom"
};

function canValBeSaved() {
  return window.hasCookieConsent || (window.location.toString().indexOf("file:") === 0);
}

function storeVal(name, val) {
  //log("store " + name + "=" + val);
  if (canValBeSaved()) {
    var store = window.localStorage;
    if (store) {
      if (isUnset(val)) {
        store.removeItem(name);
      } else {
        store.setItem(name, val);
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
  var v = window.localStorage ? window.localStorage.getItem(name) : undefined;
  return isUnset(v) ? defval : v;
}

function getNumVal(name, defval) {
  var v = getVal(name, defval);
  return v && parseFloat(v);
}

function getBoolVal(name, defval) {
  var v = getVal(name, defval);
  return v && v == "true";
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

/* ------------------------------ CORS URL  ---------------------------------*/
function corsUrl(url) {
    return "https://cors-anywhere.herokuapp.com/" + url;
    //return config.corsproxy.url() + config.corsproxy.query + encodeURIComponent(url);
}

/* ------------------------------ Encoding ---------------------------------*/
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
  }));
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

function copyToClipboard(msg, text) {
  window.prompt(msg + "\nCopy to clipboard: Ctrl+C, Enter", text);
}

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

/* ---------------------- Start service worker ------------------------*/

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./service-worker.js')
    .then(function() {
      console.log('Service Worker Registered');
    });
}
