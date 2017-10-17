(function () {

    angular
        .module("app.widgets")
        .directive("sipSearchFilters", sipSearchFilters);

    function sipSearchFilters() {
        return {
            restrict: "A",
            scope: {
                params: "=sipSearchFilters",
                config: "=?sipSearchFiltersConfig" // showAdvancedSearch, searchOnChange, lockScrollId
            },
            templateUrl: "/assets/app/widgets/search-filters/search-filters.html",
            controller: "SearchFiltersController",
            controllerAs: "vm",
            bindToController: true
            // link: link
        };

    }

})();
