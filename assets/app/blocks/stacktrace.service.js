/* global StackTrace */

(function () {

    angular
        .module("blocks.exception")
        .factory("stacktrace", stacktrace);

    function stacktrace($q) {
        var service = {};
        service.print = print;

        return service;

        function print(err) {
            return $q.when(true)
                .then(function () {
                    if (! (err instanceof Error)) {
                        return null;
                    }

                    return StackTrace.fromError(err)
                        .then(function (stackLines) {
                            return _.map(stackLines, function (line) {
                                return getSource(line);
                            });
                        })
                        .catch(function () {
                            return null;
                        });
                });



            function getSource(stackLine) {
                return "at "
                    + stackLine.functionName
                    + " ("
                    + stackLine.fileName
                    + ":"
                    + stackLine.lineNumber
                    + ":"
                    + stackLine.columnNumber
                    + ")";
            }
        }
    }

})();
