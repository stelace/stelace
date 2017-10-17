(function () {

    angular
        .module("app.authentication")
        .controller("RecoveryController", RecoveryController);

    function RecoveryController($stateParams,
                                    authentication,
                                    toastr,
                                    tools,
                                    usSpinnerService) {
        var tokenId         = $stateParams.tokenId;
        var tokenValue      = $stateParams.tokenValue;
        var debouncedAction = tools.debounceAction(_save);

        var vm = this;
        vm.disableSubmitButton = false;
        vm.display             = {};
        vm.errors              = {};

        vm.save    = save;

        activate();




        function activate() {
            authentication
                .recoveryPassword(tokenId, tokenValue)
                .then(function () {
                    vm.display.form = true;
                })
                .catch(function (err) {
                    _displayError(err);
                });
        }

        function save(newPassword) {
            return debouncedAction.process(newPassword);
        }

        function _save(newPassword) {
            if (! newPassword) {
                return;
            }

            usSpinnerService.spin('save-password-spinner');

            return authentication
                .recoveryPassword(tokenId, tokenValue, newPassword)
                .then(function () {
                    vm.newPassword = null;
                    vm.display.form = false;
                    vm.display.success = true;
                    toastr.success("Votre nouveau mot de passe a été enregistré");
                })
                .catch(function (err) {
                    _displayError(err);
                })
                .finally(function () {
                    usSpinnerService.stop('save-password-spinner');
                });
        }

        function _displayError(err) {
            vm.display.error = true;

            if (! err.data) {
                vm.errors.other = true;
                return;
            }

            if (err.data.message === "TokenUsed") {
                vm.errors.tokenUsed = true;
            } else if (err.data.message === "TokenExpired") {
                vm.errors.tokenExpired = true;
            } else {
                vm.errors.other = true;
            }
        }
    }

})();
