/* global Url */

(function () {

    angular
        .module("app.core")
        .provider("urlService", urlService);

    function urlService() {
        var provider = {};
        provider.setUtmTags = setUtmTags;


        provider.$get = function () {
            var service = {};
            service.setUtmTags = setUtmTags;

            return service;
        };


        return provider;


        /**
         * set utm tags
         * @param {string}  url
         * @param {object}  args
         * @param {string}  [args.utmSource]
         * @param {string}  [args.utmMedium]
         * @param {string}  [args.utmCampaign]
         * @param {string}  [args.utmContent]
         * @param {boolean} [args.override = false]    - Whether existing utm tags should be replaced
         * @return {string} url with utm tags
         */
        function setUtmTags(url, args) {
            if (typeof url !== "string") {
                return url;
            }

            var utmFields = [
                "utmSource",
                "utmMedium",
                "utmCampaign",
                "utmContent"
                // "utmTerm"
            ];
            var utmSources = { // Standardize utmSource
                "facebook": "facebook.com",
                "twitter": "t.co",
                "pinterest": "pinterest.com",
                "linkedin": "linkedin.com"
            };
            var utmTags = _.pick(_.clone(args), utmFields);

            if (_.isEmpty(utmTags)) {
                return url;
            }

            var newUrl = new Url(url); // using domurl library

            _.reduce(utmTags, function (memo, value, field) {
                var snakeField = _.snakeCase(field);

                if (! memo[snakeField]
                 || (memo[snakeField] && args.override)
                ) {
                    memo[snakeField] = value;
                }

                if (memo[snakeField] && field === "utmSource" && utmSources[value]) {
                    memo[snakeField] = utmSources[value];
                }

                return memo;
            }, newUrl.query);


            return newUrl + ""; // stringify
        }
    }

})();
