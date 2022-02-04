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
}(function polypruneFactory(L) {

    var PolyPrune = L.Class.extend({

        statics: {
            /**
             * Pruning function
             * Removes points located less than a given distance from the track between its adjacent points.
             * Possible options:
             *  - tolerance: Distance in meters (default is 5)
             *  - useAlt: Use altitude to compute 3D distance (default is true)
             *  - maxTimeSec: Do not remove points where it would create a time gap greater than this number of seconds (default is none)
             *  - maxDist: Do not remove points where it would create a gap greater than this number of meters (default is none)
             */
            prune : function(latlngs, options) {

                var tolerance = 5;
                var maxDist = undefined;
                var maxTimeSec = undefined;
                var useAlt = true;
                if (options) {
                    if (!isNaN(options.tolerance)) {
                        tolerance = options.tolerance;
                    }
                    if (!isNaN(options.maxTimeSec)) {
                        maxTimeSec = options.maxTimeSec;
                    }
                    if (!isNaN(options.maxDist)) {
                        maxDist = options.maxDist;
                    }
                    if (typeof(options.useAlt) == typeof(true)) {
                        useAlt = options.useAlt;
                    }
                }

                var initlen = latlngs.length; // initial number of points
                var pruned = [];

                function areOlderThan(pt1, pt2, ageSec) {
                    var res = false
                    if (pt1.time && pt2.time) {
                        try {
                            res = (new Date(pt2.time).getTime() - new Date(pt1.time).getTime()) > (ageSec*1000)
                        } catch (error) {
                            console.error("Failed to parse GPX recorded time: " + error)
                        }
                    }
                    return res
                }
                function distance3D(pt1, pt2) {
                    var dist2d = pt1.distanceTo(pt2)
                    var dist3d
                    if (pt1.alt && pt2.alt) {
                        let height = Math.abs(pt2.alt - pt1.alt)
                        dist3d = Math.sqrt(Math.pow(dist2d,2) + Math.pow(height,2));

                    }
                    return dist3d ? dist3d : dist2d
                }

                /**
                 * Returns the closest distance (2D) of a point to a segment defined by 2 points
                 *
                 * Adapted from Pieter Iserbyt & Paul Bourke http://paulbourke.net/geometry/pointlineplane/
                 *
                 * @param startLine  First point of the segment
                 * @param endLine    Second point of the segment
                 * @return The distance
                 */
                function distanceFromLine(latlng, startLine, endLine) {

                    var xDelta = endLine.lng - startLine.lng;
                    var yDelta = endLine.lat - startLine.lat;
                    // we need all points to have altitude to compute 3D distance
                    var zDelta = !useAlt || isNaN(endLine.alt) ||
                      isNaN(startLine.alt) || isNaN(latlng.alt) ?
                      undefined : (endLine.alt - startLine.alt);
                    var closestPoint;

                    if ((xDelta === 0) && (yDelta === 0)) {
                        // startLine and endLine are the same point, return distance from this point
                        closestPoint = L.latLng(startLine.lat, startLine.lng);
                        if (!isNaN(zDelta)) {
                          closestPoint.alt = startLine.alt + zDelta / 2;
                        }
                    } else {

                      var u = ((latlng.lng - startLine.lng) * xDelta + (latlng.lat - startLine.lat) * yDelta) / (xDelta * xDelta + yDelta * yDelta);

                      if (u < 0) {
                          closestPoint = startLine;
                      } else if (u > 1) {
                          closestPoint = endLine;
                      } else {
                          closestPoint = L.latLng(startLine.lat + u * yDelta, startLine.lng + u * xDelta);
                          if (!isNaN(zDelta)) {
                            closestPoint.alt = startLine.alt + u * zDelta;
                          }
                      }

                    }


                    var dist2d = latlng.distanceTo(closestPoint);
                    var dist3d;
                    if (!isNaN(zDelta)) {
                      var zDeltaClosest = closestPoint.alt - latlng.alt;
                      dist3d = Math.sqrt(Math.pow(dist2d,2) + Math.pow(zDeltaClosest,2));
                    }

                    // return 3D distance if it could be computed, otherwise 2D
                    //console.log("2D: " + dist2d);
                    //console.log("3D: " + dist3d);
                    return isNaN(dist3d) ? dist2d : dist3d;
                }


                if (initlen > 2) { // no pruning required when 0, 1 or 2 points
                    var mindeleted = initlen; // mindeleted tracks the smallest deleted point index

                    // we always keep first point
                    pruned.push(latlngs[0]);

                    var ptmax = initlen - 1; // max point index
                    var ptlast = 0; // mast inserted point index

                    for (var i = 1; i < ptmax; i++) {

                        var prev = pruned[pruned.length - 1];
                        var next = latlngs[i + 1];

                        for (var j = i; j > ptlast; j--) {
                            var pt = latlngs[j];
                            var keepIt = false
                            keepIt ||= (maxDist && distance3D(prev, next) > maxDist)
                            keepIt ||= (maxTimeSec && areOlderThan(prev, next, maxTimeSec))
                            keepIt ||= distanceFromLine(pt, prev, next) > tolerance
                            if (keepIt) {
                                // removing i loses this pt, keep this trkpt[i]
                                latlngs[i].i = pruned.length;
                                ptlast = i;
                                pruned.push(latlngs[i]);
                                break;
                            }
                        }
                        // did we keep i?
                        if (ptlast != i) {
                            // discarded
                            mindeleted = Math.min(i, mindeleted);
                        }
                    }

                    // we always keep last point
                    latlngs[initlen - 1].i = pruned.length;
                    pruned.push(latlngs[latlngs.length - 1]);

                    return pruned;
                } else {
                    return latlngs;
                }

            }
        },

        initialize: function() {
        },
    });

    L.PolyPrune = PolyPrune;
    L.polyPrune = function() {
        return new L.PolyPrune();
    };

}, window));
