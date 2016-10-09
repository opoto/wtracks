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

    var PolyStats = L.Class.extend({

        options: {
            chrono: true,
            speedProfile: [],
            onUpdate: undefined
        },

        initialize: function(polyline, options) {
            L.Util.setOptions(this, options);
            this._polyline = polyline;
            this._speedProfile = options.speedProfile;
        },

        setSpeedProfile: function(speedProfile) {

            function isSameSpeedProfile(sp1, sp2) {
                // Deep array equality test.
                if (!sp2)
                    return !sp1;

                // compare lengths - can save a lot of time
                if (sp2.length != sp1.length)
                    return false;

                for (var i = 0, l = sp1.length; i < l; i++) {
                    // Check if we have nested arrays
                    if (sp1[i] instanceof Array && sp2[i] instanceof Array) {
                        // recurse into the nested arrays
                        if (!_isSameSpeedProfile(sp1[i], sp2[i]))
                            return false;
                    } else if (sp1[i] != sp2[i]) {
                        // Warning - two different object instances will never be equal: {x:20} != {x:20}
                        return false;
                    }
                }

                return true;
            }

            if (!isSameSpeedProfile(this._speedProfile, speedProfile)) {
                this._speedProfile = speedProfile;
                if (this.options.chrono) {
                    this.updateStatsFrom(0);
                }
            }
        },

        updateStatsFrom: function(i) {

            function isUndefined(v) {
                return typeof v === "undefined";
            }

            function getAlt(latlng) {
                return latlng.alt || 0;
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
                return (altdiff / dist) * 100;
            }

            function getDuration(sp, dist, slope) {

                function distSpeed(dist, m_per_s) {
                    return dist / m_per_s;
                }

                if (sp.length == 0) return 0
                if ((sp.length == 1) ||
                    (slope <= sp[0][0]))
                    return distSpeed(dist, sp[0][1]);
                if (slope >= sp[sp.length - 1][0])
                    return distSpeed(dist, sp[sp.length - 1][1]);
                var i = 1;
                while (i < sp.length) {
                    if ((slope >= sp[i - 1][0]) && (slope < sp[i][0])) {
                        var diffslope = sp[i][0] - sp[i - 1][0];
                        var a = (sp[i][1] - sp[i - 1][1]) / diffslope;
                        var res = (a * (slope - sp[i - 1][0])) + sp[i - 1][1];
                        return distSpeed(dist, res);
                    }
                    i++;
                }
                return 0;
            }


            var pts = this._polyline.getLatLngs();
            this._polyline.stats = {
                minalt: undefined,
                maxalt: undefined,
                climbing: 0,
                descent: 0,
            }

            var stats = this._polyline.stats;
            for (var j = 0; j < pts.length; j++) {
                var pt = pts[j];
                pt.i = j;
                if (j > 0) {
                    var prevpt = pts[j - 1];
                    var reldist = getDistance3D(prevpt, pt);
                    pt.dist = prevpt.dist + reldist;
                    if (this.options.chrono) {
                        var altdiff = getAlt(pt) - getAlt(prevpt);
                        if (altdiff > 0) {
                            stats.climbing += altdiff;
                        } else {
                            stats.descent += altdiff;
                        }
                        var slope = getSlope(reldist, altdiff);
                        var relchrono = getDuration(this._speedProfile, reldist, slope);
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
                for (var j = pts.length - 1; j >= 0; j--) {
                    var pt = pts[j];
                    if (j < pts.length - 1) {
                        var nextpt = pts[j + 1];
                        var reldist = getDistance3D(nextpt, pt);
                        var altdiff = getAlt(pt) - getAlt(nextpt);
                        var slope = getSlope(reldist, altdiff);
                        var relchrono = getDuration(this._speedProfile, reldist, slope);
                        pt.chrono_rt = nextpt.chrono_rt + relchrono;
                    } else {
                        pt.chrono_rt = pt.chrono;
                    }
                }
            }
            if (this.options.onUpdate) this.options.onUpdate();
        }

    });

    L.Util.PolyStats = PolyStats;
    L.Util.polyStats = function(polyline, options) {
        return new L.Util.PolyStats(polyline, options);
    };

}, window));
