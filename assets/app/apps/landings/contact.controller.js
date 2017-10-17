(function () {

    angular
        .module("app.landings")
        .controller("ContactController", ContactController);

    function ContactController(StelaceEvent) {

        var vm = this;

        vm.footerTestimonials = true;

        activate();



        function activate() {
            StelaceEvent.sendEvent("Contact view");
        }

    }

})();
