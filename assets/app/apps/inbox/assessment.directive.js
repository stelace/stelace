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
                booking: "=", // only for initial assessment. Existence changes assessement behaviour.
                bankAccountMissing: "=", // to show appropriate warnings to owner
                interlocutor: "=",
                item: "=",
                ratings: "=", // only for final assessment. Idem.
                ratingAssessmentId: "=", // if we want to associate ratings with another assessment
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
