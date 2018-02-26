(function () {

      angular
          .module("app.data")
          .factory("ListingTypeService", ListingTypeService);

      function ListingTypeService($ngRedux, CleanService, ListingType, Restangular) {
          var service = Restangular.all("listingType");
          service.getBookingTimeUnit = getBookingTimeUnit;
          service.getProperties = getProperties;

          CleanService.clean(service);

          Restangular.extendModel("listingType", function (obj) {
              return ListingType.mixInto(obj);
          });



          function getBookingTimeUnit(listingType) {
              var config = listingType.config.bookingTime;
              if (!config || !config.timeUnit) {
                  return;
              }

              return config.timeUnit;
          }

          function getProperties(listingType) {
            var properties = listingType.properties;

            return {
                isTimeNone: properties.TIME === 'NONE',
                isTimePredefined: properties.TIME === 'TIME_PREDEFINED',
                isTimeFlexible: properties.TIME === 'TIME_FLEXIBLE',
                isAvailabilityNone: properties.AVAILABILITY === 'NONE',
                isAvailabilityUnique: properties.AVAILABILITY === 'UNIQUE',
                isAvailabilityStock: properties.AVAILABILITY === 'STOCK'
            };
          }

          return service;
      }

  })();
