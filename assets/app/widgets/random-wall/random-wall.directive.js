(function () {

    angular
        .module("app.widgets")
        .directive("sipRandomWall", sipRandomWall);

    function sipRandomWall($interval, $timeout/*, $window*/) {
        return {
            restrict: "EA",
            link: link
        };

        function link(scope, element, attrs) {
            var secrets                = element[0].getElementsByClassName("secret");
            var wallAnitmationTimeouts = [];
            var wallRandom             = _wallRandomActivate(secrets, attrs.randomNumber || 1, {
                interval: parseInt(attrs.randomInterval, 10) || 4000,
                delayElements: parseInt(attrs.delayElements, 10) || 600,
                delayDeactivation: parseInt(attrs.delayDeactivation, 10) || 3800,
                putBackLast: attrs.putBackLast,
                notBeforeStart: attrs.notBeforeStart
            });
            var wallRandomInterval;

            element.on("mouseenter", wallRandom.pause);
            element.on("mouseleave", wallRandom.restart);

            wallRandom.start();
            // if ($window.innerWidth > 640) {
            //     wallRandom.start();
            // }

            scope.$on('$destroy', function () {
                element.off(); // just in case but should be done internally by angular
                _.forEach(wallAnitmationTimeouts, function (timeout) {
                    $timeout.cancel(timeout);
                });
                $interval.cancel(wallRandomInterval);
            });

            function _wallRandomActivate(arrayElements, number, options) {
                arrayElements = arrayElements || [];
                number        = number || 1;

                var arrayIndexes          = _.range(0, arrayElements.length);
                var previousArrayIndexes  = [];
                var currentArrayIndexes   = [];
                var isStarted             = false;
                var opts                  = options;
                var pause;

                var _setOptions = function (newOptions) {
                    opts = _.defaults(newOptions, opts);
                };

                var launchSequence = function () {
                    var i = 0;

                    _.forEach(currentArrayIndexes, function (index) {
                        wallAnitmationTimeouts.push($timeout(function () {
                            angular.element(arrayElements[index]).addClass("active");
                        }, i * opts.delayElements));

                        wallAnitmationTimeouts.push($timeout(function () {
                            angular.element(arrayElements[index]).removeClass("active");
                        }, i * opts.delayElements + opts.delayDeactivation));

                        i++;
                    });
                };

                var getRandomArray = function (array, number) {
                    var randomArray = [];
                    // var tmpArray = _.cloneDeep(array); // can't clone an array of DOM nodes. Should use ids.
                    var tmpArray    = array;
                    var arrayLength = tmpArray.length;
                    var randomIndex;

                    if (! opts.putBackLast) {
                        tmpArray = _.difference(tmpArray, previousArrayIndexes);
                        arrayLength = tmpArray.length;
                    }

                    if (number <= arrayLength) {
                        for (var i = 0; i < number; i++) {
                            randomIndex = Math.floor(Math.random() * arrayLength);
                            randomArray.push(tmpArray[randomIndex]);
                            tmpArray.splice(randomIndex, 1);
                            arrayLength--;
                        }
                    }

                    return randomArray;
                };

                var doOneLoop = function () {
                    if (! pause) {
                        currentArrayIndexes = getRandomArray(arrayIndexes, number);
                        launchSequence();
                        previousArrayIndexes = currentArrayIndexes;
                    }
                };

                if (! options.notBeforeStart) {
                    doOneLoop();
                }

                return {
                    setArrayElements: function (newArrayElements) {
                        arrayElements = newArrayElements;
                    },
                    setNumber: function (newNumber) {
                        if (!isNaN(newNumber)) {
                            if (newNumber <= arrayElements.length) {
                                number = newNumber;
                            }
                        } else {
                            throw new Error("This isn't a number.");
                        }
                    },
                    setOptions: function (newOptions) {
                        _setOptions(newOptions);
                    },
                    start: function () {
                        wallRandomInterval = $interval(doOneLoop, opts.interval);
                        isStarted          = true;
                    },
                    restart: function () {
                        pause = false;
                    },
                    pause: function () {
                        pause = true;
                    },
                    stop: function () {
                        $interval.cancel(wallRandomInterval);
                        isStarted = false;
                    },
                    isStarted: function () {
                        return isStarted;
                    }
                };
            }
        }
    }

})();
