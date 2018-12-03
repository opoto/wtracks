/*
 * Prune points from a polyline
 *
 * Requires leafletjs
 */

(function(factory, window) {
    // define an AMD module that relies on 'leaflet'
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], function(L) {
            factory(L);
        });
    } else if (typeof module === 'object' && module.exports) {
        // require('LIBRARY') returns a factory that requires window to
        // build a LIBRARY instance, we normalize how we use modules
        // that require this pattern but the window provided is a noop
        // if it's defined
        module.exports = function(root, L) {
            if (L === undefined) {
                if (typeof window !== 'undefined') {
                    L = require('leaflet');
                } else {
                    L = require('leaflet')(root);
                }
            }
            factory(L);
            return L;
        };
    } else if (typeof window !== 'undefined' && window.L) {
        factory(window.L);
    }
}(function polystatsFactory(L) {

    function isUndefined(v) {
        return typeof v === "undefined";
    }

    function getDistance3D(latlng1, latlng2) {
        var dist = latlng1.distanceTo(latlng2);
        var alt1 = latlng1.alt;
        var alt2 = latlng2.alt;
        if (!isUndefined(alt1) && !isUndefined(alt2)) {
            var b = alt1 - alt2;
            dist = Math.sqrt((dist * dist) + (b * b));
        }
        return dist;
    }

    function getSlope(dist, altdiff) {
      if ((dist === 0) || (altdiff === 0)) {
        return 0;
      } else {
        return (altdiff / dist) * 100;
      }
    }

    // utility function to sort speedRefs by increasing slope
    function sortSpeedRefs(speedRefs) {
        speedRefs.sort(function(a, b) {
            return a[0] - b[0];
        });
    }

    // speedprofile computation methods
    var REFSPEEDS = "refspeeds";
    var POWER = "power";
    var LINEAR = "linear";
    var POLYNOMIAL = "polynomial";

    var computeSpeedEngines = {};
    computeSpeedEngines[REFSPEEDS] = function(slope, params) {
      if (params.length === 0) {
        return 0;
      }

      // clone and sort
      params = params.slice(0);
      sortSpeedRefs(params);

      if ((params.length == 1) || (slope <= params[0][0])) {
          return params[0][1];
      }
      if (slope >= params[params.length - 1][0]) {
          return params[params.length - 1][1];
      }
      var i = 1;
      while (i < params.length) {
          if ((slope >= params[i - 1][0]) && (slope < params[i][0])) {
              var diffslope = params[i][0] - params[i - 1][0];
              var a = (params[i][1] - params[i - 1][1]) / diffslope;
              var res = (a * (slope - params[i - 1][0])) + params[i - 1][1];
              return res;
          }
          i++;
      }
      return 0;
    };
    computeSpeedEngines[POWER] = function(slope, params) {
      return params[0] * Math.pow(slope , params[1]);
    };
    computeSpeedEngines[LINEAR] = function(slope, params) {
      return slope * params[0] + params[1];
    };
    computeSpeedEngines[POLYNOMIAL] = function(slope, params) {
      var v = params[0];
      var degree = params.length-1;
      var d = 1;
      while (d <= degree) {
        v += params[d] * Math.pow(slope, d);
        d++;
      }
      return v;
    };

    var PolyStats = L.Class.extend({

        statics: {
            REFSPEEDS: REFSPEEDS,
            POWER: POWER,
            LINEAR: LINEAR,
            POLYNOMIAL: POLYNOMIAL,
        },

        options: {
            chrono: true,
            speedProfile: {
              method: REFSPEEDS,
              parameters: [0, 1.25],
            },
            onUpdate: undefined,
            // speeds below this value will be floored to this value
            minspeed: 0.05
        },

        initialize: function(polyline, options) {
            L.Util.setOptions(this, options);
            this._polyline = polyline;
            this._speedProfile = options.speedProfile;
        },

        getSpeed: function(slope, sp) {
          var engine = computeSpeedEngines[sp.method];
          var speed = engine(slope, sp.parameters);
          return Math.max(this.options.minspeed, speed);
        },

        computeSpeedProfileFromSpeeds: function(refspeeds, method,
          iterations, pruning, polydeg, threshold) {

          refspeeds.sort(function(a, b) {
            return a[0] - b[0];
          });
          var sp = {
            "method": method,
            "parameters": [],
            "refspeeds": refspeeds,
          };

          var engine = computeSpeedEngines[method];

          var pruned = refspeeds.slice(0);
          var i;

          if (threshold) {
            // prune speeds below threshold
            i = 0;
            while (i < pruned.length) {
              if (pruned[i][1] < this.options.threshold) {
                pruned.splice(i, 1);
              } else {
                i++;
              }
            }
          }

          // only proceed if we have at least 2 refspeeds and engine found
          if ((method !== REFSPEEDS) && (refspeeds.length > 1) && engine) {

            // compute speed profile using regression method
            for (var iter=0; iter < iterations; iter++) {
              var compreg = regression(method, pruned, polydeg);
              sp.parameters = compreg.equation;
              //sp.speedsamples = compreg.points;
              for (i = 0; i < pruned.length;) {
                var slope = pruned[i][0];
                var speed = pruned[i][1];
                var estimatedspeed = engine(slope, sp.parameters);
                var error = Math.abs((estimatedspeed / speed) - 1);
                if (error > pruning) {
                  pruned.splice(i, 1);
                } else {
                  i++;
                }
              }
            }
          } else {
            i = 0;
            var maxi = pruned.length-1;
            var s = pruned[i][0];
            var maxs = pruned[maxi][0];
            // include at most 15 values
            var inc = Math.round(Math.max(3, (maxs - s)/15));
            // compute relative within interval of 'inc' slopes
            var sum = 0;
            var count = 0;
            while (i < maxi) {
              // considered slopes
              var si = pruned[i][0];
              // is si in current interval?
              if (si > s + inc) {
                // we're leaving an interval
                // check there was at least one value in this interval
                if (count) {
                  // add refspeed
                  sp.parameters.push([s+(inc/2),sum/count]);
                }
                // advance to next interval
                s = s + inc;
                sum = 0;
                count = 0;
              }
              // relative slope weight inside current interval
              var weight = (si - s / (inc/2));
              if (weight > 1) {
                weight = 2 - weight;
              }
              sum += (refspeeds[i][1] * weight);
              count += weight;
              i++;
            }
          }
          return sp;
        },

        computeSpeedProfileFromTrack: function(geojson, method,
          iterations, pruning, polydeg, threshold) {

          function newLatLng(coord) {
            var point = L.latLng(coord[1], coord[0]);
            if (coord.length > 2) {
              // alt
              point.alt = coord[2];
            }
            return point;
          }

          // array of <slope, speed> pairs
          var refspeeds = [];

          // extract <slope, speed> pairs from the track(s)
          L.geoJson(geojson,{
            onEachFeature: function(f) {
              if (f.geometry.type === "LineString") {
                  var coords = f.geometry.coordinates;
                  // track's time data
                  var times = f.properties.coordTimes && (f.properties.coordTimes.length == coords.length) ? f.properties.coordTimes : undefined;
                  // only consider the track if it has time data
                  if (times) {
                    var prevpt;
                    var prevtime;
                    for (var i = 0; i < coords.length; i++) {
                      var pt = newLatLng(coords[i]);
                      // only consider points with altitude
                      if (!isUndefined(pt.alt)) {
                        var time = new Date(times[i]);
                        if (prevpt) {
                          var dist = getDistance3D(prevpt, pt);
                          var diffalt = pt.alt - prevpt.alt;
                          var difftime = (time - prevtime) / 1000;
                          if ((dist > 0) && (difftime > 0)) {
                            var slope = getSlope(dist, diffalt);
                            var speed = dist / difftime;
                            refspeeds.push([slope, speed]);
                          }
                        }
                        prevpt = pt;
                        prevtime = time;
                      }
                    }
                  }
              }
            }
          });

          return this.computeSpeedProfileFromSpeeds(refspeeds, method,
            iterations, pruning, polydeg, threshold);
        },

        setSpeedProfile: function(speedProfile) {

            function isSameSpeedProfile(sp1, sp2) {
                // The lazy way
                return (JSON.stringify(sp1) === JSON.stringify(sp2));
            }

            if (!isSameSpeedProfile(this._speedProfile, speedProfile)) {
                this._speedProfile = speedProfile;
                if (this.options.chrono) {
                    this.updateStatsFrom(0);
                }
            }
        },

        updateStatsFrom: function(i) {

            function getAlt(latlng) {
                return latlng.alt || 0;
            }

            function getDuration(sp, dist, slope) {
                var speed = this.getSpeed(slope, sp);
                return dist / speed;
            }

            var pts = this._polyline.getLatLngs();
            this._polyline.stats = {
                minalt: undefined,
                maxalt: undefined,
                climbing: 0,
                descent: 0,
            };

            var stats = this._polyline.stats,
                j, pt, slope, relchrono, reldist, altdiff;
            for (j = 0; j < pts.length; j++) {
                pt = pts[j];
                pt.i = j;
                if (j > 0) {
                    var prevpt = pts[j - 1];
                    reldist = getDistance3D(prevpt, pt);
                    pt.dist = prevpt.dist + reldist;
                    if (this.options.chrono) {
                        altdiff = getAlt(pt) - getAlt(prevpt);
                        if (altdiff > 0) {
                            stats.climbing += altdiff;
                        } else {
                            stats.descent += altdiff;
                        }
                        slope = getSlope(reldist, altdiff);
                        relchrono = getDuration.call(this, this._speedProfile, reldist, slope);
                        pt.chrono = prevpt.chrono + relchrono;
                    }
                } else {
                    pt.dist = 0;
                    if (this.options.chrono) {
                        pt.chrono = 0;
                    }
                }

                if (!isUndefined(pt.alt)) {
                    if (isUndefined(stats.minalt) || (pt.alt < stats.minalt)) {
                        stats.minalt = pt.alt;
                    }
                    if (isUndefined(stats.maxalt) || (pt.alt > stats.maxalt)) {
                        stats.maxalt = pt.alt;
                    }
                }

            }
            if (this.options.chrono) {
                // compute chrono for round trip
                for (j = pts.length - 1; j >= 0; j--) {
                    pt = pts[j];
                    if (j < pts.length - 1) {
                        var nextpt = pts[j + 1];
                        reldist = getDistance3D(nextpt, pt);
                        altdiff = getAlt(pt) - getAlt(nextpt);
                        slope = getSlope(reldist, altdiff);
                        relchrono = getDuration.call(this, this._speedProfile, reldist, slope);
                        pt.chrono_rt = nextpt.chrono_rt + relchrono;
                    } else {
                        pt.chrono_rt = pt.chrono;
                    }
                }
            }
            if (this.options.onUpdate) this.options.onUpdate();
        }

    });

    L.PolyStats = PolyStats;
    L.polyStats = function(polyline, options) {
        return new L.PolyStats(polyline, options);
    };

}, window));
