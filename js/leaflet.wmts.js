/*
 * Copyright (c) 2008-2016 Institut National de l'Information Geographique et Forestiere (IGN) France.
 * Released under the BSD license.
 */
/*---------------------------------------------------------
 *New Leaflet's class to support WMTS (based on L.TileLayer.WMS)
 */

 var matrixIds3857= new Array(22);
 for (var i= 0; i<22; i++) {
   matrixIds3857[i]= {
       identifier    : "" + i,
       topLeftCorner : new L.LatLng(20037508,-20037508)
   };
 }

L.TileLayer.WMTS = L.TileLayer.extend({

        defaultWmtsParams: {
                service: 'WMTS',
                request: 'GetTile',
                version: '1.0.0',
                layer: '',
                style: '',
                tilematrixSet: '',
                format: 'image/jpeg',
                matrixIds: matrixIds3857
        },

        initialize: function (url, options) { // (String, Object)
                this._url = url;
                var wmtsParams = L.extend({}, this.defaultWmtsParams),
                    tileSize = options.tileSize || this.options.tileSize;
                if (options.detectRetina && L.Browser.retina) {
                        wmtsParams.width = wmtsParams.height = tileSize * 2;
                } else {
                        wmtsParams.width = wmtsParams.height = tileSize;
                }
                for (var i in options) {
                        // all keys that are not TileLayer options go to WMTS params
                        if (!this.options.hasOwnProperty(i) && i!="matrixIds") {
                                wmtsParams[i] = options[i];
                        }
                }
                this.wmtsParams = wmtsParams;
                this.matrixIds = options.matrixIds ?
                  options.matrixIds : this.defaultWmtsParams.matrixIds;
                L.setOptions(this, options);
        },

        onAdd: function (map) {
                L.TileLayer.prototype.onAdd.call(this, map);
        },

        getTileUrl: function (tilePoint, zoom) { // (Point, Number) -> String
                var map = this._map;
                crs = map.options.crs;
                tileSize = this.options.tileSize;
                nwPoint = tilePoint.multiplyBy(tileSize);
                //+/-1 pour Ãªtre dans la tuile
                nwPoint.x+=1;
                nwPoint.y-=1;
                sePoint = nwPoint.add(new L.Point(tileSize, tileSize));
                nw = crs.project(map.unproject(nwPoint, zoom));
                se = crs.project(map.unproject(sePoint, zoom));
                tilewidth = se.x-nw.x;
                zoom=map.getZoom();
                ident = this.matrixIds[zoom].identifier;
                X0 = this.matrixIds[zoom].topLeftCorner.lng;
                Y0 = this.matrixIds[zoom].topLeftCorner.lat;
                tilecol=Math.floor((nw.x-X0)/tilewidth);
                tilerow=-Math.floor((nw.y-Y0)/tilewidth);
                url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});
                return url + L.Util.getParamString(this.wmtsParams, url) + "&tilematrix=" + ident + "&tilerow=" + tilerow +"&tilecol=" + tilecol ;
        },

        setParams: function (params, noRedraw) {
                L.extend(this.wmtsParams, params);
                if (!noRedraw) {
                        this.redraw();
                }
                return this;
        }
});

L.tileLayer.wtms = function (url, options) {
        return new L.TileLayer.WMTS(url, options);
};

/* Fin / End
 *---------------------------------------------------------*/
