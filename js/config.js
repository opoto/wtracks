'use strict';
/* globals strdecode */

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
    map: "Sigma Cycle",
    pos: { lat: "-17.857677", lng: "177.201950" },
    trackColor: "#FF0000",
    trackWeight: 3,
    ovlTrackColor: "#FFAAAA",
    ovlTrackWeight: 3,
    fwdGuide: true,
    wptLabel: true,
    extMarkers: true,
    recTimeAbs: false
  },
  maxfilesize: 1024 * 1024, // 1GB
  elevationTimeout: 5000,
  pruneDist: 4,
  pruneMaxTime: "",
  pruneMaxDist: "",
  qrCodeService: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=fff&data=",
  //qrCodeService: "https://chart.googleapis.com/chart?cht=qr&chs=200x200&chld=M&chl=",
  mapsCloseOnClick: true,
  useServiceWorker: false,
  ipLookup: {
    url: function() {
      return "https://extreme-ip-lookup.com/json/?key=" +  strdecode(
        "mv%092W%26(a7%22%04%2B%3B%1B%16.%5EDE%3C",
        "w%14%0C%2F~%7C9%11%3B%3A%07'%00%5D%1B%03%5BLp%1F");
    }
  },
  graphhopper: {
    key: function() {
      // Create a GraphHopper account, generate a key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode(
        "%1F%1AWI%0C%16%0EHJ%08A%0CBO%1A%0C%0BNZM%10%07RFC%1EI%1D%0E%11ZBY%19P%0A",
        "%05xRT%25L%1F8F%10B%00y%09%17!%0EFonY%2C%09%7CG%1BL%0F%135F%1A%03z%5D%0E");
    }
  },
  google: {
    mapsapikey: function() {
      // Create a Google Maps API key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode(
        "nf%15%11%3C%0D%2CL-%10%15%20%1FVO%2C%0Az%077%1D(Q2%07KGLY%1C%1D%3C%1A%1FU(%0D%26%1E",
        "t%04%10%0C%15W%3D%3C!%08%16%2C%24%10B%01%0Fr2%14T%03%0A%08%03NB%5ED8%01d%40%7CX%2C%3F%60%15");
    },
    analyticsid: function() {
      // Create a Google analytics trackind ID, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode("znBAYM%5C%1AV%5EMEG", "");
    },
    gtagid: function() {
      // Google Tag ID for GA4
      return strdecode("h%02%3BFXD%3Em%5E'D-", "r%60%3E%5Bq%1E%2F%1DR%3FG!");
    }
  },
  ign: {
    key: function() {
      // Create an IGN API key, and return it here
      // Simple obfscuation below to avoid reuse by ommision
      return strdecode(
        "DH%05%11%0E%04%1EZ%16%0C%1D%01%16%0DA%1A%01%17%18%17%14%17%17X",
        "%5E*%00%0C'%5E%0F*%1A%14%1E%0D-KL7%04%1F-4%5D%3CLb");
    }
  },
  corsproxy: {
    url: function() {
      // proxy for fetching remote track files
      return strdecode(
        "G%5B%1B%00%1CN%40%01%10%1D%06%09%16%09%5DG%0E_%07%07%02%0E%17E%10%40B%00%0C%1F%1D%07%1F%5C%08%11%0DF%1F%11%5E",
        "%5D9%1E%1D5%14Qq%1C%05%05%05-OPj%0BW2%24K%25L%7F%14EG%12%11%3B%01_E%3F%05%15%3F%00%14-%1B");
    },
    query: "?url="
  },
  dropbox: {
    key: function() {
      return strdecode("BMX%00%0B%0E%02B%10%0F%1E%09B%18G", "X%2F%5D%1D%22T%132%1C%17%1D%05y%5EJ");
    }
  },
  geonames: {
    key: function() {
      return strdecode("X%5B%05O%07%0E%05", "B9%18%0C%25E%0D");
    }
  },
  /*------------ activities  -----------*/
  // GraphHopper vehicles
  activities: {
    defaults: {
      "Walk / Hike": {
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters: [
            [-35, 0.4722], [-25, 0.555], [-20, 0.6944], [-14, 0.8333],
            [-12, 0.9722], [-10, 1.1111], [-8, 1.1944], [-6, 1.25],
            [-5, 1.2638], [-3, 1.25], [2, 1.1111], [6, 0.9722], [10, 0.8333],
            [15, 0.6944], [19, 0.5555], [26, 0.4166], [38, 0.2777]
          ],
        }
      },
      "Run": {
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters: [
            [-16, (12.4 / 3.6)], [-14, (12.8 / 3.6)], [-11, (13.4 / 3.6)],
            [-8, (12.8 / 3.6)], [-5, (12.4 / 3.6)], [0, (11.8 / 3.6)],
            [9, (9 / 3.6)], [15, (7.8 / 3.6)]
          ],
        }
      },
      "Bike (road)": {
        vehicle: "bike",
        speedprofile: {
          method: "refspeeds",
          parameters: [
            [-6, 13.8888], [-4, 11.1111], [-2, 8.8888], [0, 7.5],
            [2, 6.1111], [4, (16 / 3.6)], [6, (11 / 3.6)]
          ],
        }
      },
      "Bike (mountain)": {
        vehicle: "bike",
        speedprofile: {
          method: "refspeeds",
          parameters: [[0, 3.33]],
        }
      },
      "Swim": {
        vehicle: "foot",
        speedprofile: {
          method: "refspeeds",
          parameters: [[0, 0.77]],
        }
      },
      "Walk (hills)": {
        vehicle: "foot",
        speedprofile: {
          method: "polynomial",
          parameters: [1.2713272837059157, -0.0033651235698816703, -0.0006389082146566034],
        }
      }
    },
    vehicles: ["foot", "bike"]
  },
  /* --------------------  MAPS -------------------------------- */
  maps: {
    "Open Topo": {
      url: '//{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      options : {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="https://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
      },
      visible: true
    },
    "OpenStreetMap": {
      url: '//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      options : {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      },
      visible: true
    },
    "OSM Hot": {
      url: '//{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      },
      visible: true
    },
    "Sigma Cycle": {
      url: '//tiles1.sigma-dc-control.com/layer5/{z}/{x}/{y}.png',
      options: {
        maxZoom: 16,
        attribution: '&copy; <a href="http://www.sigmasport.com/" target="_blank">SIGMA Sport &reg;</a> Map data <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>'
      },
      visible: true
    },
    /* Not working anymore in Jan 2022
    "OSM HikeBike": {
      //'http://{s}.tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png'
      url: '//tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      },
      visible: true
    },
    */
    "ESRI Topo": {
      url: '//server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri &mdash; Esri and GIS Community'
      },
      visible: false
    },
    "ESRI Street": {
      url: '//server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      options: {
        attribution: 'Tiles &copy; Esri &mdash; Esri &amp; al.'
      },
      visible: false
    },
    "MTB map": {
      url: 'https://tile.mtbmap.cz/mtbmap_tiles/{z}/{x}/{y}.png',
      options: {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; USGS'
      },
      visible: false
    },
    "4UMaps": {
      url: 'https://tileserver.4umaps.com/{z}/{x}/{y}.png',
      options: {
        minZoom: 4,
        maxZoom: 15,
        attribution: '&copy; <a href="https://4umaps.com">4UMaps</a> & <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      },
      visible: false
    },
    /*
    "Map1.eu": {
      url: 'http://beta.map1.eu/tiles/{z}/{x}/{y}.jpg',
      options: {
        maxZoom: 17,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &amp; <a href="http://map1.eu">map1.eu</a>'
      },
      visible: false
    },
    */
    "Google Roads": {
      url: '//{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      options: {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
      },
      visible: true
    },
    "Google Terrain": {
      url: '//{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
      options: {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
      },
      visible: true
    },
    "Google Satellite": {
      url: '//{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      options: {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
      },
      visible: true
    },
    "Google Hybrid": {
      url: '//{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',
      options:{
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google'
      },
      visible: true
    },
    "FR IGN Classic": {
      type: "wmts",
      url: function() {
        return "//wxs.ign.fr/" + config.ign.key() + "/geoportail/wmts";
      },
      options: {
        maxZoom: 18,
        layer: 'GEOGRAPHICALGRIDSYSTEMS.MAPS',
        style: 'normal',
        tilematrixset: 'PM',
        format: 'image/jpeg',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>",
      },

      visible: false
    },
    "FR IGN Plan V2": {
      type: "wmts",
      url: "//wxs.ign.fr/essentiels/geoportail/wmts",
      options: {
        maxZoom : 19,
        layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        style: 'normal',
        tilematrixset: 'PM',
        format: 'image/png',
        attribution : "&copy; <a href='http://www.ign.fr'>IGN</a>",
      },
      visible: true
    },
    "FR IGN Satellite": {
      type: "wmts",
      url: "//wxs.ign.fr/essentiels/geoportail/wmts",
      options: {
        maxZoom: 20,
        layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
        style: 'normal',
        tilematrixset: 'PM',
        format: 'image/jpeg',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>",
      },
      visible: false
    },
    "FR IGN Parcelles": {
      type: "wmts",
      overlay: true,
      url: "//wxs.ign.fr/essentiels/geoportail/wmts",
      options: {
        maxZoom: 19,
        layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
        style: 'PCI vecteur',
        tilematrixset: 'PM',
        format: 'image/png',
        attribution: "&copy; <a href='http://www.ign.fr'>IGN</a>",
      },
      visible: false
    },
    "CH Swisstopo": {
      url: "//wms.geo.admin.ch/",
      type: "wms",
      options: {
        minZoom: "5",
        maxZoom: "20",
        layers: "ch.swisstopo.pixelkarte-farbe",
        crs: "EPSG:4326",
        styles: "",
        format: "image/png",
        attribution: '© <a href="https://www.swisstopo.admin.ch/" target="_blank">Federal Office of Topography swisstopo'
      },
      visible: false
    },
    "CH Swisstopo 25e": {
      url: "//wms.geo.admin.ch/",
      type: "wms",
      options: {
        minZoom: "5",
        maxZoom: "20",
        layers: "ch.swisstopo.pixelkarte-farbe-pk25.noscale",
        crs: "EPSG:4326",
        styles: "",
        format: "image/png",
        attribution: '© <a href="https://www.swisstopo.admin.ch/" target="_blank">Federal Office of Topography swisstopo'
      },
      visible: false
    },
    "CH Satellites": {
      url: "//wms.geo.admin.ch/",
      type: "wms",
      options: {
        minZoom: "5",
        maxZoom: "20",
        layers: "ch.swisstopo.images-swissimage",
        crs: "EPSG:4326",
        styles: "",
        format: "image/png",
        attribution: '© <a href="https://www.swisstopo.admin.ch/" target="_blank">Federal Office of Topography swisstopo'
      },
      visible: false
    },
    "SP IGN Raster": {
      // https://github.com/sigdeletras/Leaflet.Spain.WMS
      type: "wms",
      url: '//www.ign.es/wms-inspire/mapa-raster',
      options: {
        layers: 'mtn_rasterizado',
        format: 'image/png',
        transparent: false,
        continuousWorld: true,
        attribution: '© <a href="http://www.ign.es/ign/main/index.do" target="_blank">Instituto Geográfico Nacional de España</a>'
      },
      visible: true
    },
    "SP ICGC Topo": {
      url: "//geoserveis.icgc.cat/icc_mapesmultibase/noutm/wmts/topo/GRID3857/{z}/{x}/{y}.jpeg",
      options: {
        style: 'default',
        attribution: "&copy; Institut Cartogràfic i Geològic de Catalunya"
      },
      visible: false
    },
    "EU Huts": {
      url:'//maps.refuges.info/hiking/{z}/{x}/{y}.png',
      options: {
        maxZoom: 18,
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> | <a href="http://wiki.openstreetmap.org/wiki/Hiking/mri">MRI</a>'
      },
      visible: true
    },
    "FI MML": {
      url: "//avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/maastokartta/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.png",
      options: {
        attribution: "&copy; Maanmittauslaitos"
      },
      visible: true
    },
    "FI MapAnts": {
      url: '//wmts.mapant.fi/wmts_EPSG3857.php?z={z}&x={x}&y={y}',
      options: {
        maxZoom: 19,
        minZoom: 7,
        attribution: '<a href="http://www.maanmittauslaitos.fi/en/digituotteet/laser-scanning-data" target="_blank">Laser scanning</a> and <a href="http://www.maanmittauslaitos.fi/en/digituotteet/topographic-database" target="_blank">topographic</a> data provided by the <a href="http://www.maanmittauslaitos.fi/en" target="_blank">National Land Survey of Finland</a> under the <a href="https://creativecommons.org/licenses/by/4.0/legalcode">Creative Commons license</a>.'
      },
      visible: false
    },
    "IT Bugianen": {
      // type: "pmtiles",
      // url: "//maki.s3.fr-par.scw.cloud/Bugianen.pmtiles",
      url: "//www.montagne.top/maki/Bugianen/{z}/{x}/{y}.jpg",
      options: {
        minZoom : 11,
        maxZoom : 18,
        minNativeZoom : 12,
        maxNativeZoom : 16,
        attribution : "&copy; CC BY-NC-SA 3.0 IT <a href='https://tartamillo.wordpress.com'>Maki</a>",
      },
      visible: false
    },
    "EU eSlope Western-Alps": {
      overlay: true,
      // type: "pmtiles",
      // url: "//maps.s3.fr-par.scw.cloud/AlpsWC_eslo.pmtiles",
      url: "//www.montagne.top/tile/AlpsWC_eslo/{z}/{x}/{y}.png",
      options: {
        opacity: 0.45,
        minNativeZoom : 13,
        maxNativeZoom : 16,
        minZoom : 13,
        maxZoom : 19,
        attribution : "&copy; CC 1.0 <a href='https://github.com/eslopemap'>E.Slope</a>; &copy; <a href='https://geoservices.ign.fr/cgu-licences'>IGN</a>; &copy; <a href='http://www.datigeo-piem-download.it/direct/Geoportale/RegionePiemonte/Licenze/New/Licenza_CC40BY.pdf'>GeoPiemonte</a>; &copy; <a href='https://www.swisstopo.admin.ch/en/home/meta/conditions/geodata/ogd.html'>SwissTopo</a>",
      },
      visible: false
    },
    "CH Swisstopo slopes": {
      url: "//wms.geo.admin.ch/",
      type: "wms",
      overlay: true,
      options: {
        opacity: 0.5,
        minZoom: "5",
        maxZoom: "20",
        layers: "ch.swisstopo.hangneigung-ueber_30",
        crs: "EPSG:4326",
        styles: "",
        format: "image/png",
        attribution: '© <a href="https://www.swisstopo.admin.ch/" target="_blank">Federal Office of Topography swisstopo'
      },
      visible: false
    },
    /* Not working anymore in Jan 2022
    "Hills": {
      overlay: true,
      url: '//tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: 'Hillshading: SRTM3 v2 (<a href="https://www2.jpl.nasa.gov/srtm/">NASA</a>)'
      },
      visible: true
    },
    */
    "Cycling": {
      overlay: true,
      url: '//tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: '<a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      },
      visible: true
    },
    "Hiking": {
      overlay: true,
      url: '//tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: '<a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      },
      visible: true
    },
    "MTB": {
      overlay: true,
      url: '//tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
      options: {
        maxZoom: 17,
        attribution: '<a href="https://waymarkedtrails.org">Waymarked Trails</a>'
      },
      visible: true
    }
  }
};
