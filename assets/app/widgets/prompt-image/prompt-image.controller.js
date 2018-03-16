(function () {

    angular
        .module("app.widgets")
        .controller("PromptImageController", PromptImageController);

    function PromptImageController($q,
                                    $rootScope,
                                    $scope,
                                    $translate,
                                    MediaService,
                                    platform,
                                    Restangular,
                                    UserService,
                                    usSpinnerService) {

        var oldMedia;
        var currentUser;
        var currentMedia;
        var vm = this;

        vm.imageToUpload     = true;

        vm.uploadImage       = uploadImage;
        vm.cancelUploadImage = cancelUploadImage;

        activate();

        function activate() {
            $q.all({
                currentUser: UserService.getCurrentUser(),
                myImage: MediaService.getMyImage()
            }).then(function (results) {
                currentUser = results.currentUser;
                vm.imageSrc = results.myImage.url;
                oldMedia    = results.myImage;
                vm.noImage  = (results.myImage.url === platform.getDefaultProfileImageUrl());

                return updateButtonText();
            });
        }

        function uploadImage(file) {
            if (! file) {
                return;
            }

            usSpinnerService.spin('my-img-upload-spinner');
            MediaService
                .uploadFile({
                    targetId: currentUser.id,
                    field: "user",
                    media: file
                }, function (progress) {
                    // display progress until the media is effectively uploaded
                    if (progress >= 100) {
                        progress = 99;
                    }
                    vm.profileMediaProgress = progress;
                    $scope.$digest();
                })
                .then(function (media) {
                    currentMedia = Restangular.restangularizeElement(null, media, "media");

                    return currentUser.updateMedia(media.id);
                })
                .then(function () {
                    delete vm.profileMediaProgress;
                    usSpinnerService.stop('my-img-upload-spinner');

                    MediaService.setUrl(currentMedia);
                    vm.imageSrc = currentMedia.url;
                    vm.imageToUpload = false;

                    $rootScope.$emit("updateProfileImage");
                })
                .finally(function () {
                    updateButtonText();
                    delete vm.profileMediaProgress;
                    usSpinnerService.stop('my-img-upload-spinner');
                });
        }

        function cancelUploadImage() {
            usSpinnerService.stop('payment-spinner');
            if (! currentMedia) {
                return;
            }

            currentUser
                .updateMedia(oldMedia.id)
                .then(function () {
                    currentMedia = null;
                    vm.imageSrc = oldMedia.url;
                    vm.imageToUpload = true;

                    $rootScope.$emit("updateProfileImage");
                })
                .finally(updateButtonText);
        }

        function updateButtonText() {
            return $translate('user.prompt.change_profile_image_button', {
                existing_image: vm.imageToUpload ? (vm.noImage ? 'no_image' : 'has_image') : 'upcoming_upload'
            }).then(function (text) {
                vm.buttonText = text;
            });
        }

    }

})();
