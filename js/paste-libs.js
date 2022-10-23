'use strict';
/* globals $ */

/* Generic abstract class */
class PasteLib {
  static get name() {}
  static get enabled() {}
  static get web() {}
  static get maxSize() {}
  static get maxTime() {}
  static get maxDownloads() {}
  // private
  static get _pingUrl() { return 2; }

  static upload(name, gpx, onDone, onFail) {}
  static ping(onDone, onFail) {
    try {
      $.get(this._pingUrl)
      .done(onDone)
      .fail(onFail);
    } catch (err) {
      onFail();
    }
  }
  static delete(url, rawUrl, passcode, onDone, onFail) {}
}

/* Repository of libs */
class PasteLibs {
  // wrap private properties
  static get libs() {
    if (!this._libs) {
      this._libs = {};
    }
    return this._libs;
  }
  static get libNames() {
    if (!this._libNames) {
      this._libNames = [];
    }
    return this._libNames;
  }

  static get(name) {
    if (this._libNames.length === 0) {
      throw "No PasteLib lib registered";
    }
    let clazz = name ? this._libs[name] : this._libs[this._libNames[0]];
    if (!clazz) {
      throw "No such PasteLib: " + name;
    }
    return clazz;
  }
  static register(name, clazz) {
    this.libs[name] = clazz;
    this.libNames.push(name);
  }
}

// ------------------------------------------------------------------
// DPaste
// ------------------------------------------------------------------

class DPaste extends PasteLib {
  static get name() { return "DPaste"; }
  static get enabled() { return true;}
  static get web() { return "https://dpaste.com/"; }
  static get maxSize() { return "250KB"; }
  static get maxTime() { return "2 months"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://dpaste.com"; }

  static upload(name, gpx, onDone, onFail) {
    $.post( "//dpaste.com/api/v2/",
        { "content": gpx,
          "title": name,
          "syntax": "xml",
          "expiry_days": 60 // 1 day to 365 days (7 days is the default)
    }).done(function(data) {
      onDone(data, data + ".txt");
    }).fail(onFail);
  }
}
PasteLibs.register("dpaste", DPaste);

 // ------------------------------------------------------------------
 // HTPut
 // ------------------------------------------------------------------

