/* global google */

(function () {

    angular
        .module("app.widgets")
        .factory("GoogleMap", GoogleMap);

    function GoogleMap($timeout, tools, map, StelaceConfig) {
        /**
         * @param  {[object]} args
         * - center
         * - zoom
         * - onSelect
         */
        var service = function (args) {
            this.config = {};

            _initialize(this.config, args);
        };

        service.prototype.getConfig       = getConfig;
        service.prototype.setCenter       = setCenter;
        service.prototype.setOffsetCenter = setOffsetCenter;
        service.prototype.setZoom         = setZoom;
        service.prototype.getMarker       = getMarker;
        service.prototype.setMarkers      = setMarkers;
        service.prototype.unsetMarkers    = unsetMarkers;
        service.prototype.addMarker       = addMarker;
        service.prototype.removeMarker    = removeMarker;
        service.prototype.showMarker      = showMarker;
        service.prototype.hideMarker      = hideMarker;
        service.prototype.toggleMarker    = toggleMarker;
        service.prototype.refreshMap      = refreshMap;
        service.prototype.markerHighlight = markerHighlight;
        service.prototype.markerStill     = markerStill;
        service.prototype.fitMap          = fitMap;

        return service;



        function _initialize(config, args) {
            args = args || {};

            var stelaceConfig = StelaceConfig.getConfig();

            config.defaultCenter = {
                latitude: _.isFinite(stelaceConfig.map__default_lat) ? stelaceConfig.map__default_lat :  0,
                longitude: _.isFinite(stelaceConfig.map__default_lng) ? stelaceConfig.map__default_lng : 0
            };
            config.defaultZoom = stelaceConfig.map__default_search_zoom || 11;

            config.map = {
                center: args.center || config.defaultCenter,
                zoom: args.zoom || config.defaultZoom,
                bounds: {}
            };
            config.searchbox = {
                template: "/assets/app/widgets/google-map/searchbox.html",
                events: {
                    places_changed: args.onSelect ? function (searchBox) {
                        var place = searchBox.getPlaces()[0];

                        map.getGooglePlaceData(place)
                            .then(function (p) {
                                args.onSelect(p);
                            });
                    } : null
                },
                options: {
                    // only for maps' self inputs such as in location view
                    // bounds: new google.maps.LatLngBounds(
                    //     // Approximately France bounds
                    //     new google.maps.LatLng(42, -5),
                    //     new google.maps.LatLng(51.2, 9)
                    // )
                }
            };
            config.options = _.defaultsDeep(args.options || {}, {
                minZoom: 2, // world view
                maxZoom: 17, // Central Park NYC entirely covers the map
                mapTypeControl: false,
                streetViewControl: false, // streetView pegman
                zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP } // default changed from TOP_LEFT to RIGHT_BOTTOM with 3.22
            });
            config.events  = args.events || {};
            config.markers = [];
            config.control = {};
        }

        function getConfig() {
            return this.config;
        }

        function setCenter(center) {
            this.config.map.center = {
                latitude: (center && center.latitude) || this.config.defaultCenter.latitude,
                longitude: (center && center.longitude) || this.config.defaultCenter.longitude
            };
        }

        function setOffsetCenter(center, args) {
            var mapDimensions = args.mapDimensions; // required
            var offset        = args.offset || {};
            var zoomBounds    = args.zoomBounds || {};
            var bounds        = this.fitMap(mapDimensions, false, zoomBounds); // all markers determine projection but not center

            var customCenter = new google.maps.LatLng(parseFloat(center.latitude), parseFloat(center.longitude));
            bounds.extend(customCenter);

            var offsetCenter  = _getOffsetCenter(bounds, offset, mapDimensions, customCenter);

            this.config.map.center = {
                latitude: offsetCenter.lat,
                longitude: offsetCenter.lng
            };
        }

        function setZoom(zoom) {
            this.config.map.zoom = zoom;
        }

        function getMarker(id) {
            return _.find(this.config.markers, function (marker) {
                return marker.id === id;
            });
        }

        function setMarkers(markers) {
            _.forEach(markers, addMarker, this);
        }

        function unsetMarkers() {
            this.config.markers.splice(0, this.config.markers.length);
        }

        function addMarker(marker) {
            if (! marker.id) {
                marker.fakeId = true;
                marker.id = _.uniqueId("marker_");
            }
            this.config.markers.push(marker);
        }

        function removeMarker(id) {
            var index = _.findIndex(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (index !== -1) {
                this.config.markers.splice(index, 1);
            }
        }

        function showMarker(id) {
            var index = _.findIndex(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (index !== -1) {
                this.config.markers[index].show = true;
            }
        }

        function hideMarker(id) {
            var index = _.findIndex(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (index !== -1) {
                this.config.markers[index].show = false;
            }
        }

        function toggleMarker(id) {
            var index = _.findIndex(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (index !== -1) {
                this.config.markers[index].show = ! this.config.markers[index].show;
            }
        }

        function refreshMap(center) {
            var useDefaultCenter = ! (center && center.latitude && center.longitude);
            var tmpCenter = (useDefaultCenter ? this.config.defaultCenter : center);

            this.config.control.refresh({
                latitude: tmpCenter.latitude,
                longitude: tmpCenter.longitude
            });
        }

        function markerHighlight(id) {
            var marker = _.find(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (marker) {
                // plain old marker
                // marker.options.zIndex = 100000 + parseInt(_.uniqueId(), 10);
                // marker.options.animation = google.maps.Animation.BOUNCE;
                marker.windowOptions.zIndex   = 100000 + parseInt(_.uniqueId(), 10);
                marker.windowOptions.boxClass += " bounce";
            }
        }

        function markerStill(id) {
            var marker = _.find(this.config.markers, function (marker) {
                return marker.id === id;
            });
            if (marker) {
                // marker.options.animation = null;
                marker.windowOptions.boxClass = marker.windowOptions.boxClass.replace(/ bounce/g, "");
            }
        }

        // Use this function to set zoom BEFORE map is loaded, to avoid loading useless tiles (can divide total tiles files size by 2, saving from 1 to 2MB)
        function fitMap(mapDimensions, center, closestLocations) {
            var closeNeighboorhood   = 2400; // Above 40 minutes, ignore longer journeys for map fitting
            var zoomBounds           = mapDimensions.zoomBounds || [this.config.options.minZoom, this.config.options.maxZoom];
            var closest              = closestLocations || {}; // closestLocations is defined for listing-view (can be {}). owners have no toId
            var service              = this;
            var bounds               = new google.maps.LatLngBounds();
            var mapCenter;

            _.forEach(this.config.markers, function (marker) {
                //Do not extend bounds with hidden markers
                if (marker.show !== true) {
                    return;

                // Skip some markers for fitting
                // If provided, only consider shortestJourneys for fitting map, or not too far listingLocations (in closeNeighboorhood)
                } else if (closest.fromId && marker.type === "myLocation" && closest.fromId !== marker.myLocation.id) {
                    return;
                } else if (closest.toId && marker.type === "listingLocation" && closest.toId !== marker.listingLocation.id
                 && marker.smallestDuration > closeNeighboorhood) {
                    // keep all listingLocations for owners (they have a toId)
                    return;
                }
                // Also skip deactivated myLocations for owner in listing-view
                if (closest.fromId && ! closest.toId && marker.type === "myLocation") {
                    return;
                }
                // console.log("considering ", marker.type, marker);

                var mapCustomMarkerPosition = new google.maps.LatLng(parseFloat(marker.coords.latitude), parseFloat(marker.coords.longitude));
                bounds.extend(mapCustomMarkerPosition);
            }, service);

            // Default map if no active marker
            if (bounds.isEmpty()) {
                var DefaultCenterPosition = new google.maps.LatLng(parseFloat(this.config.defaultCenter.latitude), parseFloat(this.config.defaultCenter.longitude));
                bounds.extend(DefaultCenterPosition);
                service.setZoom(this.config.defaultZoom);
                service.setCenter(); // DefaultCenter
                return bounds;
            }

            if (! _.find(this.config.markers, function (marker) {
                return marker.type && marker.type.indexOf("listing");
            })) {
                // Do not zoom in more than 11 if no listing marker and user has location(s)
                zoomBounds[1] = 11;
            }

            // Do not dezoom more than 10 to display all listingLocations to users without locations in listing-view (can be owner)
            if (closestLocations && (! closest.fromId || ! closest.toId)) {
                zoomBounds[0] = 10;
            }

            var zoomLevel = _getBoundsZoomLevel(bounds, mapDimensions) || this.config.map.zoom;

            if (closestLocations) {
                zoomLevel--; // In listing-view only, ensure that one location marker at least is always visible, since map is centered on listing in listing-view
            }
            if (zoomBounds && zoomBounds.length && zoomBounds.length === 2) {
                zoomLevel = Math.max(zoomLevel, zoomBounds[0]);
                zoomLevel = Math.min(zoomLevel, zoomBounds[1]);
            }

            service.setZoom(parseInt(zoomLevel, 10));

            if (center) {
                // if (offset) {
                //     mapCenter = _getOffsetCenter(bounds, offset, mapDimensions);
                // } else {
                mapCenter = {
                    latitude: parseFloat(bounds.getCenter().lat()),
                    longitude: parseFloat(bounds.getCenter().lng())
                };
                // }
                service.setCenter(mapCenter);
            }

            return bounds;
        }


        // See http://stackoverflow.com/questions/6048975/google-maps-v3-how-to-calculate-the-zoom-level-for-a-given-bounds#answer-13274361
        function _getBoundsZoomLevel(bounds, mapDim) {
            var WORLD_DIM     = { height: 256, width: 256 }; // Google constants
            var ZOOM_MAX      = 21;
            var heightPadding = typeof(mapDim.heightPadding) === "number" ? mapDim.heightPadding : 48; // px
            var widthPadding  = typeof(mapDim.widthPadding) === "number" ? mapDim.widthPadding : 80; // px (5rem)

            function latRad(lat) {
                var sin = Math.sin(lat * Math.PI / 180);
                var radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
                return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
            }

            function zoom(mapPx, worldPx, fraction) {
                return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
            }

            var ne = bounds.getNorthEast();
            var sw = bounds.getSouthWest();

            var latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;

            var lngDiff = ne.lng() - sw.lng();
            var lngFraction = ((lngDiff < 0) ? (lngDiff + 360) : lngDiff) / 360;

            var latZoom = zoom(mapDim.height - heightPadding, WORLD_DIM.height, latFraction);
            var lngZoom = zoom(mapDim.width - widthPadding, WORLD_DIM.width, lngFraction);

            return Math.min(latZoom, lngZoom, ZOOM_MAX);
        }

        // can compute center offset in percentage BEFORE map load (no projection yet, so impossible to use Point methods)
        // but bounds does not correspond to what is really displayed, so that offset can be too high
        // + UX problem of zooming without scrollwheel: empty map after zoom since center has offset...
        function _getOffsetCenter(bounds, pxOffset, mapDimensions, customCenter) {
            var latLngCenter = customCenter || bounds.getCenter();
            var span         = bounds.toSpan(); // a latLng - # of deg map spans
            var pctOffsetY   = (pxOffset.y || 0) / (mapDimensions.height);
            var pctOffsetX   = (pxOffset.x || 0) / (mapDimensions.width);

            var newCenter    = {
                lat: latLngCenter.lat() + span.lat() * pctOffsetY,
                lng: latLngCenter.lng() + span.lng() * pctOffsetX
            };

            return newCenter;
        }

    }

})();
