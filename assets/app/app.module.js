(function () {

    angular
        .module("app", [
            "app.core",
            "app.templates",
            "app.widgets",
            "app.layout",
            "app.utility",

            "app.landings",
            "app.authentication",
            "app.inbox",
            "app.items",
            "app.bookings",
            "app.users",
            "app.backoffice"
        ]);

})();
