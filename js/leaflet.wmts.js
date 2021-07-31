/*
  * From https://github.com/alexandre-melard/leaflet.TileLayer.WMTS
  * Updated by Olivier Potonniée
*/

L.TileLayer.WMTS = L.TileLayer.extend({
  defaultWmtsParams: {
    service: 'WMTS',
    request: 'GetTile',
    version: '1.0.0',
    layer: '',
    style: '',
    tilematrixset: '',
    format: 'image/jpeg'
  },

  initialize: function (url, options) { // (String, Object)
    this._url = url;
    var lOptions = {};
    var cOptions = Object.keys(options);
    cOptions.forEach(element => {
      lOptions[element.toLowerCase()] = options[element];
    });
    var wmtsParams = L.extend({}, this.defaultWmtsParams);
    var tileSize = lOptions.tileSize || this.options.tileSize;
    if (lOptions.detectRetina && L.Browser.retina) {
      wmtsParams.width = wmtsParams.height = tileSize * 2;
    } else {
      wmtsParams.width = wmtsParams.height = tileSize;
    }
    for (var i in lOptions) {
      // all keys that are in defaultWmtsParams options go to WMTS params
      if (wmtsParams.hasOwnProperty(i) && i != "matrixIds") {
        wmtsParams[i] = lOptions[i];
      }
    }
    this.wmtsParams = wmtsParams;
    L.setOptions(this, options);
  },

  onAdd: function (map) {
    this._crs = this.options.crs || map.options.crs;
    L.TileLayer.prototype.onAdd.call(this, map);
  },

  getTileUrl: function (coords) { // (Point, Number) -> String
    var url = L.Util.template(this._url, { s: this._getSubdomain(coords) });
    return url + L.Util.getParamString(this.wmtsParams, url) + "&tilematrix=" + this._getZoomForUrl() + "&tilerow=" + coords.y + "&tilecol=" + coords.x;
  },

  setParams: function (params, noRedraw) {
    L.extend(this.wmtsParams, params);
    if (!noRedraw) {
      this.redraw();
    }
    return this;
  },

});

L.tileLayer.wmts = function (url, options) {
  return new L.TileLayer.WMTS(url, options);
};

/* Fin / End
 *---------------------------------------------------------*/
