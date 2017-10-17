(function () {

    angular
        .module("app.widgets")
        .directive("sipSelectFile", sipSelectFile);

    function sipSelectFile() {
        return {
            restrict: "A",
            scope: {
                onSelect: "&",
                onTouch: "&",
                customDisabledAction: "&",
                selectDisabled: "="
            },
            transclude: true,
            templateUrl: "/assets/app/widgets/media/select-file.html",
            link: link
        };

        // use this directive with any element except a button (doens't work in Firefox)
        function link(scope, element, attrs) {
            var id                  = _.uniqueId();
            var selectDisabledClass = attrs.selectDisabledClass || "disabled";
            var accept              = attrs.accept || "image/*";
            var listeners           = [];

            scope.inputFileId = "input_file_" + id;
            scope.labelId     = "label_" + id;

            var inputFragment = document.createDocumentFragment();
            var inputFile     = document.createElement("input");
            inputFile.id      = scope.inputFileId;
            inputFile.type    = "file";
            inputFile.accept  = accept;
            inputFile.classList.add("select-input");
            inputFragment.appendChild(inputFile);

            if (_.contains(["", "static"], element.css("position"))) {
                element.css("position", "relative");
            }

            listeners.push(
                scope.$watch("selectDisabled", function (disabled) {
                    if (disabled) {
                        element.addClass(selectDisabledClass);
                    } else {
                        element.removeClass(selectDisabledClass);
                    }
                })
            );

            element.addClass("select-file");

            element.append(inputFragment);

            var onSelect = function () {
                if (typeof scope.onSelect === "function") {
                    scope.onSelect({ file: inputFile.files[0] });
                }
            };

            var onClick = function (e) {
                if (e) {
                    e.preventDefault();
                }
                if (! scope.selectDisabled) {
                    if (typeof scope.onTouch === "function") {
                        scope.onTouch();
                    }
                    inputFile.click();
                } else {
                    if (typeof scope.customDisabledAction === "function") {
                        scope.customDisabledAction();
                    }
                }
            };

            scope.onClick = onClick;

            inputFile.addEventListener("change", onSelect, false);

            scope.$on("$destroy", function () {
                inputFile.removeEventListener("change", onSelect, false);

                _.forEach(listeners, function (listener) {
                    listener();
                });

                inputFile.remove();
                inputFile = null;
            });
        }
    }

})();
