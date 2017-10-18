(function () {

    angular
        .module("app.widgets")
        .directive("stelaceTestimonials", stelaceTestimonials);

    function stelaceTestimonials() {
        return {
            restrict: "EA",
            scope: {
                footer: "@"
            },
            templateUrl: "/assets/app/widgets/testimonials/testimonials.html",
            link: link
        };


        function link(scope) {
            // TODO: load ratings dynamically

            var testimonials = [];

            scope.testimonials = _.sample(testimonials, 3);
        }

    }

})();
