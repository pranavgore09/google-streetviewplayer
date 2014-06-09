/**
 * Represents a google maps StreetViewPlayer.
 */
google.maps.StreetViewPlayer = function(config) {

	this.config = config;
	var m_sPanoClient = new google.maps.StreetViewService();
	var m_aVertices = [];
	var m_aFrames = [];
	var m_iSensitivity = 15;
	var m_iPlayspeed = 500;
	var m_iCurrentFrame = 0;
	var m_dDirectionsMap = null;
	var m_dDirectionsDisplay = null;
	var m_bDoneLoading = true;
	var m_sCanvasStyle = [];
	var m_mMarker = null;
	var m_iTotalFrames = 0;
	var m_bPaused = true;
	var m_iVerticesBack = 0;
	var self = this;
	
	var m_aCurrentRoutes = [];
	var m_iCurrentRouteIndex = 0;

	function loadingMovie() {
		this.config.movieCanvas.innerHTML = "";
		m_sCanvasStyle = [];
		for(var i=0;i<3;i++) {
			m_sCanvasStyle.push(this.config.movieCanvas.appendChild(document.createElement("div")).style);
		}
		self.config.onLoading.call(this);
		self.setProgress(0);
	}

	function getPanoramaDataForVertex(vertex) {
		m_sPanoClient.getPanoramaByLocation(vertex, m_iSensitivity, function(panoData, status) {
			m_iVerticesBack++;
			if(status==="OK") {
				vertex.panoData = panoData;
			} else {
				vertex.panoData = null;
			}
			if(m_iVerticesBack === m_aVertices.length) {
				for(var i=0, length = m_aVertices.length;i<length;i++) {
					if(m_aVertices[i].panoData===null) {
						m_aVertices.splice(i--, 1);
						length = m_aVertices.length;
					}
				}
				setupFrames();
			}
		})
	}

	function setupFrames() {
		for(var i=0,length=m_aVertices.length;i<length;i++) {
			m_aFrames.push(new google.maps.StreetViewPlayer.Frame(m_aVertices[i], m_aVertices[Math.min(i+1,m_aVertices.length-1)]))
		}
		m_iTotalFrames = m_aFrames.length;
		m_bDoneLoading = true;
		self.config.onPlay.call(this);
	}

	function loadRoute() {
		var self = this;
		m_mMarker = null;
		m_bDoneLoading = false;
		loadingMovie.call(self);

		if(m_dDirectionsDisplay===null) {
			m_dDirectionsDisplay = new google.maps.Polyline({
				clickable: false,
				draggable: false,
				path: this.config.route.overview_path
			})
			m_aCurrentRoutes = [this.config.route];
			m_iCurrentRouteIndex = 0;
			loadCurrentRoute();
			if(m_dDirectionsMap===null) {

				var bounds = new google.maps.LatLngBounds();
				for (var i = 0; i < this.config.route.overview_path.length; i++) {
				    bounds.extend(this.config.route.overview_path[i]);
				}

				m_dDirectionsMap = new google.maps.Map(self.config.mapCanvas,{
					zoom:14,
					center: m_aCurrentRoutes[m_iCurrentRouteIndex].overview_path[0],
					mapTypeId: google.maps.MapTypeId.ROADMAP
				});

				m_dDirectionsMap.fitBounds(bounds)

				m_mMarker = new google.maps.Marker({
					map: m_dDirectionsMap,
					location: m_aCurrentRoutes[m_iCurrentRouteIndex].overview_path[0],
					visible:true
				})
			}
			m_dDirectionsDisplay.setMap(m_dDirectionsMap);
		}
	}

	function getDirections() {
		var self = this;
		m_mMarker = null;
		m_bDoneLoading = false;
		loadingMovie.call(self);

		(new google.maps.DirectionsService()).route({
			 origin:this.config.origin,
			 destination:this.config.destination,
			 travelMode:this.config.travelMode,
			 provideRouteAlternatives: true
			}, function(result, status) {
			if(status == google.maps.DirectionsStatus.OK) {
				if(m_dDirectionsDisplay===null) {
					m_dDirectionsDisplay = new google.maps.DirectionsRenderer({
						draggable: false,
						directions: result,
						panel: document.getElementById("directions")
					});
					m_aCurrentRoutes = result.routes;
					m_iCurrentRouteIndex = 0;
					loadCurrentRoute();
					if(m_dDirectionsMap===null) {
						m_dDirectionsMap = new google.maps.Map(self.config.mapCanvas,{
							zoom:14,
							center: m_aCurrentRoutes[m_iCurrentRouteIndex].overview_path[0],
							mapTypeId: google.maps.MapTypeId.ROADMAP
						});

						m_mMarker = new google.maps.Marker({
							map: m_dDirectionsMap,
							location: m_aCurrentRoutes[m_iCurrentRouteIndex].overview_path[0],
							visible:true
						})
					}
					m_dDirectionsDisplay.setMap(m_dDirectionsMap);
					google.maps.event.addListener(m_dDirectionsDisplay, "routeindex_changed", function() {
						m_bDoneLoading = false;
						self.setPaused(true)
						loadingMovie.call(self);
						m_aCurrentRoutes = m_dDirectionsDisplay.directions.routes;
						m_iCurrentRouteIndex = m_dDirectionsDisplay.routeIndex;
						loadCurrentRoute();
					})
				}
			} else {
				alert("Error pulling directions for movie, please try again.");
			}
		})

	}
	
	function loadCurrentRoute() {

		m_bPaused = true;
		m_aVertices = m_aCurrentRoutes[m_iCurrentRouteIndex].overview_path;
		m_aFrames = [];
		m_iTotalFrames = 0;
		m_iCurrentFrame = 0;
		m_iVerticesBack = 0;
		for(var i=0,length=m_aVertices.length;i<length;i++) {
			getPanoramaDataForVertex(m_aVertices[i]);
		}
		self.setPaused(false);
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

	if (typeof(config.route)==="undefined") {
		getDirections.call(this)
	} else {
		loadRoute.call(this);
	}

}
