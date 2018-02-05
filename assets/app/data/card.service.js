(function () {

    angular
        .module("app.data")
        .factory("CardService", CardService);

    function CardService($q, Restangular, Card, CryptoJS, finance) {
        var service = Restangular.all("card");
        service.createCardRegistration = createCardRegistration;
        service.createCard             = createCard;
        service.getMine                = getMine;

        service.getStripeCardElement = getStripeCardElement;
        service.createStripeCardToken = createStripeCardToken;

        Restangular.extendModel("card", function (obj) {
            return Card.mixInto(obj);
        });

        return service;



        function createCardRegistration() {
            return service.customPOST(null, "registration");
        }

        function createCard(args) {
            return service.post({
                cardRegistrationId: args.cardRegistrationId,
                registrationData: args.registrationData,
                cardToken: args.cardToken,
                forget: args.forget,
            });
        }

        function getMine() {
            return service.customGETLIST("my")
                .then(function (cards) {
                    return cards;
                });
        }

        function getStripeCardElement(args) {
            var el = args.el;
            var elArgs = args.elArgs;
            var locale = args.locale;
            var eventCallback = args.eventCallback;

            var style = {
                base: {
                    color: '#555a5f',
                    fontFamily: '"Open Sans", "Helvetica Neue", "Helvetica", Helvetica, Arial, sans-serif',
                    fontSmoothing: 'antialiased',
                    fontSize: '14px',
                    '::placeholder': {
                        color: '#91959a'
                    }
                },
                invalid: {
                    color: '#555a5f',
                    iconColor: '#ff7200',
                }
            };

            var defaultElArgs = {
                style: style
            };

            var stripe = finance.getStripe();

            var elementsAttrs;
            if (locale) {
                elementsAttrs = {
                    locale: locale
                };
            }

            var elements = stripe.elements(elementsAttrs);
            var card = elements.create('card', _.defaults({}, elArgs, defaultElArgs));
            card.mount(el);

            card.addEventListener('change', function (event) {
                eventCallback(event.error);
            });

            return card;
        }

        function createStripeCardToken(card) {
            var stripe = finance.getStripe();

            return $q.resolve()
                .then(function () {
                    return stripe.createToken(card);
                })
                .then(function (res) {
                    if (res.error) {
                        return $q.reject(res.error);
                    }

                    return res;
                });
        }
    }

})();
