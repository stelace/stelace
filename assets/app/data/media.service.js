(function () {

    angular
        .module("app.data")
        .factory("MediaService", MediaService);

    function MediaService($q, $sce, Restangular, apiBaseUrl, Media, authentication, platform, cache) {
        var service = Restangular.all("media");
        service.getMyImage  = getMyImage;
        service.setUrl      = setUrl;
        service.getLocalUrl = getLocalUrl;
        service.uploadFile  = uploadFile;

        Restangular.extendModel("media", function (obj) {
            return Media.mixInto(obj);
        });

        return service;



        function getMyImage(clearCache) {
            var prop = "currentUserImage";

            return $q(function (resolve, reject) {
                if (clearCache) {
                    cache.set(prop, null);
                }

                if (cache.get(prop)) {
                    resolve(cache.get(prop));
                } else {
                    service.customGET("my")
                        .then(function (media) {
                            if (! media) {
                                media = { url: platform.getDefaultProfileImageUrl() };
                            } else {
                                setUrl(media);
                            }

                            cache.set(prop, media);
                            resolve(cache.get(prop));
                        })
                        .catch(function (err) {
                            reject(err);
                        });
                }
            });
        }

        function setUrl(mediaOrMedias) {
            var _setUrl = function (media) {
                if (media.type !== "link") {
                    media.url = apiBaseUrl + "/media/get/" + media.id + "/" + media.uuid;
                    if (media.extension) {
                        media.url += "." + media.extension;
                    }
                }
            };

            if (_.isArray(mediaOrMedias)) {
                _.forEach(mediaOrMedias, function (media) {
                    _setUrl(media);
                });
            } else {
                _setUrl(mediaOrMedias);
            }
        }

        function getLocalUrl(file) {
            var regexImg = /^image\/.+$/gi;

            return $q(function (resolve /*, reject */) {
                if (file && file.type && regexImg.test(file.type)) {
                    if (window.URL) {
                        resolve($sce.trustAsResourceUrl(window.URL.createObjectURL(file)));
                    } else {
                        var reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = function (e) {
                            resolve($sce.trustAsResourceUrl(e.target.result));
                        };
                    }
                } else {
                    resolve();
                }
            });
        }

        function uploadFile(args, onUploadProgress) {
            return $q(function (resolve, reject) {
                onUploadProgress = onUploadProgress || function () {};

                var xhr = new XMLHttpRequest();
                xhr.open("POST", apiBaseUrl + "/media/upload");
                xhr.upload.onprogress = function (e) {
                    if (e.lengthComputable) {
                        onUploadProgress(parseInt(e.loaded / e.total * 100, 10));
                    }
                };
                xhr.onload = function (/* e */) {
                    try {
                        // explicitly parse to JSON because IE doesn't pay attention to the response type
                        var response = (typeof this.response === "string" ? JSON.parse(this.response) : this.response);

                        if (this.status === 200) {
                            resolve(response);
                        } else {
                            reject(response);
                        }
                    } catch (e) {
                        reject(e);
                    }
                };
                xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                xhr.responseType = "json";

                authentication.getToken()
                    .then(function (token) {
                        var formData = new FormData();
                        formData.append("targetId", args.targetId);
                        formData.append("field", args.field);

                        if (args.url) {
                            formData.append("url", args.url);
                        }
                        if (args.name) {
                            formData.append("name", args.name);
                        }

                        // put the field media at the end because the file can be big (other params aren't passed)
                        formData.append("media", args.media);

                        xhr.setRequestHeader("Authorization", "Bearer " + token);
                        xhr.send(formData);
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            });
        }
    }

})();
