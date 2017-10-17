(function () {

    angular
        .module("app.data")
        .factory("FeedbackService", FeedbackService);

    function FeedbackService(Restangular, Feedback) {
        var service = Restangular.all("feedback");

        Restangular.extendModel("feedback", function (obj) {
            return Feedback.mixInto(obj);
        });

        return service;
    }

})();
