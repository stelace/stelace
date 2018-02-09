(function () {

    angular
        .module("app.widgets")
        .directive("stlSelectCountry", stlSelectCountry);

    function stlSelectCountry($compile, CountryService, diacritics) {
        var PRIORITY = 1;
        var defaultLang = 'en';

        return {
            scope: {},
            restrict: 'A',
            priority: PRIORITY,
            compile: compile
        };

        function compile(tElement, tAttrs) {
            if(!tAttrs.lang || !CountryService.hasLang(tAttrs.lang)) {
                tAttrs.lang = defaultLang;
            }
            var ngOptions = 'country.alpha2 as country.' + tAttrs.lang + ' for country in countries';
            tAttrs.$set('ngOptions', ngOptions);

            return function postLink(scope, iElement) {
                var countries = CountryService.getCountries();
                scope.countries = getSortedCountries(countries, tAttrs.lang);

                $compile(iElement, null, PRIORITY)(scope);
            };
        }

        function getSortedCountries(countries, lang) {
            return _.sortBy(countries, function (country) {
                return diacritics.remove(country[lang]);
            });
        }
    }

})();
