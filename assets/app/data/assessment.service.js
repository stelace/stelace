(function () {

    angular
        .module("app.data")
        .factory("AssessmentService", AssessmentService);

    function AssessmentService($q, Restangular, Assessment) {
        var service = Restangular.all("assessment");
        service.getLast                     = getLast;
        service.getAssociatedToConversation = getAssociatedToConversation;
        // service.getRealTakerId              = getRealTakerId;
        service.getRealGiverId              = getRealGiverId;

        Restangular.extendModel("assessment", function (obj) {
            return Assessment.mixInto(obj);
        });

        return service;



        function getLast(listingId) {
            return service.customGET("last", { listingId: listingId })
                .then(function (res) {
                    return res && res.id ? res : null;
                });
        }

        function getAssociatedToConversation(conversationId) {
            return service.customGET(null, { conversationId: conversationId })
                .then(function (res) {
                    if (res.inputAssessment) {
                        res.inputAssessment = Restangular.restangularizeElement(null, res.inputAssessment, "assessment");
                    }
                    if (res.outputAssessment) {
                        res.outputAssessment = Restangular.restangularizeElement(null, res.outputAssessment, "assessment");
                    }

                    return res;
                });
        }

        // function getRealTakerId(assessment) {
        //     if (assessment.startBookingId) {
        //         return assessment.takerId;
        //     } else { // assessment.endBookingId
        //         return assessment.ownerId;
        //     }
        // }

        function getRealGiverId(assessment) {
            if (assessment.startBookingId) {
                return assessment.ownerId;
            } else { // assessment.endBookingId
                return assessment.takerId;
            }
        }
    }

})();
