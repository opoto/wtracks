function elevateMapquestCallback(res) {
    var mq = $(".mq")[0];
    var status = res.info.statuscode;
    if ((status == 0) || (status == 602)) {
      clearStatus();
      var ires = 0;
      var start = Number(mq.getAttribute("i"));
      var i = start;
      var inc = Number(mq.getAttribute("inc"));
      var pts = track.getLatLngs();
      while (ires < res.elevationProfile.length) {
        if ((pts[i].lat == res.shapePoints[ires*2]) && 
           (pts[i].lng == res.shapePoints[(ires*2)+1])) {
          pts[i].alt = res.elevationProfile[ires].height;
          ires++;
        }
        i += inc;
      }
      updateTrack(start);
    } else {
      setStatus("Elevation failed", {timeout:3, class:"status-error"});
    }
    if (status != 0) {
      warn("elevation request not OK: " + status);
    }
    mq.remove();
}

// MapQuest elevation API - free, 15000 req per month
function elevateMapquest(points, cb) {
  if (!points || (points.length == 0)) {
    return;
  }
  var locations;
  var inc = 1;
  if (typeof points.length === "undefined") {
    locations = "" + points.lat + "," + points.lng;
  } else {
    setStatus("Elevating..", {spinner: true});
    inc = Math.round(Math.max(1, points.length/30))
    locations = "";
    for (var i = 0; i < points.length; i+=inc) {
      if (i>0) locations += ","
      locations +=  points[i].lat + "," + points[i].lng;
    }
    // make sure last point is included
    if (i < points.length) {
      locations += "," + points[points.length-1].lat + "," + points[points.length-1].lng;
    }
  }
  var url = "https://open.mapquestapi.com/elevation/v1/profile?key=NZsl3dGYBR3rHv57kpACk25zkGYvHBTF&callback=elevateMapquestCallback&shapeFormat=raw&latLngCollection=" + locations;
  
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute("class", "mq")
  script.setAttribute("i", points.length ? 0 : points.i)
  script.setAttribute("inc", inc)
  script.setAttribute("cb", cb)
  script.src = url;
  document.body.appendChild(script);
}
