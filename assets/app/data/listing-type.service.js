(function () {

      angular
          .module("app.data")
          .factory("ListingTypeService", ListingTypeService);

      function ListingTypeService($ngRedux, CleanService, ListingType, Restangular) {
          var service = Restangular.all("listingType");
          service.getBookingTimeUnit = getBookingTimeUnit;

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

          return service;
      }

  })();
