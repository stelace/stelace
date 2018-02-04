(function () {

    angular
        .module("app.core")
        .factory("finance", finance);

    function finance($http, apiBaseUrl) {
        var service = {};
        service.createAccount     = createAccount;
        service.createBankAccount = createBankAccount;
        service.getBankAccounts   = getBankAccounts;

        return service;



        function createAccount() {
            return $http.post(apiBaseUrl + "/finance/account")
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
    }

})();
