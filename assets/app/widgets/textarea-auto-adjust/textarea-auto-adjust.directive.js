(function () {

    angular
        .module("app.widgets")
        .directive("sipTextareaAutoAdjust", sipTextareaAutoAdjust);

    function sipTextareaAutoAdjust($compile) {
        return {
            restrict: "EA",
            scope: {},
            link: link
        };

        function link(scope, element, attrs) {
            var dom       = {};
            var destroyed = false;
            var maxRowsPixels;

            dom.frag = document.createDocumentFragment();

            dom.div = document.createElement("div");
            dom.div.classList.add("textarea-auto-adjust");

            dom.pre = document.createElement("pre");
            dom.pre.classList.add("mirror-container");

            dom.span = document.createElement("span");

            if (attrs.rows && ! isNaN(attrs.rows)) {
                setMinRows(attrs.rows);
            }

            if (attrs.maxRows && ! isNaN(attrs.maxRows)) {
                maxRowsPixels = convertRemToPixel(convertRowsToRem(parseInt(attrs.maxRows, 10)));
            }

            if (attrs.ngMaxlength && ! isNaN(attrs.ngMaxlength)) {
                var template = '<div data-sip-maxlength data-content="content" data-maxlength="maxlength"></div>';
                var linkFn = $compile(template);
                dom.sipMaxLength = linkFn(scope);

                scope.maxlength = attrs.ngMaxlength;

                dom.div.classList.add("has-maxlength");
            }

            element.addClass("real-container");
            dom.pre.appendChild(dom.span);
            dom.pre.appendChild(document.createElement("br"));
            dom.frag.appendChild(dom.div);
            element.after(dom.frag);
            dom.div.appendChild(element[0]);
            dom.div.appendChild(dom.pre);

            if (dom.sipMaxLength) {
                angular.element(dom.div).after(dom.sipMaxLength);
            }

            // setTimeout to adjust after the digest loop and wait for content
            setTimeout(updateState, 600);

            element.on("input", updateState);

            scope.$on('$destroy', function () {
                element.off("input", updateState);

                destroyDomElements();
            });



            function updateState() {
                if (destroyed) {
                    return;
                }

                var content = element.val();

                scope.content = content;
                autoAdjust(content);

                // do not use scope.$apply() because only scope watchers need be triggered
                scope.$digest();
            }

            function convertRowsToRem(rows) {
                return rows * 1.5;
            }

            function convertRemToPixel(rem) {
                return rem * 16;
            }

            function autoAdjust(content) {
                dom.span.innerHTML = content;

                setMaxRows();
            }

            function setMinRows(rows) {
                dom.pre.style.minHeight = convertRowsToRem(parseInt(rows, 10)) + "rem";
            }

            function setMaxRows() {
                if (typeof maxRowsPixels !== "undefined") {
                    if (maxRowsPixels <= dom.pre.offsetHeight) {
                        dom.div.classList.add("max-scroll");
                        dom.pre.style.maxHeight = maxRowsPixels + "px";
                        element.css("maxHeight", maxRowsPixels + "px");
                    } else {
                        dom.div.classList.remove("max-scroll");
                        dom.pre.style.maxHeight = null;
                        element.css("maxHeight", null);
                    }
                }
            }

            function destroyDomElements() {
                destroyed = true;

                _.forEach(dom, function (el) {
                    if (el && el.remove) {
                        el.remove();
                    }
                });

                dom = null;
            }
        }
    }

})();
