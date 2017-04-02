var CACHE = 'wtracks';
var filesToCache = [
  './activities.html',
  './css/images/layers.png',
  './css/images/layers-2x.png',
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
  './img/marker-icon-2x.png',
  './img/marker-shadow.png',
  './img/marker-shadow-2x.png',
  './img/menu-icon.png',
  './img/mylocation.png',
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

/*
  On install, cache some resources.
*/
self.addEventListener('install', function(evt) {
  console.log('[ServiceWorker] installing...');
  // Ask the service worker to keep installing until the returning promise resolves.
  evt.waitUntil(precache());
});

/*
  On fetch, use cache but update the entry with the latest contents from the server.
*
self.addEventListener('fetch', function(evt) {
  console.log('[ServiceWorker] fetching: ' + evt.request.url);

  // You can use respondWith() to answer immediately, without waiting
  // for the network response to reach the service worker
  var res = fromCache(evt.request);
  if (evt.respondWith(res)) {
    console.log('[ServiceWorker] FOUND: ' + evt.request.url);
    // and waitUntil() to prevent the worker from being killed until the cache is updated.
    evt.waitUntil(update(evt.request));
  } else {
    console.log('[ServiceWorker] not in cache: ' + evt.request.url);
    fetch(evt.request).then(function (response) {
      console.log('[ServiceWorker] not in cache, fetched: ' + response);
      evt.respondWith(response);
    });
  }
});
*/

/*
  Open a cache and use addAll() with an array of assets to add all of
  them to the cache. Return a promise resolving when all the assets are added.
*/
function precache() {
  return caches.open(CACHE).then(function (cache) {
    console.log('[ServiceWorker] Caching app');
    return cache.addAll(filesToCache);
  });
}

/*
  Open the cache where the assets were stored and search for the
  requested resource. Notice that in case of no matching, the promise
  still resolves but it does with undefined as value.
*/
function fromCache(request) {
  //console.log("[SW] fromCache starting")
  return caches.open(CACHE).then(function (cache) {
    //console.log("[SW] fromCache opened")
    return cache.match(request).then(function (matching) {
//      return matching || Promise.reject('no-match');
      //console.log("[SW] fromCache macthed: " + matching)
      return matching;
    });
  });
}

/*
  Update consists in opening the cache, performing a network request
  and storing the new response data.
*/
function update(request) {
  return caches.open(CACHE).then(function (cache) {
    return fetch(request).then(function (response) {
      return cache.put(request, response);
    });
  });
}