 class HTPut extends PasteLib {
  static get name() { return "HTPut"; }
  static get enabled() { return false; } // CORS?
  static get web() { return "https://htput.com/"; }
  static get maxSize() { return "1MB per day"; }
  static get maxTime() { return "Unknown"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://htput.com/dummy"; }

  static upload(name, gpx, onDone, onFail) {
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

  static delete(url, rawUrl, passcode, onDone, onFail) {
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
}
PasteLibs.register("htput", HTPut);


 // ------------------------------------------------------------------
 // Friendpaste
 // ------------------------------------------------------------------

 // Does not work on Safari when 'prevent cross-site tracking' is set, because of the cookie friendpaste is setting
 class FriendPaste extends PasteLib {
  static get name() { return "FriendPaste"; }
  static get enabled() { return true;}
  static get web() { return "https://friendpaste.com/"; }
  static get maxSize() { return "approx. 80KB"; }
  static get maxTime() { return "Unknown"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://www.friendpaste.com/2fUXnFRHu53FbNyB0k5Fak/raw"; }

  static upload(name, gpx, onDone, onFail) {
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
}
PasteLibs.register("friendpaste", FriendPaste);

 // ------------------------------------------------------------------
 // TmpFile
 // ------------------------------------------------------------------


// 15s startup
 class TmpFile extends PasteLib {
  static get name() { return "TmpFile"; }
  static get enabled() { return true; }
  static get web() { return "https://glitch.com/edit/#!/tmpfile?path=README.md%3A1%3A0"; }
  static get maxSize() { return "200KB"; }
  static get maxTime() { return "1 month after unused"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://tmpfile.glitch.me/ping"; }

  static upload(name, gpx, onDone, onFail) {
    $.ajax({
      method: "POST",
      url: "https://tmpfile.glitch.me",
      data: gpx
    }).done(function(resp) {
      onDone(resp.urlAdmin, resp.url);
    }).fail(onFail);
  }

  static delete(url, rawUrl, passcode, onDone, onFail) {
    $.ajax({
      method: "DELETE",
      url: url
    })
    .done(onDone)
    .fail(onFail);
  }
}
PasteLibs.register("tmpfile", TmpFile);

 // ------------------------------------------------------------------
 // file.io
 // ------------------------------------------------------------------

class FileIO extends PasteLib {
  static get name() { return "File.io"; }
  static get enabled() { return false; } // sharing requires more than 1 request
  static get web() { return "https://file.io/"; }
  static get maxSize() { return "5GB"; }
  static get maxTime() { return "1 day"; }
  static get maxDownloads() { return "<span class='material-icons symbol'>warning</span> Once only!"; }
  static get _pingUrl() { return "https://file.io/"; }

  // this method only supports small file (< 100KB)
  static uploadSmall(name, gpx, onDone, onFail) {
    $.post( "//file.io/?expires=1d", { "text": gpx }
    ).done(function(resp) {
      if (resp.success) {
        onDone(resp.link, resp.link);
      } else {
        onFail(resp.message + (resp.error ? " (" + resp.error +")" : ""));
      }
    }).fail(onFail);
  }

  // this method supports BIG files
  static upload(name, gpx, onDone, onFail) {
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
          onFail(resp.message + (resp.error ? " (" + resp.error +")" : ""));
        }
      }).fail(onFail);
    } catch (err) {
      // browser does not support FormData, fallback to alternative method
      this.uploadSmall(name, gpx, onDone, onFail);
    }
  }

  // /!\ fileio automatically deletes file after 1st download
  static delete(url, rawUrl, passcode, onDone, onFail) {
    $.get(rawUrl).done(onDone); // read file to delete it, ignore it was already read & deleted
  }
}
PasteLibs.register("fileio", FileIO);

 // ------------------------------------------------------------------
 // transfer.sh
 // ------------------------------------------------------------------

class TransferSH extends PasteLib {
  static get name() { return "transfer.sh"; }
  static get enabled() { return false; }
  static get web() { return "https://transfer.sh"; }
  static get maxSize() { return "10GB"; }
  static get maxTime() { return "14 days"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://transfer.sh"; }

  static upload(name, gpx, onDone, onFail) {
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
}
PasteLibs.register("transfer.sh", TransferSH);

 // ------------------------------------------------------------------
 // gofile.io
 // ------------------------------------------------------------------

 class GoFileIO extends PasteLib {
  static get name() { return "gofile.io"; }
  static get enabled() { return false; } // no direct download? CORS?
  static get web() { return "https://gofile.io/"; }
  static get maxSize() { return "No limit!"; }
  static get maxTime() { return "Unknown"; }
  static get maxDownloads() { return "Unlimited"; }
  static get _pingUrl() { return "https://apiv2.gofile.io/getServer"; }

  static upload(name, gpx, onDone, onFail) {

    function _gofileUpload(server, name, gpx, onDone, onFail) {
      try {
        name = encodeURIComponent(name);
        var formData = new FormData();
        var blob = new Blob([gpx], { type: "text/xml" });
        formData.append("filesUploaded", blob, name + ".gpx");

        var gofileUrl = "https://" + server + ".gofile.io/";
        $.ajax({
          method: "POST",
          url: gofileUrl + "uploadFile",
          type: "POST",
          data: formData,
          processData: false,
          contentType: false,
        }).done(function (resp) {
          if (resp.status == "ok") {
            //$.get("https://gofile.io/?c=" + resp.data.code);
            onDone("https://gofile.io/?c=" + resp.data.code,
              gofileUrl + "download/" + resp.data.code + "/" + name + ".gpx");
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
}
PasteLibs.register("gofile.io", GoFileIO);
