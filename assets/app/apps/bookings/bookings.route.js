(function () {

    angular
        .module("app.bookings")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "booking";

        $stateProvider
            .state("bookingPayment", {
                url: "/booking-payment/:id",
                templateUrl: appsPath + "/bookings/booking-payment.html",
                controller: "BookingPaymentController",
                controllerAs: "vm",
                appClassName: appClassName
            })
            .state("bookingConfirmation", {
                url: "/booking-confirmation/:id",
                templateUrl: appsPath + "/bookings/booking-confirmation.html",
                controller: "BookingConfirmationController",
                controllerAs: "vm",
                appClassName: appClassName
            });
    }

})();
