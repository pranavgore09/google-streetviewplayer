/**
 * Represents a google maps StreetViewPlayer.
 */
google.maps.StreetViewPlayer = function(config) {

  this.config = config;
  this.config.movieCanvas.innerHTML = "";

  var m_sPanoClient = new google.maps.StreetViewService();
  var m_aFrames = [];
  var m_iSensitivity = 15;
  var m_iFPS = 3;  // Frames per second
  var m_iCurrentFrame = 0;
  var m_dDirectionsMap = null;
  var m_dDirectionsDisplay = null;
  var m_bDoneLoading = true;
  var m_mMarker = null;
  var m_iPlayFrame = 0;
  var m_iTotalFrames = 0;
  var m_bPaused = true;
  var m_elDraw = document.getElementById("movie-canvas");
  var self = this;

  if (typeof this.config.fps !== "undefined" && !isNaN(parseInt(this.config.fps))) {
    m_iFPS = this.config.fps * 1;
  }

  function toRadians(deg) {
    return deg*(Math.PI/180);
  }

  function bearingTo(ls, ll) {
    var lat1 = toRadians(ls.lat()),
        lat2 = toRadians(ll.lat()),
        dLon = toRadians(ll.lng()) - toRadians(ls.lng());

    return (((Math.atan2(Math.sin(dLon)*Math.cos(lat2),Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon)))*180/Math.PI)+360)%360;
  }

  function loadingMovie() {

    m_elDraw.style.background = "none";

    if (self.config.onLoading !== null && self.config.onLoading instanceof Function) {
      self.config.onLoading.call(this);
    }
    self.setProgress(0);
  }

  function removeEmptyVertices(vertices) {
    for(var i=0, length = vertices.length;i<length;i++) {
      if(vertices[i].panoData === null) {
        vertices.splice(i--, 1);
        length--;
      }
    }
  }

  function setupFrames(vertices) {
    for(var i=0,length=vertices.length;i<length;i++) {
      m_aFrames.push(new Frame(vertices[i], vertices[Math.min(i+1, vertices.length-1)]))
    }
    m_iTotalFrames = m_aFrames.length;
    m_bDoneLoading = true;
    if (self.config.onPlay !== null && self.config.onPlay instanceof Function) {
      self.config.onPlay.call(this);
    }
  }

  /**
   * Takes in an array of vertices and pulls the panoramic data
   * for each location. Missing locations are removed from the list.
   * @param Array<LatLng> The Locations to pull pano data for
   */
  function pullPanoDataForVertices(aVertices) {
    var iVerticesResponded = 0;
    for(var i=0,length=aVertices.length;i<length;i++) {
      (function (vertex) {
        m_sPanoClient.getPanoramaByLocation(vertex, m_iSensitivity, function(panoData, status) {
          iVerticesResponded++;
          if(status === "OK") {
            vertex.panoData = panoData;
          } else {
            vertex.panoData = null;
          }
          if(iVerticesResponded===length) {
            removeEmptyVertices(aVertices);
            setupFrames(aVertices);
          }
        })
      })(aVertices[i])
    }
  }

  function getDirections() {
    var self = this;
    m_mMarker = null;
    m_bDoneLoading = false;
    loadingMovie.call(self);

    if (typeof this.config.route === "undefined") {
      (new google.maps.DirectionsService()).route({
        origin: this.config.origin,
        destination: this.config.destination,
        travelMode: this.config.travelMode
      }, function(result, status) {
        if(status === google.maps.DirectionsStatus.OK) {
          loadRoute(result.routes[0])
          if(m_dDirectionsDisplay===null) {
            m_dDirectionsDisplay = new google.maps.DirectionsRenderer();
            m_dDirectionsDisplay.setMap(m_dDirectionsMap);
          }
          m_dDirectionsDisplay.setDirections(result);
        } else if (self.config.onError != null && self.config.onError instanceof Function) {
          self.config.onError.call(this, "Error pulling directions for movie, please try again.")
        }
      })
    } else {
      loadRoute(this.config.route);
      var flightPath = new google.maps.Polyline({
        path: this.config.route.overview_path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 2
      });
      flightPath.setMap(m_dDirectionsMap);
    }

  }

  function loadRoute(route) {
    m_bPaused = true;
    m_aFrames = [];
    m_iTotalFrames = 0;
    m_iCurrentFrame = 0;

    pullPanoDataForVertices(route.overview_path);

    if(m_dDirectionsMap===null) {
      m_dDirectionsMap = new google.maps.Map(self.config.mapCanvas,{
        zoom:14,
        center : route.overview_path[0],
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });

      m_mMarker = new google.maps.Marker({
        map: m_dDirectionsMap,
        location: route.overview_path[0],
        visible:true
      })
    }

    self.setPaused(false);
  }

  /**
   * Represents a google maps StreetViewPlayer Frame
   * @param vertex The vertex which this frame will represent visually.
   * @param nextVertex the next vertex which will be displayed after this vertex in the sequence.
   */
  var Frame = function(vertex, nextVertex) {

    this.m_pPanoData = vertex.panoData;
    this.m_sPanoId = this.m_pPanoData.location.pano;
    this.m_iCameraYaw = this.m_pPanoData.tiles.centerHeading;
    this.m_iNextYaw = bearingTo(vertex, nextVertex.panoData.location.latLng);
    this.m_aImages = [];
    this.m_bLoaded = false;

    // Used to avoid API look-up
    this.m_aCanvasStyles = null;

    var iMoveYaw = this.m_iNextYaw - this.m_iCameraYaw;
    if(iMoveYaw < 0) {
      iMoveYaw += 360;
    } else if(iMoveYaw > 360) {
      iMoveYaw -= 360;
    }

    var iImageCenter = (896+(iMoveYaw*(1664/360)))>>0;
    if(iImageCenter > 1664) {
      iImageCenter -= 1664;
    }

    this.m_iCanvasOffset = iImageCenter;

    if(iImageCenter>>8===0) {
      this.m_aCanvasStyles = [2, 3, 0];
    } else if(iImageCenter===256) {
      this.m_aCanvasStyles = [0];
    } else if((iImageCenter-256)>>9===0) {
      this.m_aCanvasStyles = [0, 1];
    } else if(iImageCenter===768) {
      this.m_aCanvasStyles = [1];
    } else if((iImageCenter-768)>>9===0) {
      this.m_aCanvasStyles = [1, 2];
    } else if(iImageCenter===1280) {
      this.m_aCanvasStyles = [2];
    } else {
      this.m_aCanvasStyles = [2, 3];
    }

    this.loadImages();

  }

  /**
   * Loads all of the images required for the frame.
   */
  Frame.prototype.loadImages = function() {
    var aImages = this.m_aCanvasStyles;
    for(var i=0,lengthI=aImages.length;i<lengthI;i++) {
      this.m_aImages.push(this.getImage(aImages[i], 0));
    }
  }

  /**
   * Constructs a string of a given url from google maps api.
   * @param x X coordinate of the image according to google maps images.
   * @param y Y coordinate of the image according to google maps images.
   */
  Frame.prototype.getImage = function(x, y) {
    var iImage = new Image();
    iImage.src = ["http://cbk0.google.com/cbk?output=tile&panoid=", this.m_sPanoId, "&zoom=2&x=", x, "&y=", y, "&cb_client=api&fover=0&onerr=3"].join("");
    return iImage;
  }

  /**
   * The Url for API usage, downloaded movies
   * will utilize this for time being.
   */
  Frame.prototype.getDisplayData = function() {
    return "http://maps.googleapis.com/maps/api/streetview?size=600x600&location=" + this.m_pPanoData.location.latLng.lat() + "," + this.m_pPanoData.location.latLng.lng() + "&heading=" + this.m_iNextYaw + "&key=AIzaSyCT7wTikxOs9TzFp2C5zDTOlwnNY0oz_h4";
  }

  Frame.prototype.getImageData = function () {
    var iImageCenter = this.m_iCanvasOffset;
    var aImages = this.m_aCanvasStyles;
    if(aImages.length===3) {
      var iDiff = 384 + iImageCenter;
      return [
        {
          left : -iDiff + "px",
          image : this.m_aImages[0].src
        },
        {
          left : -iDiff+512 + "px",
          width : "128px",
          image : this.m_aImages[1].src
        },
        {
          left : -iDiff+640+"px",
          image : this.m_aImages[2].src
        }
      ]
    } else if(aImages.length===1) {
      return [{
        left : "0px",
        image : this.m_aImages[0].src
      }]
    } else {
      var iDiff = (iImageCenter - ((aImages[0]*2+1)*256));
      return [{
        left : -iDiff+"px",
        image : this.m_aImages[0].src
      },
      {
        left : -iDiff+512+"px",
        image : this.m_aImages[1].src
      }]
    }
  }

  /**
   * Gets the current latLng which the frame represents.
   */
  Frame.prototype.getPosition = function() {
    return this.m_pPanoData.location.latLng;
  }

  this.dispose = function() {
    clearTimeout(m_iPlayFrame)
  }

  function drawFrame(frame) {

    var data = frame.getImageData(frame);

    var aBackgroundImages = [];
    var aBackgroundRepeats = [];
    var aBackgroundPositions = [];

    for (var i = 0, length = data.length; i < length; i++) {
      aBackgroundImages.push("url(" + data[i].image + ")");
      aBackgroundRepeats.push("no-repeat");
      aBackgroundPositions.push(data[i].left + " 0px");
    }

    m_elDraw.style.backgroundImage = aBackgroundImages.join(",");
    m_elDraw.style.backgroundRepeat = aBackgroundRepeats.join(",");
    m_elDraw.style.backgroundPosition = aBackgroundPositions.join(",");

    m_mMarker.setPosition(frame.getPosition());

  }

  function framePlayer() {
    if(m_bPaused===false) {
      if(m_iCurrentFrame >= m_iTotalFrames ) {
        self.setProgress(m_iTotalFrames);
      } else if(m_bPaused===false && m_iTotalFrames > 0 && m_iCurrentFrame<=m_iTotalFrames) {
        self.setProgress(m_iCurrentFrame);
        m_iCurrentFrame++;
      }
      m_iPlayFrame = setTimeout(framePlayer, (1000/m_iFPS)>>0);
    }
  };

  this.setSensitivity = function(sensitivity) {
    m_iSensitivity = sensitivity;
  }

  this.getSensitivity = function() {
    return m_iSensitivity;
  }

  this.setFPS = function(fps) {
    m_iFPS = Math.max(1, fps);
  }

  this.getFPS = function() {
    return m_iFPS;
  }

  this.getPlayerData = function() {
    var aData = [];
    for(var i=0;i<m_aFrames.length;i++) {
      aData.push(m_aFrames[i].getDisplayData());
    }
    return {
      frames : aData,
      fps: m_iFPS
    }
  }

  this.setProgress = function(newFrame) {
    m_iCurrentFrame = newFrame;
    if(m_iCurrentFrame >=0 && m_iCurrentFrame < m_aFrames.length) {
      drawFrame(m_aFrames[m_iCurrentFrame])
    }
    self.config.onProgress.call(this, parseInt(100*m_iCurrentFrame/m_iTotalFrames));
  }

  this.setPaused = function(paused) {
    m_bPaused = paused;
    if(paused===false) {
      framePlayer.call(self);
    }
  }

  this.getPaused = function() {
    return m_bPaused;
  }

  this.getTotalFrames = function() {
    return m_iTotalFrames;
  }

  getDirections.call(this)

}
