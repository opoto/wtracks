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
       "password": "dummy",
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
 // TmpFile
 // ------------------------------------------------------------------

 function tmpfileUpload(name, gpx, onDone, onFail) {
  $.ajax({
    method: "POST",
    url: "https://tmpfile.glitch.me",
    data: gpx
  }).done(function(resp) {
    onDone(resp.urlAdmin, resp.url);
  }).fail(onFail);
}

function tmpfileDelete(url, rawurl, passcode, onDone, onFail) {
  $.ajax({
    method: "DELETE",
    url: url
  })
  .done(onDone)
  .fail(onFail);
}

 // ------------------------------------------------------------------
 // file.io
 // ------------------------------------------------------------------

// this method only supports small file (< 100KB)
 function fileioUploadSmall(name, gpx, onDone, onFail) {
   $.post( "//file.io/?expires=1d", { "text": gpx }
   ).done(function(resp) {
     if (resp.success) {
       onDone(resp.link, resp.link);
     } else {
       onFail(resp.message);
     }
   }).fail(onFail);
 }

// this method supports BIG files
function fileioUpload(name, gpx, onDone, onFail) {
  try {
    var formData = new FormData();
    var blob = new Blob([gpx], { type: "text/xml" });
    formData.append("file", blob, "dummy");

    $.ajax({
      url: "//file.io/?expires=1d",
      type: "POST",
      data: formData,
      processData: false,
      contentType: false,
    }).done(function (resp) {
      if (resp.success) {
        onDone(resp.link, resp.link);
      } else {
        onFail(resp.message);
      }
    }).fail(onFail);
  } catch (err) {
    // browser does not support FormData, fallback to atlernative method
    fileioUploadSmall(name, gpx, onDone, onFail);
  }
}

// fileio deletes file after 1st download
function fileioDelete(url, rawurl, passcode, onDone, onFail) {
  $.get(rawurl).done(onDone); // read file to delete it, ignore it was already read & deleted
}

 // ------------------------------------------------------------------
 // transfer.sh
 // ------------------------------------------------------------------

function transferUpload(name, gpx, onDone, onFail) {
  function getId() {
    return Math.random().toString(36).substring(2);
  }
  var id = getId() + "-" + getId();
  var sharedurl = "//transfer.sh/" + id;
  $.ajax({
    url: sharedurl,
    type: 'PUT',
    timeout: 60000,
    dataType: "json",
    data: gpx,
  }).done(function(resp) {
    if (resp.status === "ok") {
      onDone(resp.text, resp.text);
    } else {
      onFail(resp);
    }
  }).fail(onFail);
}

 // ------------------------------------------------------------------
 // gofile.io
 // ------------------------------------------------------------------

function gofileUpload(name, gpx, onDone, onFail) {
  function _gofileUpload(server, name, gpx, onDone, onFail) {
    try {
      var formData = new FormData();
      var blob = new Blob([gpx], { type: "text/xml" });
      formData.append("filesUploaded", blob, "wtracks.gpx");

      var gofileUrl = "https://" + server + ".gofile.io/";
      $.ajax({
        method: "POST",
        url: gofileUrl + "upload",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
      }).done(function (resp) {
        if (resp.status == "ok") {
          //$.get("https://gofile.io/?c=" + resp.data.code);
          onDone("https://gofile.io/?c=" + resp.data.code,
            gofileUrl + "download/" + resp.data.code + "/wtracks.gpx");
        } else {
          onFail("gofile upload failed: " + resp.status);
        }
      }).fail(onFail);
    } catch (err) {
      onFail("gofile upload failed: formData not supported");
    }
  }

  $.get("//apiv2.gofile.io/getServer").done(function (resp) {
    if (resp.status == "ok" && resp.data && resp.data.server) {
      _gofileUpload(resp.data.server, name, gpx, onDone, onFail);
    } else {
      onFail("failed to get gofile server");
    }
  }).fail(onFail);

}

 // ------------------------------------------------------------------
 // Common
 // ------------------------------------------------------------------

 function pingUrl(url, onDone, onFail) {
  try {
    $.ajax({
      method: "GET",
      url: url,
    })
    .done(onDone)
    .fail(onFail);
  } catch (err) {
    onFail();
  }
 }

 // when no delete API available
 var noDelete = function() {};

 // ------------------------------------------------------------------
 // The share library
 // ------------------------------------------------------------------


var pastesLib = {
  "friendpaste": {
    "enabled": false,
    "name": "FriendPaste",
    "web": "https://friendpaste.com/",
    "maxSize": "Approx. 80KB",
    "maxTime": "Unknown",
    "maxDownloads": "Unlimited",
    "upload": friendpasteUpload,
    "ping": function(done, fail) { pingUrl("https://friendpaste.com/4yufAYfTKm8xKMJuXPDRhs/raw", done, fail); },
    "delete": noDelete
  },
  "tmpfile": {
    "enabled": true,
    "name": "TmpFile",
    "web": "https://glitch.com/edit/#!/tmpfile?path=README.md%3A1%3A0",
    "maxSize": "200KB",
    "maxTime": "1 month after unused",
    "maxDownloads": "Unlimited",
    "upload": tmpfileUpload,
    "ping": function(done, fail) { pingUrl("https://tmpfile.glitch.me/ping", done, fail); },
    "delete": tmpfileDelete
  },
  "htput": { // expired certificate
    "name": "HTPut",
    "enabled": false,
    "web": "https://htput.com/",
    "maxSize": "1MB per day",
    "maxTime": "Unknown",
    "maxDownloads": "Unlimited",
    "upload": htputUpload,
    "ping": function(done, fail) { pingUrl("https://htput.com/dummy", done, fail); },
    "delete": htputDelete
  },
  "dpaste": { // no HTTPS
    "name": "DPaste",
    "enabled": false,
    "web": "https://dpaste.com/",
    "maxSize": "Unknown",
    "maxTime": "2 months",
    "maxDownloads": "Unlimited",
    "upload": dpasteUpload,
    "delete": noDelete
  },
    "fileio": {
    "name": "file.io",
    "enabled": false, // sharing requires more than 1 request
    "web": "https://file.io/",
    "maxSize": "5GB",
    "maxTime": "1 day",
    "maxDownloads": "<span class='material-icons symbol'>warning</span> Once only!",
    "upload": fileioUpload,
    "delete": fileioDelete
  },
  "transfer.sh": {
    "name": "transfer.sh",
    "enabled": false,
    "web": "https://transfer.sh",
    "maxSize": "10GB",
    "maxTime": "14 days",
    "maxDownloads": "Unlimited",
    "upload": transferUpload,
    "delete": noDelete
  },
  "gofile": {
    "name": "gofile.io",
    "enabled": false,
    "web": "https://gofile.io/",
    "maxSize": "No limit!",
    "maxTime": "Unknown",
    "maxDownloads": "Unlimited",
    "upload": gofileUpload,
    "delete": noDelete
  }
};
