var config = {
  appname: "WTracks",
  email: {
    name: "olivier.potonniee",
    selector: "#email",
    domain: "gmail.com",
    subject: "WTracks"
  },
  saveprefs: true,
  display: {
    zoom: 14,
    map: "Google Terrain",
    pos: { lat: "-17.857677", lng: "177.201950" }
  },
  maxfilesize: 1024*1024, // 1GB
  compressdefault: 5,
  graphhopperkey: function() {
    // Create a GraphHopper account, generate a key, and return it here
    // Simple obfscuation below to avoid reuse by ommision
    return strdecode("%1F%1AWI%0C%16%0EHJ%08A%0CBO%1A%0C%0BNZM%10%07RFC%1EI%1D%0E%11ZBY%19P%0A",
      "%1F%1A%17zYM4%15H%13FKX%5D%5B%11%0B%0FCPM6cdfp2wN%25GYFUX%1B");
  },
  analytics: {
    trackingid: function() {
      // Create a Google analytics trackind ID, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("znBAYM%5C%1AV%5EMEG",
        "zn%02r%0C%16fGTEJ%02%5D");
    }
  }
}
