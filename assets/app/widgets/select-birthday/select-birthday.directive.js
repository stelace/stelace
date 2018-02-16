(function () {

    angular
        .module("app.widgets")
        .directive("stlSelectBirthday", stlSelectBirthday);

        function stlSelectBirthday() {
            return {
            restrict: 'A',
            scope: {
                yearOffset: '@?',
                birthDate: '@?',
                onChange: '&'
            },
            templateUrl: '/assets/app/widgets/select-birthday/select-birthday.html',
            link: link
        };



        function link(scope /*, element, attrs */) {
            scope.day = null;
            scope.month = null;
            scope.year = null;
            scope.maxDay = 31;

            var yearOffset = getYearOffset();
            scope.years = getYearsRange(yearOffset);

            scope.changeDay = changeDay;
            scope.changeMonth = changeMonth;
            scope.changeYear = changeYear;




            scope.$watch('birthDate', function () {
                setBirthDate();
            });



            function getYearOffset() {
                var defaultYearOffset = 18;

                if (scope.yearOffset && !isNaN(scope.yearOffset)) {
                    return parseInt(scope.yearOffset, 10);
                }

                return defaultYearOffset;
            }

            function getYearsRange(yearOffset) {
                var currentYear = new Date().getFullYear();
                var years = _.range(currentYear - yearOffset, 1900, -1);

                return _.map(years, function (year) {
                    return '' + year;
                });
            }

            function setBirthDate() {
                if (scope.birthDate && !isNaN(new Date(scope.birthDate))) {
                    var parts = scope.birthDate.split('-');

                    scope.day = parts[2];
                    scope.month = parts[1];
                    scope.year = parts[0];
                }
            }

            function changeDay() {
                onChange();
            }

            function changeMonth() {
                updateDay();
                onChange();
            }

            function changeYear() {
                updateDay();
                onChange();
            }

            function updateDay() {
                var day = scope.day ? parseInt(scope.day, 10) : null;
                var month = scope.month ? parseInt(scope.month, 10) : null;
                var year = scope.year ? parseInt(scope.year, 10) : null;

                scope.maxDay = getMaxDayOfMonth(month, year);

                if (day && day > scope.maxDay) {
                    scope.day = '' + scope.maxDay;
                }
            }

            function getMaxDayOfMonth(month, year) {
                if (!month) {
                    return 31;
                }

                if (_.includes([1, 3, 5, 7, 8, 10, 12], month)) {
                    return 31;
                }
                if (_.includes([4, 6, 9, 11], month)) {
                    return 30;
                }

                // remaining February
                if (year) {
                    return isLeapYear(year) ? 29 : 28;
                } else {
                    return 29;
                }
            }

            function isLeapYear(year) {
                return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            }

            function onChange() {
                if (typeof scope.onChange === 'function') {
                    var day = parseInt(scope.day, 10);
                    var month = parseInt(scope.month, 10);
                    var year = parseInt(scope.year, 10);

                    // if incorrect date, do not return anything
                    if (!day || !month || !year) {
                        return;
                    }

                    var dateStr = scope.year + '-' + scope.month + '-' + scope.day;

                    scope.onChange({
                        day: day,
                        month: month,
                        year: year,
                        date: dateStr
                    });
                }
            }
        }
    }

})();
