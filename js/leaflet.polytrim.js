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
}(function polytrimFactory(L) {

    var PolyTrim = L.Class.extend({
        statics: {
            FROM_START: 0,
            FROM_END: 1,
        },

        initialize: function(polyline, direction) {
            this._polyline = polyline;
            this._direction = direction;
            this._trimmed = [];
        },

        getDirection: function() {
            return this._direction;
        },

        getPolySize: function() {
            return this._polyline.getLatLngs().length + this._trimmed.length;
        },

        trim: function(n) {
            var _diff = n - this._trimmed.length;
            if (_diff === 0) {
                // nothing to do
                return this._trimmed.length;
            }
            var _latlngs = this._polyline.getLatLngs();
            if (this._direction === PolyTrim.FROM_START) {
                // From Start
                if (_diff > 0) {
                    this._trimmed = this._trimmed.concat(_latlngs.slice(0, _diff));
                    _latlngs = _latlngs.slice(_diff);
                } else {
                    _diff = Math.abs(_diff);
                    _latlngs = this._trimmed.slice(this._trimmed.length - _diff).concat(_latlngs);
                    this._trimmed = this._trimmed.slice(0, this._trimmed.length - _diff);
                }
            } else if (this._direction === PolyTrim.FROM_END) {
                // From End
                if (_diff > 0) {
                    this._trimmed = _latlngs.slice(_latlngs.length - _diff).concat(this._trimmed);
                    _latlngs = _latlngs.slice(0, _latlngs.length - _diff);
                } else {
                    _diff = Math.abs(_diff);
                    _latlngs = _latlngs.concat(this._trimmed.slice(0, _diff));
                    this._trimmed = this._trimmed.slice(_diff);
                }
            } else {
                return 0;
            }
            this._polyline.setLatLngs(_latlngs);
            return this._trimmed.length;
        }
    });

    L.PolyTrim = PolyTrim;
    L.polyTrim = function(polyline, direction) {
        return new L.PolyTrim(polyline, direction);
    };

}, window));
