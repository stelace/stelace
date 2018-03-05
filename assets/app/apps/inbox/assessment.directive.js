(function () {

    angular
        .module("app.inbox")
        .directive("sipAssessment", sipAssessment);

    function sipAssessment() {
        return {
            restrict: "EA",
            scope: {
                previousAssessment: "=",
                assessment: "=",
                stepType: '=',
                booking: "=",
                bankAccountMissing: "=", // to show appropriate warnings to owner
                interlocutor: "=",
                listing: "=",
                ratings: "=", // only for final assessment
                onSave: "=",
                showForm: "=",
                showRatingsOnly: '='
            },
            templateUrl: "/assets/app/apps/inbox/assessment.html",
            controller: "AssessmentController",
            controllerAs: "vm",
            bindToController: true
        };
    }

})();
