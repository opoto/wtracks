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
    // default display settings
    zoom: 14,
    map: "Google Terrain",
    pos: { lat: "-17.857677", lng: "177.201950" }
  },
  maxfilesize: 1024*1024, // 1GB
  compressdefault: 5,
  thunderforest: {
    key: function() {
      // Create aThunderForest account, generate a key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("%1FL%0E%13%0D%11W%18VPBQAT%1D%5BW%18%40%10%16R%00%0FA%1A%18%1C%0CCW%15",
        "%1FLN%20XJmETKE%16%5BF%5CFWYY%0DKc1-dtcvLwJ%0E");
    }
  },
  graphhopper: {
    key: function() {
      // Create a GraphHopper account, generate a key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("%1F%1AWI%0C%16%0EHJ%08A%0CBO%1A%0C%0BNZM%10%07RFC%1EI%1D%0E%11ZBY%19P%0A",
        "%1F%1A%17zYM4%15H%13FKX%5D%5B%11%0B%0FCPM6cdfp2wN%25GYFUX%1B");
    }
  },
  google: {
    mapsapikey: function() {
      // Create a Google Maps API key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("nf%15%11%3C%0D%2CL-%10%15%20%1FVO%2C%0Az%077%1D(Q2%07KGLY%1C%1D%3C%1A%1FU(%0D%26%1E", "");
    },
    analyticsid: function() {
      // Create a Google analytics trackind ID, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("znBAYM%5C%1AV%5EMEG", "zn%02r%0C%16fGTEJ%02%5D");
    }
  },
  corsproxy: {
    url: function() {
      // proxy for fetching remote track files
      return strdecode("G%5B%1B%00%1CN%40%01%10%1D%06%09%16%09%5DG%0E_%07%07%02%0E%17E%10%40B%00%0C%1F%1D%07%1F%5C%08%11%0DF%1F%11%5E",
        "G%5B%5B3I%15z%5C%12%06%01N%0C%1B%1CZ%0E%1E%1E%1A_%3F%26g5.9jL%2B%00%1C%00%10%00%00VY%1E%01%11");
    },
    query: "?url="
  },

}
