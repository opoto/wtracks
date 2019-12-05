/**
 *
 */

// requires JQuery


// ------------------------------------------------------------------
// DPaste
// ------------------------------------------------------------------

 function dpasteUpload(name, gpx, onDone, onFail) {
   $.post( "//dpaste.com/api/v2/",
      { "content": gpx,
         "title": name,
         "poster": "WTracks",
         "syntax": "xml",
         "expiry_days": 60
   }).done(function(data) {
     onDone(data, data + ".txt");
   }).fail(onFail);
 }

 // ------------------------------------------------------------------
 // HTPut
 // ------------------------------------------------------------------

 function htputUpload(name, gpx, onDone, onFail) {
   function getId() {
     return Math.random().toString(36).substring(2);
   }
   var id = getId() + "-" + getId();
   var sharedurl = "//htput.com/" + id;
   $.ajax({
     url: sharedurl,
     type: 'PUT',
     dataType: "json",
     data: gpx,
   }).done(function(resp) {
     if (resp.status === "ok") {
       sharedurl = window.location.protocol + sharedurl;
       onDone(sharedurl, sharedurl + "?contentType=text/plain", resp.pass);
     } else {
       onFail(resp.error_msg);
     }
   }).fail(onFail);
 }
 function htputDelete(url, rawurl, passcode, onDone, onFail) {
   $.ajax({
     url: url,
     type: 'DELETE',
     headers: {
       "Htput-pass": passcode
     },
     dataType: "json"
   }).done(function(resp) {
     if (onDone && resp.status === "ok") {
       onDone();
     } else if (onFail) {
       onFail(resp.error_msg);
     }
   }).fail(onFail);
 }

 // ------------------------------------------------------------------
 // Friendpaste
 // ------------------------------------------------------------------

 function friendpasteUpload(name, gpx, onDone, onFail) {
   $.ajax({
     method: "POST",
     url: "//www.friendpaste.com/",
     dataType: "json",
     contentType:"application/json; charset=utf-8",
     data: JSON.stringify({
       "title": name,
       "snippet": gpx,
       "password": "moncode",
       "language": "xml"
     })
   }).done(function(resp) {
     if (resp.ok) {
       onDone(resp.url + "?rev=" + resp.rev, resp.url + "/raw?rev=" + resp.rev);
     } else {
       onFail(resp.reason);
     }
   }).fail(onFail);
 }

 // ------------------------------------------------------------------
 // file.io
 // ------------------------------------------------------------------


 function fileioUpload(name, gpx, onDone, onFail) {
   $.post( "//file.io/?expires=1d", { "text": gpx }
   ).done(function(resp) {
     if (resp.success) {
       onDone(resp.link, resp.link);
     } else {
       onFail(resp.message);
     }
   }).fail(onFail);
 }

 // ------------------------------------------------------------------
 // Common
 // ------------------------------------------------------------------


 // for shares who cannot delete
 function noDelete() {
     warn("Delete of temp sharing no implemented");
 }
 // silently does nothing
 function nop() {}

 // ------------------------------------------------------------------
 // The share library
 // ------------------------------------------------------------------


var pastesLib = {
   "friendpaste": {
     "name": "FriendPaste",
     "web": "https://friendpaste.com/",
     "upload": friendpasteUpload,
     "delete": noDelete
   },
   "htput": { // expired certificate
     "name": "HTPut",
     "web": "https://htput.com/",
     "upload": htputUpload,
     "delete": htputDelete
   },
   "dpaste": { // no HTTPS
     "name": "DPaste",
     "web": "https://dpaste.com/",
     "upload": dpasteUpload,
     "delete": noDelete
   },
   "fileio": {
     "name": "file.io",
     "web": "https://file.io/",
     "upload": fileioUpload,
     "delete": nop // no need to delete
   }
 };
