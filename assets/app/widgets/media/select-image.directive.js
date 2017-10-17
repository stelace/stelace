(function () {

    angular
        .module("app.widgets")
        .directive("sipSelectImage", sipSelectImage);

    function sipSelectImage() {
        return {
            restrict: "EA",
            scope: {
                media: "=",
                onTouch: "&",
                onSelect: "&",
                selectDisabled: "=",
                onRemove: "&",
                removeDisabled: "=",
                onPrev: "&",
                prevDisabled: "=",
                onNext: "&",
                nextDisabled: "=",
                progress: "@"
            },
            templateUrl: "/assets/app/widgets/media/select-image.html",
            link: link
        };

        function link(scope/*, element, attrs */) {
            scope.touch = function () {
                if (typeof scope.onTouch === "function") {
                    scope.onTouch({ mediaId: scope.media.id });
                }
            };

            scope.select = function (file) {
                if (! scope.selectDisabled) {
                    scope.onSelect({
                        mediaId: scope.media.id,
                        file: file
                    });
                }
            };

            scope.remove = function () {
                if (! scope.removeDisabled) {
                    scope.onRemove({ mediaId: scope.media.id });
                }
            };

            scope.prev = function () {
                if (! scope.prevDisabled) {
                    scope.onPrev({ mediaId: scope.media.id });
                }
            };

            scope.next = function () {
                if (! scope.nextDisabled) {
                    scope.onNext({ mediaId: scope.media.id });
                }
            };
        }
    }

})();
