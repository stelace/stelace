(function () {

    angular
        .module("app.data")
        .factory("CardService", CardService);

    function CardService(Restangular, Card, CryptoJS) {
        var service = Restangular.all("card");
        service.createCardRegistration = createCardRegistration;
        service.createCard             = createCard;
        service.getMine                = getMine;

        Restangular.extendModel("card", function (obj) {
            return Card.mixInto(obj);
        });

        return service;



        function createCardRegistration() {
            return service.customPOST(null, "registration");
        }

        function createCard(args) {
            var cardNumber     = args.cardNumber;
            var expirationDate = args.expirationDate;

            // drop the 4th and 12th character
            var str = cardNumber.slice(0, 3)
                    + cardNumber.slice(5, 11)
                    + cardNumber.slice(12)
                    + expirationDate;

            var hash1 = CryptoJS.SHA1(str).toString();
            var hash2 = CryptoJS.SHA256(str).toString();
            var hash3 = CryptoJS.SHA1(hash1 + hash2).toString();

            return service.post({
                cardRegistrationId: args.cardRegistrationId,
                registrationData: args.registrationData,
                forget: args.forget,
                hash1: hash1,
                hash2: hash2,
                hash3: hash3
            });
        }

        function getMine() {
            return service.customGETLIST("my")
                .then(function (cards) {
                    return cards;
                });
        }
    }

})();
