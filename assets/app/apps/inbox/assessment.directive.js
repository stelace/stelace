(function () {

    angular
        .module("app.inbox")
        .directive("sipAssessment", sipAssessment);

    function sipAssessment() {
        return {
            restrict: "EA",
            scope: {
                heading: "=",
                previousAssessment: "=",
                assessment: "=",
                booking: "=",
                bankAccountMissing: "=", // to show appropriate warnings to owner
                interlocutor: "=",
                item: "=",
                ratings: "=", // only for final assessment
                onSave: "=",
                showForm: "="
            },
            templateUrl: "/assets/app/apps/inbox/assessment.html",
            controller: "AssessmentController",
            controllerAs: "vm",
            bindToController: true
        };
    }

})();
