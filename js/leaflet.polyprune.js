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


    /**
     * Pruning function
     * It removes points located less then "tolerance" meters from the track between its adjacent points
     */
    var prune = function(latlngs, tolerance) {
        var initlen = latlngs.length; // initial number of points
        var pruned = [];

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

            if ((xDelta === 0) && (yDelta === 0)) {
                // startLine and endLine are the same point, return distance from this point
                return latlng.distanceTo(startLine);
            }

            var u = ((latlng.lng - startLine.lng) * xDelta + (latlng.lat - startLine.lat) * yDelta) / (xDelta * xDelta + yDelta * yDelta);

            var closestPoint;
            if (u < 0) {
                closestPoint = startLine;
            } else if (u > 1) {
                closestPoint = endLine;
            } else {
                closestPoint = L.latLng(startLine.lat + u * yDelta, startLine.lng + u * xDelta);
            }

            return latlng.distanceTo(closestPoint);
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
                    var delta = distanceFromLine(pt, prev, next);
                    if (delta > tolerance) {
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

    };

    L.PolyUtil.prune = prune;
}, window));
