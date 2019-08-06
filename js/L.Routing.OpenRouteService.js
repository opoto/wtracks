// From https://github.com/willmorejg/lrm-openrouteservice
// Modified by Olivier Potonniee:
// - update to API v2
// - simplification for WTracks

(function () {
  'use strict';

  L.Routing = L.Routing || {};

  L.Routing.OpenRouteService = L.Class.extend({
    options: {
      serviceUrl: 'https://api.openrouteservice.org/v2/directions',
      timeout: 30 * 1000,
      profile: "foot-hike",
      parameters: {}
    },

    initialize: function (apiKey, options) {
      this._apiKey = apiKey;
      L.Util.setOptions(this, options);
    },

    route: function (waypoints, callback, context, options) {
      var timedOut = false,
        wps = [],
        url,
        timer,
        wp,
        i,
        locs = [], 
        reqBody;

      url = this.options.serviceUrl + '/' + (options.profile ? options.profile : this.options.profile) + '/geojson';

      options = options || {};

      for (i = 0; i < waypoints.length; i++) {
        locs.push([waypoints[i].latLng.lng, waypoints[i].latLng.lat]);

        wp = waypoints[i];
        wps.push({
          latLng: wp.latLng,
          name: wp.name,
          options: wp.options
        });
      }

      reqBody = L.extend({
        coordinates: locs,
        elevation: false,
        instructions: false,
        preference: 'recommended',
        suppress_warnings: false,
        units: 'm',
      }, this.options.parameters);

      timer = setTimeout(function () {
        timedOut = true;
        callback.call(context || callback, {
          status: -1,
          message: 'OpenRouteService request timed out.'
        });
      }, this.options.timeout);


      $.ajax({
        method: 'POST',
        url: url,
        headers: {
          Authorization: this._apiKey
        },
        data: JSON.stringify(reqBody),
        contentType: 'application/json',
        dataType: 'json'
      }).always(
        L.bind(function () {
          clearTimeout(timer);
        }, this)
      ).done(
        L.bind(function (data) {
          if (!timedOut) {
            this._routeDone(data, wps, callback, context);
          }
        }, this)
      ).fail(
        L.bind(function (err) {
          if (!timedOut) {
            callback.call(context || callback, {
              status: -1,
              message: 'HTTP request failed: ' + err
            });
          }
        }, this)
      );

      return this;
    },

    _routeDone: function (response, inputWaypoints, callback, context) {
      var alts = [],
        waypoints,
        waypoint,
        coordinates,
        i, j, k,
        instructions,
        distance,
        time,
        leg,
        steps,
        step,
        instruction,
        path;

      context = context || callback;

      if (!response.features) {
        callback.call(context, {
          status: response.type,
          message: response.details
        });
        return;
      }

      for (i = 0; i < response.features.length; i++) {
        path = response.features[i];
        coordinates = this._decodePolyline(path.geometry.coordinates);
        instructions = [];
        waypoints = [];
        time = 0;
        distance = 0;

        if (path.properties.segments) {
          for (j = 0; j < properties.segments.length; j++) {
            leg = path.properties.segments[j];
            steps = leg.steps;
            for (k = 0; k < steps.length; k++) {
              step = steps[k];
              distance += step.distance;
              time += step.duration;
              instruction = this._convertInstructions(step, coordinates);
              instructions.push(instruction);
              waypoint = coordinates[path.way_points[1]];
              waypoints.push(waypoint);
            }
          }
        }

        alts.push({
          name: 'Routing option ' + i,
          coordinates: coordinates,
          instructions: instructions,
          summary: {
            totalDistance: distance,
            totalTime: time,
          },
          inputWaypoints: inputWaypoints,
          waypoints: waypoints
        });
      }

      callback.call(context, null, alts);
    },

    _decodePolyline: function (geometry) {
      //var polylineDefined = polyline.fromGeoJSON(geometry);
      var coords = geometry, // polyline.decode(polylineDefined, 5),
        latlngs = new Array(coords.length),
        i;
      for (i = 0; i < coords.length; i++) {
        latlngs[i] = new L.LatLng(coords[i][1], coords[i][0]);
      }

      return latlngs;
    },

    _convertInstructions: function (step, coordinates) {
      return {
        text: step.instruction,
        distance: step.distance,
        time: step.duration,
        index: step.way_points[0]
      };
    },
  });

  L.Routing.openrouteservice = function (apiKey, options) {
    return new L.Routing.OpenRouteService(apiKey, options);
  };

  // Browserify
  // module.exports = L.Routing.OpenRouteService;
})();
