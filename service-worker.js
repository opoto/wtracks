importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

if (workbox) {

  /* *
  console.log("Workbox loaded!");
  workbox.setConfig({
    debug: true
  });
  workbox.core.setLogLevel(workbox.core.LOG_LEVELS.debug);
  /* */
  //  override Browser cache, force update
  workbox.core.clientsClaim();
  workbox.core.skipWaiting();

  workbox.routing.registerRoute(
    new RegExp('/wtracks/.*'),
    // Use cache but update in the background.
    new workbox.strategies.NetworkFirst({
      cacheName: 'wtracks:local',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        })
      ],
    })
  );

  workbox.routing.registerRoute(
    new RegExp('.*'),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'wtracks:ext',
    })
  );
} else {
  console.log(`Workbox didn't load 😬`);
}
