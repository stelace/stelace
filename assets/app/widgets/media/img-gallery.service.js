/* global PhotoSwipe, PhotoSwipeUI_Default */

(function () {

    angular
        .module("app.widgets")
        .factory("imgGallery", imgGallery);

    function imgGallery($http, $templateCache) {
        var service = {};
        service.render = render;

        return service;



        function render(items, index, options) {
            options = _.defaults(options || {}, {
                showHideOpacity: true,
                bgOpacity: 0.9,
                history: false,
                // captionEl: false,
                fullscreenEl: false,
                shareEl: false,
                getThumbBoundsFn: typeof index !== "undefined" ? function (index) {
                    var thumbnail = items[index].el;
                    var pageYScroll = window.pageYOffset || document.documentElement.scrollTop;
                    var rect = thumbnail.getBoundingClientRect();

                    return { x:rect.left, y:rect.top + pageYScroll, w:rect.width };
                } : null
            });
            options.index = index || 0;

            var templateUrl = "/assets/app/widgets/media/img-gallery.html";
            var galleryId = _.uniqueId("gallery_");
            var gallery;
            var galleryPswp;
            var html;

            return $http
                .get(templateUrl, {
                    cache: $templateCache
                })
                .then(function (res) {
                    html = res.data;

                    var frag = document.createDocumentFragment();
                    var galleryElement = document.createElement("div");
                    galleryElement.id = galleryId;
                    galleryElement.innerHTML = html;
                    frag.appendChild(galleryElement);
                    document.body.appendChild(frag);

                    gallery = document.getElementById(galleryId);
                    galleryPswp = gallery.getElementsByClassName("pswp")[0];

                    var useOriginalImages   = false;
                    var firstResize         = true;
                    var mediumSizeThreshold = 1500;
                    var realViewportWidth;
                    var imageSrcWillChange;

                    var pswp = new PhotoSwipe(galleryPswp, PhotoSwipeUI_Default, items, options);

                    pswp.listen("gettingData", function (index, item) {
                        // Set image source & size based on real viewport width
                        if (useOriginalImages) {
                            item.src = item.originalImage.src;
                            item.w   = item.originalImage.w;
                            item.h   = item.originalImage.h;
                        } else {
                            item.src = item.mediumImage.src;
                            item.w   = item.mediumImage.w;
                            item.h   = item.mediumImage.h;
                        }
                    });

                    pswp.listen('beforeResize', function () {
                        // gallery.viewportSize.x - width of PhotoSwipe viewport
                        // gallery.viewportSize.y - height of PhotoSwipe viewport
                        // window.devicePixelRatio - ratio between physical pixels and device independent pixels (Number)
                        //                          1 (regular display), 2 (@2x, retina) ...


                        // calculate real pixels when size changes
                        realViewportWidth = pswp.viewportSize.x * (window.devicePixelRatio || 1);

                        // find out if current images need to be changed
                        if (useOriginalImages && realViewportWidth < mediumSizeThreshold) {
                            useOriginalImages  = false;
                            imageSrcWillChange = true;
                        } else if (! useOriginalImages && realViewportWidth >= mediumSizeThreshold) {
                            useOriginalImages  = true;
                            imageSrcWillChange = true;
                        }

                        // invalidate items only when source is changed and when it's not the first update
                        if (imageSrcWillChange && ! firstResize) {
                            // invalidateCurrItems sets a flag on slides that are in DOM,
                            // which will force update of content (image) on window.resize.
                            pswp.invalidateCurrItems();
                        }

                        if (firstResize) {
                            firstResize = false;
                        }

                        imageSrcWillChange = false;
                    });

                    pswp.listen("destroy", function () {
                        gallery.remove();
                    });

                    pswp.init();

                    return pswp;
                });
        }
    }

})();
