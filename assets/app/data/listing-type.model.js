(function () {

      angular
          .module("app.data")
          .factory("ListingType", ListingType);

      function ListingType() {
          var service = {};
          service.mixInto = mixInto;

          return service;



          function mixInto(obj) {
              return angular.extend(obj, this);
          }
      }

  })();
