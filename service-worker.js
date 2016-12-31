var cacheName = 'wtracks';
var filesToCache = [
  './activities.html',
  './css/images/layers.png',
  './css/images/layers-2x.png',
  './css/images/marker-icon.png',
  './css/images/marker-icon-2x.png',
  './css/images/marker-shadow.png',
  './css/activities.css',
  './css/dark-bottom.css',
  './css/l.geosearch.css',
  './css/leaflet-routing-machine.css',
  './css/leaflet.css',
  './css/Leaflet.Elevation-0.0.4.css',
  './css/leaflet.routing.icons.png',
  './css/leaflet.routing.icons.svg',
  './css/routing-icon.png',
  './css/wtracks.css',
  './img/alert.png',
  './img/geosearch.png',
  './img/help.png',
  './img/icons.png',
  './img/marker-icon.png',
  './img/marker-pointer.png',
  './img/marker-shadow.png',
  './img/menu-icon.png',
  './img/spinner.gif',
  './img/wtrack-icon-1x.png',
  './img/wtrack-icon-2x.png',
  './img/wtrack-icon-4x.png',
  './index.html',
  './js/activities.js',
  './js/config.js',
  './js/cookieconsent.min.js',
  './js/d3.v3.min.js',
  './js/dataset.js',
  './js/FileSaver.js',
  './js/htmlEncode.js',
  './js/jquery.flot.min.js',
  './js/jquery.min.js',
  './js/l.control.geosearch.js',
  './js/l.geosearch.provider.bing.js',
  './js/l.geosearch.provider.google.js',
  './js/l.geosearch.provider.openstreetmap.js',
  './js/leaflet-routing-machine.js',
  './js/Leaflet.Editable.js',
  './js/Leaflet.Elevation-0.0.4.js',
  './js/leaflet.filelayer.js',
  './js/leaflet.js',
  './js/leaflet.polyprune.js',
  './js/leaflet.polystats.js',
  './js/leaflet.polytrim.js',
  './js/lrm-graphhopper-1.1.2.min.js',
  './js/mapquest-elevation.js',
  './js/regression.js',
  './js/togeojson.js',
  './js/utils.js',
  './js/wtracks.js'
];

self.addEventListener('install', function(e) {
  console.log('[ServiceWorker] Install');
  e.waitUntil(
    caches.open(cacheName).then(function(cache) {
      console.log('[ServiceWorker] Caching app shell');
      return cache.addAll(filesToCache);
    })
  );
});
