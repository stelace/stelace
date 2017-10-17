(function () {

    angular
        .module("app.widgets")
        .directive("sipProfileAction", sipProfileAction);

    function sipProfileAction() {
        return {
            restrict: "EA",
            templateUrl: "/assets/app/widgets/profile-action/profile-action.html",
            link: link
        };

        function link(scope, elem, attrs) {
            var rewards = [];

            if (! scope.action) {
                return;
            }

            if (scope.action.points) {
                rewards.push("+" + scope.action.points);
            }
            if (scope.vm.gameStats.actions[scope.action.id] > 1) {
                rewards.push("accompli " + scope.vm.gameStats.actions[scope.action.id] + " fois");
            }

            scope.rewardLabel  = ! attrs.hideActionRewardDetail && rewards.join(", ");
            scope.rewardedOnce = scope.vm.gameStats.actions[scope.action.id] && scope.action.once;
        }

    }

})();
