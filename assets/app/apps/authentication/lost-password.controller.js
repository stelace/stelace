(function () {

    angular
        .module("app.authentication")
        .controller("LostPasswordController", LostPasswordController);

    function LostPasswordController(authentication, StelaceEvent, toastr, tools) {
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
                    toastr.success("Un email vient de vous être envoyé");
                });
        }
    }

})();
