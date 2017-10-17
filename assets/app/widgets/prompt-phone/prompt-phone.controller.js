(function () {

    angular
        .module("app.widgets")
        .controller("PromptPhoneController", PromptPhoneController);

    function PromptPhoneController(promptInfoModal,
                                    UserService,
                                    usSpinnerService) {

        var vm = this;
        var currentUser;

        vm.promptCode     = false;
        vm.newValidPhone  = false;
        vm.currentRequest = false;

        vm.sendCode  = sendCode;
        vm.checkCode = checkCode;

        activate();

        function activate() {
            UserService.getCurrentUser().then(function (user) {
                currentUser = user;
                if (currentUser && currentUser.phone) {
                    vm.phone = currentUser.phone;
                }
            });
        }

        function sendCode() {
            var sendingInfo = {
                to: vm.phone
            };

            if (vm.currentRequest) { // debounce
                return;
            }

            usSpinnerService.spin('phone-submit-spinner');
            vm.currentRequest = true;

            promptInfoModal.phoneSendCode(sendingInfo)
                .then(function (step) {
                    if (step > 1) {
                        vm.promptCode = true;
                    } else if (vm.step === true) { // already validated
                        vm.promptCode = false;
                        vm.newValidPhone = true;
                    } else {
                        vm.promptCode = false;
                    }
                })
                .finally(function () {
                    usSpinnerService.stop('phone-submit-spinner');
                    vm.currentRequest = false;
                });
        }

        function checkCode() {
            var verifyInfo = {
                signCode: vm.signCode
            };

            if (vm.currentRequest) { // debounce
                return;
            }

            usSpinnerService.spin('code-submit-spinner');
            vm.currentRequest = true;

            promptInfoModal.phoneCheckCode(verifyInfo)
                .then(function (validCode) {
                    if (validCode) {
                        vm.promptCode          = false;
                        vm.newValidPhone       = true;
                        currentUser.phoneCheck = true;
                        currentUser.phone      = vm.phone;
                    } else if (validCode === null) {
                        vm.promptCode          = false;
                    }
                })
                .finally(function () {
                    usSpinnerService.stop('code-submit-spinner');
                    vm.currentRequest = false;
                });
        }

    }

})();
