/* global Stripe */

(function () {

    angular
        .module("app.core")
        .factory("finance", finance);

    function finance($http, $q, apiBaseUrl) {
        var stripe;

        var service = {};
        service.createAccount     = createAccount;
        service.createBankAccount = createBankAccount;
        service.getBankAccounts   = getBankAccounts;

        service.getStripe = getStripe;
        service.createStripeAccountToken = createStripeAccountToken;
        service.createStripeBankAccountToken = createStripeBankAccountToken;

        return service;



        function createAccount(args) {
            return $http.post(apiBaseUrl + "/finance/account", args)
                .then(function (res) {
                    return res.data;
                });
        }

        function createBankAccount(args) {
            return $http.post(apiBaseUrl + "/finance/bankAccount", args)
                .then(function (res) {
                    return res.data;
                });
        }

        function getBankAccounts() {
            return $http.get(apiBaseUrl + '/finance/bankAccount')
                .then(function (res) {
                    return res.data;
                });
        }

        function getStripe() {
            if (stripe) return stripe;

            var publishKey = window.dataFromServer.stripePublishKey;
            stripe = new Stripe(publishKey);
            return stripe;
        }

        function createStripeAccountToken(args) {
            var stripe = getStripe();

            return $q.resolve()
                .then(function () {
                    return stripe.createToken('account', args);
                })
                .then(function (res) {
                    if (res.error) {
                        return $q.reject(res.error);
                    }

                    return res;
                });
        }

        function createStripeBankAccountToken(args) {
            var stripe = getStripe();

            return $q.resolve()
                .then(function () {
                    return stripe.createToken('bank_account', args);
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
