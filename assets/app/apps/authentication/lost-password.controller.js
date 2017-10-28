(function () {

    angular
        .module("app.authentication")
        .controller("LostPasswordController", LostPasswordController);

    function LostPasswordController($translate, authentication, StelaceEvent, toastr, tools) {
        var debouncedAction = tools.debounceAction(_send);

        var vm = this;
        vm.send = send;


        activate();


        function activate() {
            StelaceEvent.sendEvent("Lost password view");
        }


        function send(email) {
            return debouncedAction.process(email);
        }

        function _send(email) {
            return authentication
                .lostPassword(email)
                .then(function () {
                    return $translate("authentication.lost_password_email_sent");
                })
                .then(toastr.success);
        }
    }

})();
