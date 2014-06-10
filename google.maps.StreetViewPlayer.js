/**
 * Represents a google maps StreetViewPlayer.
 */
google.maps.StreetViewPlayer = function(config) {

	this.config = config;
	this.config.movieCanvas.innerHTML = "";

	var m_sPanoClient = new google.maps.StreetViewService();
	var m_aVertices = [];
	var m_aFrames = [];
	var m_iSensitivity = 15;
	var m_iPlayspeed = 300;
	var m_iCurrentFrame = 0;
	var m_dDirectionsMap = null;
	var m_dDirectionsDisplay = null;
	var m_bDoneLoading = true;
	var m_sCanvasStyle = [];
	for(var i=0;i<3;i++) {
		m_sCanvasStyle.push(this.config.movieCanvas.appendChild(document.createElement("div")).style);
	}
	var m_mMarker = null;
	var m_iTotalFrames = 0;
	var m_bPaused = true;
	var m_iVerticesBack = 0;
	var self = this;

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
		for(var i=0;i<m_sCanvasStyle.length;i++) {
			m_sCanvasStyle[i].backgroundImage = "none";
		}
    if (self.config.onLoading !== null && self.config.onLoading instanceof Function) {
      self.config.onLoading.call(this);
    }
		self.setProgress(0);
	}

	function getPanoramaDataForVertex(vertex) {
		m_sPanoClient.getPanoramaByLocation(vertex, m_iSensitivity, function(panoData, status) {
			m_iVerticesBack++;
			if(status === "OK") {
				vertex.panoData = panoData;
			} else {
				vertex.panoData = null;
			}

			if(allVerticesHaveResponded()) {
        removeEmptyVertices();
				setupFrames();
			}
		})
	}

  function removeEmptyVertices() {
		for(var i=0, length = m_aVertices.length;i<length;i++) {
			if(m_aVertices[i].panoData === null) {
				m_aVertices.splice(i--, 1);
			}
		}
  }

  function allVerticesHaveResponded() {
    return m_iVerticesBack === m_aVertices.length;
  }

	function setupFrames() {
		for(var i=0,length=m_aVertices.length;i<length;i++) {
			m_aFrames.push(new Frame(m_aVertices[i], m_aVertices[Math.min(i+1,m_aVertices.length-1)]))
		}
		m_iTotalFrames = m_aFrames.length;
		m_bDoneLoading = true;
		self.config.onPlay.call(this);
	}

	function getDirections() {
		var self = this;
		m_mMarker = null;
		m_bDoneLoading = false;
		loadingMovie.call(self);

		(new google.maps.DirectionsService()).route({
      origin: this.config.origin,
      destination: this.config.destination,
      travelMode: this.config.travelMode
		}, function(result, status) {
			if(status === google.maps.DirectionsStatus.OK) {
				m_bPaused = true;
				m_aVertices = result.routes[0].overview_path;
				m_aFrames = [];
				m_iTotalFrames = 0;
				m_iCurrentFrame = 0;

				for(var i=0,length=m_aVertices.length;i<length;i++) {
					getPanoramaDataForVertex(m_aVertices[i]);
				}

				if(m_dDirectionsMap===null) {
					m_dDirectionsMap = new google.maps.Map(self.config.mapCanvas,{
						zoom:14,
						center : m_aVertices[0],
						mapTypeId: google.maps.MapTypeId.ROADMAP
					});

					m_mMarker = new google.maps.Marker({
						map: m_dDirectionsMap,
						location:m_aVertices[0],
						visible:true
					})
				}
				
				if(m_dDirectionsDisplay===null) {
					m_dDirectionsDisplay = new google.maps.DirectionsRenderer();
					m_dDirectionsDisplay.setMap(m_dDirectionsMap);
				}
				m_dDirectionsDisplay.setDirections(result);
				self.setPaused(false);
			} else {
				alert("Error pulling directions for movie, please try again.");
			}
		})

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
   * Determines if all of the images required to display the frame have loaded.
   */
  Frame.prototype.isLoaded = function() {
    if(this.m_bLoaded===false) {
      for(var i=0,length=this.m_aImages.length;i<length;i++) {
        if(this.m_aImages[i].width===0) {
          break;
        }
      }
      if(i===length) {
        this.m_bLoaded = true;
      }
    }
    return this.m_bLoaded;
  }

  /**
   * Gets the current latLng which the frame represents.
   */
  Frame.prototype.getPosition = function() {
    return this.m_pPanoData.location.latLng;
  }

  /**
   * Gets the display data for the frame.
   * @return Array of FrameData.
   */
  Frame.prototype.getDisplayData = function() {
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

	function drawFrame(frame) {

		var data = frame.getDisplayData(frame);

		for(var i=0,length=data.length;i<length;i++) {
			var img = data[i];
			m_sCanvasStyle[i].left = img.left;
			m_sCanvasStyle[i].backgroundImage = "url("+img.image+")";
			m_sCanvasStyle[i].width = img.width || "512px"
		}
		
		for(length=m_sCanvasStyle.length;i<length;i++) {
			m_sCanvasStyle[i].width = "0px";
		}

		m_mMarker.setPosition(frame.getPosition());

	}

	function framePlayer() {
		if(m_bPaused===false) {
			if(m_iCurrentFrame >= m_iTotalFrames ) {
				self.setProgress(m_iTotalFrames);
			} else if(m_bPaused===false && m_iTotalFrames > 0 && m_iCurrentFrame<=m_iTotalFrames && m_aFrames[m_iCurrentFrame].isLoaded() ) {
				self.setProgress(m_iCurrentFrame);
				m_iCurrentFrame++;
			}
			setTimeout(framePlayer, m_iPlayspeed);
		}
	};

	this.setSensitivity = function(sensitivity) {
		m_iSensitivity = sensitivity;
	}

	this.getSensitivity = function() {
		return m_iSensitivity;
	}

	this.setPlaySpeed = function(playspeed) {
		m_iPlayspeed = playspeed;
	}
	
	this.getPlaySpeed = function() {
		return m_iPlayspeed;
	}

	this.getPlayerData = function() {
		var aData = [];
		for(var i=0;i<m_aFrames.length;i++) {
			aData.push(m_aFrames[i].getDisplayData());
		}
		return {
			frames : aData
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
