'use strict';

/**
 * A directive for adding google places autocomplete to a text box
 * google places autocomplete info: https://developers.google.com/maps/documentation/javascript/places
 *
 * Credit to @wpalahnuk https://github.com/wpalahnuk/ngAutocomplete
 *
 * Usage:
 *
 * <input type="text"  ng-autocomplete ng-model="autocomplete" options="options" details="details/>
 *
 * + ng-model - autocomplete textbox value
 *
 * + details - more detailed autocomplete result, includes address parts, latlng, etc. (Optional)
 *
 * + options - configuration for the autocomplete (Optional)
 *
 *       + types: type,        String, values can be 'geocode', 'establishment', '(regions)', or '(cities)'
 *       + bounds: bounds,     Google maps LatLngBounds Object, biases results to bounds, but may return results outside these bounds
 *       + country: country    String, ISO 3166-1 Alpha-2 compatible country code. examples; 'ca', 'us', 'gb'
 *       + watchEnter:         Boolean, true(default); on Enter select top autocomplete result. false; enter ends autocomplete
 *
 * example:
 *
 *    options = {
 *        types: '(cities)',
 *        country: 'ca'
 *    }
**/

angular.module('app.widgets')
  .directive('ngAutocomplete', function(StelaceConfig) {
    return {
      require: 'ngModel',
      scope: {
        ngModel: '=',
        options: '=?',
        details: '=?'
      },

      link: function(scope, element, attrs, controller) {
        //options for autocomplete
        var opts;
        var watchEnter = false;
        var config = StelaceConfig.getConfig();

        //watch options provided to directive
        scope.watchOptions = function () {
          return scope.options;
        };
        scope.$watch(scope.watchOptions, function () {
          initOpts();
        }, true);

        // Add some clean up...
        scope.$on('$destroy', function () {
          // unsafe access to google results container (class can change)
          var instance = document.querySelector('.pac-container');

          // https://developers.google.com/maps/documentation/javascript/reference?csw=1#MapsEventListener
          scope.gPlace.unbindAll();
          google.maps.event.clearInstanceListeners(scope.gPlace);

          if(instance){
            instance.parentNode.removeChild(instance);
          }
        });

        // convert options provided to opts
        function initOpts() {

          var country = (config.listings_in_unique_country__active && config.listings_in_unique_country)
            || (scope.options && scope.options.country);
          opts = {};

          if (country && ! (scope.options && scope.options.forceGlobalSearch)) {
            opts.componentRestrictions = {
              country: country
            };
            scope.gPlace.setComponentRestrictions(opts.componentRestrictions)
          } else {
            scope.gPlace.setComponentRestrictions(null)
          }

          if (scope.options) {
            if (scope.options.watchEnter !== false) {
              watchEnter = true
            } else {
              watchEnter = false
            }

            if (scope.options.types) {
              opts.types = []
              opts.types.push(scope.options.types)
              scope.gPlace.setTypes(opts.types)
            } else {
              scope.gPlace.setTypes([])
            }

            if (scope.options.bounds) {
              opts.bounds = scope.options.bounds
              scope.gPlace.setBounds(opts.bounds)
            } else {
              scope.gPlace.setBounds(null)
            }
          }
        }

        if (scope.gPlace == undefined) {
          scope.gPlace = new google.maps.places.Autocomplete(element[0], {});
        }
        google.maps.event.addListener(scope.gPlace, 'place_changed', function() {
          var result = scope.gPlace.getPlace();
          if (result !== undefined) {
            if (result.address_components !== undefined) {

              scope.$apply(function() {

                scope.details = result;

                controller.$setViewValue(element.val());
              });
            }
            else {
              if (watchEnter) {
                getPlace(result)
              }
            }
          }
        })

        //function to get retrieve the autocompletes first result using the AutocompleteService
        function getPlace(result) {
          var autocompleteService = new google.maps.places.AutocompleteService();
          if (result.name.length > 0){
            autocompleteService.getPlacePredictions(
              {
                input: result.name,
                offset: result.name.length
              },
              function listentoresult(list, status) {
                if(list == null || list.length == 0) {

                  scope.$apply(function() {
                    scope.details = null;
                  });

                } else {
                  var placesService = new google.maps.places.PlacesService(element[0]);
                  placesService.getDetails(
                    {'reference': list[0].reference},
                    function detailsresult(detailsResult, placesServiceStatus) {

                      if (placesServiceStatus == google.maps.GeocoderStatus.OK) {
                        scope.$apply(function() {
                          // use name instead of formatted_address to drop country and always show names of stations
                          // e.g. 'Gare de Lyon' instead of 'France' when Enter is pressed after typing 'Gare de'
                          controller.$setViewValue(detailsResult.name);
                          element.val(detailsResult.name);

                          scope.details = detailsResult;

                          //on focusout the value reverts, need to set it again.
                          var watchFocusOut = element.on('focusout', function(event) {
                            element.val(detailsResult.name);
                            element.unbind('focusout')
                          })

                        });
                      }
                    }
                  );
                }
              });
          }
        }

        controller.$render = function () {
          var location = controller.$viewValue;
          element.val(location);
        };

      }
    };
  });
