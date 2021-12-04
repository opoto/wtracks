importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.2.0/workbox-sw.js');

if (workbox) {

  /* *
  console.log("Workbox loaded!");
  workbox.setConfig({
    debug: true
  });
  workbox.core.setLogLevel(workbox.core.LOG_LEVELS.debug);
  /* */

  workbox.routing.registerRoute(
    new RegExp('/wtracks/.*'),
    // Use cache but update in the background.
    new workbox.strategies.NetworkFirst({
      cacheName: 'wtracks:local',
    })
  );

  workbox.routing.registerRoute(
    new RegExp('.*'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'wtracks:ext',
    })
  );


} else {
  console.log("Workbox didn't load 😬");
}
