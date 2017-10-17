(function () {

    angular
        .module("app.landings")
        .controller("TermsController", TermsController);

    function TermsController(StelaceEvent) {

        // var vm = this;

        // vm.footerTestimonials = true;

        activate();



        function activate() {
            StelaceEvent.sendEvent("Terms view");
        }

    }

})();
