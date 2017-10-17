/* global moment */

(function () {

    angular
        .module("app.data")
        .factory("Booking", Booking);

    function Booking($q) {
        var contractTokens = {};

        var service = {};
        service.mixInto          = mixInto;
        service.payment          = payment;
        service.confirm          = k_confirm;
        service.cancel           = cancel;
        service.validate         = validate;
        service.getContractToken = getContractToken;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function payment(args) {
            return this.customPOST(args, "payment");
        }

        function k_confirm() {
            return this.customPOST({}, "confirm");
        }

        function cancel(args) {
            return this.customPOST(args, "cancel");
        }

        function validate(args) {
            args = args || {};
            return this.customPOST(args, "validate");
        }

        function getContractToken() {
            var booking = this;

            return $q.when()
                .then(function () {
                    var token = contractTokens[booking.id];
                    var now = moment().toISOString();

                    if (token && now < moment(token.expirationDate).subtract(23, "h").toISOString()) {
                        return token;
                    } else {
                        return booking.customPOST(null, "contract-token")
                            .then(function (res) {
                                contractTokens[booking.id] = res;
                                return res;
                            });
                    }
                });
        }
    }

})();
