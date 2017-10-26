(function () {

    angular
        .module("app.core")
        .config(configBlock)
        .run(runBlock);

    function configBlock(RestangularProvider, apiBaseUrl) {
        RestangularProvider
            .setBaseUrl(apiBaseUrl)
            .addRequestInterceptor(function (element, operation, what, url) {
                var reStr = "^" + apiBaseUrl;

                if (operation === "remove") {
                    return null;
                }

                // TODO: expose only useful fields
                if (new RegExp(reStr + "/listing/.*").test(url)) {
                    // return _.pick(element, [
                    //     "name",
                    //     "description"
                    // ]);
                    return element;
                }

                return element;
            });
    }

    function runBlock() {

    }

})();
