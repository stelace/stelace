(function () {

    angular
        .module("app.core")
        .factory("finance", finance);

    function finance($http, apiBaseUrl, UserService) {
        var service = {};
        service.createAccount     = createAccount;
        service.createBankAccount = createBankAccount;

        return service;



        function createAccount(args) {
            var create = function (currentUser) {
                return $http.post(apiBaseUrl + "/finance/account", args)
                    .then(function (user) {
                        currentUser.birthday           = user.birthday;
                        currentUser.nationality        = user.nationality;
                        currentUser.countryOfResidence = user.countryOfResidence;
                        currentUser.mangopayAccount    = true;
                        currentUser.wallet             = true;
                    });
            };

            return UserService.getCurrentUser()
                .then(function (user) {
                    if (! user.mangopayAccount || ! user.wallet) {
                        return create(user);
                    }
                });
        }

        function createBankAccount() {
            var create = function (currentUser) {
                return $http.post(apiBaseUrl + "/finance/bankAccount")
                    .then(function () {
                        currentUser.bankAccount = true;
                    });
            };

            return UserService.getCurrentUser()
                .then(function (user) {
                    if (! user.bankAccount) {
                        return create(user);
                    }
                });
        }
    }

})();
