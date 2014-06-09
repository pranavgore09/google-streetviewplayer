
var streetviewPlayer = null;

$(function() {

	$("#progress").mousedown(function(e) {
		var jProgress = $("#progress");
		var iFrame = Math.floor(streetviewPlayer.getTotalFrames() * ((e.pageX-jProgress.offset().left)/jProgress.width()))
		streetviewPlayer.setProgress(iFrame);
	});

	var sQuery = window.location.hash;
	if(sQuery && sQuery.length) {
		if(sQuery.indexOf("origin=")!=-1) {
			var sStart = sQuery.substring(sQuery.indexOf("=")+1,sQuery.indexOf("&"));
			var sEnd = sQuery.substring(sQuery.lastIndexOf("=")+1);

			document.getElementById("origin").value = unescape(sStart);
			document.getElementById("destination").value = unescape(sEnd);

			initMovie()
		}
	}
})

function pauseMovie(btn) {
	if(streetviewPlayer.getPaused()===false) {
		streetviewPlayer.setPaused(true);
		btn.value = "Play";
	} else {
		streetviewPlayer.setPaused(false);
		btn.value = "Pause";
	}
}

function importGXP(elFile) {
  try {
    var oReader = new FileReader();
    oReader.onload = function (oFile) {
      var sXml = oReader.result;
      if (window.DOMParser) {
        xmlDoc = (new DOMParser()).parseFromString(sXml, "text/xml");
      }
      else // Internet Explorer
      {
        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = false;
        xmlDoc.loadXML(sXml); 
      }

      // Traditional GPX1.1
      var aPoints = xmlDoc.getElementsByTagName("trkpt")
      if (aPoints.length === 0) {
        // Attempt to find Garmin Extended Points
        aPoints = xmlDoc.getElementsByTagNameNS("http://www.garmin.com/xmlschemas/GpxExtensions/v3", "rpt");
      }

      var aLatLng = [];
      for (var i = 0, length = aPoints.length; i < length; i+=10) {
        aLatLng.push(new google.maps.LatLng(aPoints[i].getAttribute("lat")*1, aPoints[i].getAttribute("lon")))
      }

      playRoute({
        overview_path: aLatLng
      });
    };
    oReader.readAsText(elFile.files[0]);
  }
  catch(e) {
    alert("Error uploading file, please try a new file or a new browser.");
  }
}

function playRoute(aLatLng) {

	streetviewPlayer = new google.maps.StreetViewPlayer({
		route: aLatLng,
		movieCanvas: document.getElementById("draw"),
		mapCanvas: document.getElementById("map"),
		onLoading: function() {
			document.getElementById("draw").className = "loading"
			document.getElementById("controls").style.visibility = "hidden";
		},
		onPlay: function() {
			document.getElementById("draw").className = "";
			document.getElementById("controls").style.visibility = "visible";
		},
		onProgress: function(progress) {
			document.getElementById("progressbar").style.width = progress + "%"
		}
	})

}

function initMovie() {
	streetviewPlayer = new google.maps.StreetViewPlayer({
		origin: document.getElementById("origin").value,
		destination: document.getElementById("destination").value,
		travelMode: google.maps.TravelMode.DRIVING,
		movieCanvas: document.getElementById("draw"),
		mapCanvas: document.getElementById("map"),
		onLoading: function() {
			document.getElementById("draw").className = "loading"
			document.getElementById("controls").style.visibility = "hidden";
		},
		onPlay: function() {
			document.getElementById("draw").className = "";
			document.getElementById("controls").style.visibility = "visible";
		},
		onProgress: function(progress) {
			document.getElementById("progressbar").style.width = progress + "%"
		}
	})
}

function speedUpMovie() {
	streetviewPlayer.setPlaySpeed(streetviewPlayer.getPlaySpeed()-100);
}

function slowDownMovie() {
	streetviewPlayer.setPlaySpeed(streetviewPlayer.getPlaySpeed()+100);
}

function buildMovie() {
	var data = streetviewPlayer.getPlayerData();
	var f = document.createElement("form");
	f.method="POST";
	f.action="/projects/driver/index.php";
	f.target="_blank";
	var i = document.createElement("input");
	i.type="hidden";
	i.name="DATA";
	i.value=$.toJSON(data.frames);
	f.appendChild(i);
	document.body.appendChild(f);
	f.submit();
	document.body.removeChild(f);
}

function buildLink() {
	window.location = "#origin="+escape(document.getElementById("origin").value)+"&destination="+escape(document.getElementById("destination").value);
}
