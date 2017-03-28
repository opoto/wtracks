var config = {
  appname: "WTracks",
  email: {
    name: "olivier.potonniee",
    selector: "#email",
    domain: "gmail.com",
    subject: "WTracks"
  },
  saveprefs: function() {
    return true;
  },
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
  ign: {
    key: function() {
      // Create an IGN API key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode(
        "UM%06E%5C%1E%03%1A%0EP%06P%1B%07A%06%1CM%06%0E%1C%0EU%5D",
        "%5DHNzSBe%0A%14%1CK%1B%0E%11%19%15%0A%0D%17%5EC%23%24%7C");
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
  /*------------ activities  -----------*/
  // GraphHopper vehicles
  activities: {
    defaults: {
      "Walk / Hike": {
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters : [ [-35, 0.4722], [-25, 0.555], [-20, 0.6944], [-14, 0.8333], [-12, 0.9722],
            [-10, 1.1111], [-8, 1.1944], [-6, 1.25], [-5, 1.2638], [-3, 1.25],
            [2, 1.1111], [6, 0.9722], [10, 0.8333], [15, 0.6944], [19, 0.5555],
            [26, 0.4166], [38, 0.2777] ],
        }
      },
      "Run":{
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters : [ [-16, (12.4/3.6)], [-14,(12.8/3.6)], [-11,(13.4/3.6)], [-8,(12.8/3.6)],
            [-5,(12.4/3.6)], [0,(11.8/3.6)], [9,(9/3.6)], [15,(7.8/3.6)] ],
        }
      },
      "Bike (road)":{
        vehicle: "bike",
        speedprofile: {
          method: "refspeeds",
          parameters : [ [-6, 13.8888], [-4, 11.1111], [-2, 8.8888], [0, 7.5], [2, 6.1111],
            [4, (16/3.6)], [6, (11/3.6)] ],
        }
      },
      "Bike (mountain)":{
        vehicle: "bike",
        speedprofile: {
          method: "refspeeds",
          parameters : [ [0, 3.33] ],
        }
      },
      "Swim":{
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters : [ [0, 0.77] ],
        }
      },
      "Walk (hills)":{
        vehicle: "foot",
        speedprofile: {
          method: "polynomial",
          parameters : [1.2713272837059157,-0.0033651235698816703,-0.0006389082146566034],
        }
      }
    },
    vehicles: [ "foot" , "bike" ]
  }
}
