/* ----------------------- LOGGING SHORTCUTS -------------------------- */
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

/* ----------------------- Testing undefined and null value ---------------------- */

function isUndefined(v) {
  return typeof v === "undefined";
}

function isUnset(v) {
  return (typeof v === "undefined") || (v === null);
}

/* ----------------------- LOGGING SHORTCUTS -------------------------- */
/* Extract URL parameters from current location */
function getParameterByName(name, defaultValue) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  return results === null ? (isUnset(defaultValue) ? defaultValue : "") : decodeURIComponent(results[1].replace(/\+/g, " "));
}

/* ----------------------- Local storage -------------------------- */
<!-- Begin Cookie Consent plugin by Silktide - http://silktide.com/cookieconsent -->
window.cookieconsent_options = {
  "message":"This website uses cookies to ensure you get the best experience on our website",
  "dismiss":"Got it!",
  "learnMore":"More",
  "link":"doc/#privacy",
  "target":"_blank",
  //"container":"#map",
  "theme":"dark-bottom"
};

function canValBeSaved() {
  return window.hasCookieConsent || (window.location.toString().indexOf("file:") == 0);
}

function storeVal(name, val) {
  //log("store " + name + "=" + val);
  if (canValBeSaved()) {
    var store = window.localStorage;
    if (store) {
      if (val === "") {
        store.removeItem(name);
      } else {
        store.setItem(name, val);
      }
    }
  }
}

function getVal(name, defval) {
  var v = window.localStorage ? window.localStorage.getItem(name) : undefined;
  return isUnset(v) ? defval : v;
}

/* ---------------------- GOOGLE ANALYTICS ------------------------- */

function initGoogleAnalytics(trackingid) {
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
  ga('create', trackingid, 'auto');
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
  $(selector).click(function(){
    function doEmail(d, i, tail) {
      location.href = "mailto:" + i + "@" + d + tail;
    }
    doEmail(domain, name, "?subject="+subject);
    return false;
  })
}

/* ------------------------------ Encoding ---------------------------------*/
function n10dLocation() {
  res = window.location.toString().replace(/\?.*$/,"").replace(/\#.*$/,"");
  res = res.replace(/^.*:\/\//, "//");
  res = res.replace(/index.html$/, "");
  res = res.replace(/\/*$/, "/");
  return res;
}

function strxor(s, k) {
  var enc = "";
  var str = "";
  // make sure that input is string
  str = s.toString();
  for (var i = 0; i < s.length; i++) {
    // create block
    var a = s.charCodeAt(i);
    // bitwise XOR
    var b = a ^ k.charCodeAt(i % k.length);
    enc = enc + String.fromCharCode(b);
  }
  return enc;
}
function strencode(s, k) {
  return encodeURIComponent(strxor(s, k))
}
function strdecode(s1, s2) {
  var s = (window.location.toString().indexOf("file:") == 0) ? s2: s1;
  return s ? strxor(decodeURIComponent(s), n10dLocation()) : s;
}
