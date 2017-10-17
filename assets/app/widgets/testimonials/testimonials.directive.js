(function () {

    angular
        .module("app.widgets")
        .directive("stelaceTestimonials", stelaceTestimonials);

    function stelaceTestimonials() {
        return {
            restrict: "EA",
            scope: {
                footer: "@"
            },
            templateUrl: "/assets/app/widgets/testimonials/testimonials.html",
            link: link
        };


        function link(scope) {
            var testimonials = [{
                userName: "Coralie",
                userId: 58,
                profileImgSrc: "https://sharinplace.fr/api/media/get/121/0fd34f8c-0762-42f9-ae9b-35b6ea0b730d.jpg?size=128x128",
                review: "Cette transaction s'est super bien passée, le site est ergonomique et les cofondateurs sont humains et très arrangeants. Merci beaucoup.",
                // Not linking or referencing Google Reviews anymore (reduce spam flag probability)
                // review: "Sharinplace, c'est vraiment un super site, c'est une petite révolution dans le monde de la loc\xa0:)",
                // source: "via Google",
                // sourceUrl: "https://www.google.com/maps/contrib/106701345096059266591/reviews/@48.6808102,1.9414132,9z",
                itemName: "Appareil Photo Reflex Canon EOS 700D",
                itemUrl: "https://sharinplace.fr/item/Reflex-Canon-EOS-700D---2-objectifs-et-accessoires----54"
            }, {
                userName: "Cédric",
                userId: 99,
                profileImgSrc: "https://sharinplace.fr/api/media/get/216/bad9a8c9-82f7-4322-b218-2cf4869b9fc5.jpg?size=128x128",
                review: "Super échanges avec Sharinplace qui est très sérieux et qui met à l'aise durant l'échange d'objet. Je suis super content\xa0:)",
                source: null,
                sourceUrl: null,
                itemName: "Vidéoprojecteur Home-cinéma Philips Screeneo",
                itemUrl: "https://sharinplace.fr/item/Videoprojecteur-Home-Cinema-Philips-Screeneo---Son-integre----27"
            }, {
                userName: "Christophe",
                userId: 526,
                profileImgSrc: "https://sharinplace.fr/api/media/get/474/97055aeb-4898-40d9-b1bd-73521a72326f.jpg?size=128x128",
                review: "Ponctuel et efficace\xa0! Vidéoprojecteur très pratique\xa0: petit, léger, et suffisamment lumineux",
                source: null,
                sourceUrl: null,
                itemName: "Mini Vidéoprojecteur Vivitek Qumi Q6",
                itemUrl: "https://sharinplace.fr/item/Mini-Videoprojecteur-Vivitek-Qumi-Q6----Ultra-leger-et-compact----96"
            }, {
                userName: "Barbara",
                userId: 119,
                profileImgSrc: "https://sharinplace.fr/api/media/get/352/0601f05b-c3d2-4960-8e22-e9d72283b596.jpg?size=128x128",
                review: "Je suis séduite par le côté humain de la gestion et par ce concept intelligent de partage. Bravo\xa0!",
                source: null,
                sourceUrl: null,
                itemName: "Epilateur semi-définitif Philips Lumea",
                itemUrl: "https://sharinplace.fr/item/Epilateur-semi-definitif-Philips-Lumea-prestige-SC2006-12-98"
            }, {
                userName: "Damien",
                userId: 101,
                profileImgSrc: "https://sharinplace.fr/api/media/get/217/ae0de6c9-31a2-469a-8b01-e008cb63e6e7.jpg?size=128x128",
                review: "15 jours de plaisir\xa0!",
                source: null,
                sourceUrl: null,
                itemName: "Nintendo Wii U avec jeux et accessoires",
                itemUrl: "https://sharinplace.fr/item/Nintendo-Wii-U-avec-jeux-et-accessoires----97"
            }, {
                userName: "Anas",
                userId: 110,
                profileImgSrc: "https://sharinplace.fr/api/media/get/254/e30844d1-eaaf-43ae-bdcb-bc6e005ecf2c.jpg?size=128x128",
                review: "Un esprit humain dont nous manquons aujourd'hui [...] Big Up Sharinplace",
                source: null,
                sourceUrl: null,
                itemName: "GoPro Hero4 Silver avec accessoires",
                itemUrl: "https://sharinplace.fr/item/GoPro-Hero4-Silver-avec-accessoires----52"
            }, {
                userName: "Nicolas",
                userId: 117,
                profileImgSrc: "https://sharinplace.fr/api/media/get/264/c05e356b-7dc7-4fc0-b4d3-f85c7580e42c.jpg?size=128x128",
                review: "Un prêt qui me permet d'essayer la PS4 pour quelques jours et d'échanger avec de nouvelles personnes, c'est super!",
                source: null,
                sourceUrl: null,
                itemName: "Sony Playstation 4 avec jeux",
                itemUrl: "https://sharinplace.fr/item/Sony-Playstation-4-avec-jeux-et-accessoires----84"
            }, {
                userName: "Azilis",
                userId: 652,
                profileImgSrc: "https://sharinplace.fr/api/media/get/743/55730b77-eb99-4e3d-9dac-1682ec0ff096.jpg?size=128x128",
                review: "Vraiment un super site, les personnes sont très arageantes et répondent très vite\xa0! Une bonne découverte\xa0!",
                source: null,
                sourceUrl: null,
                itemName: "Mini Vidéoprojecteur Vivitek Qumi Q6",
                itemUrl: "https://sharinplace.fr/item/Mini-Videoprojecteur-Vivitek-Qumi-Q6----Ultra-leger-et-compact----96"
            }, {
                userName: "Mathieu",
                userId: 585,
                profileImgSrc: "https://sharinplace.fr/api/media/get/572/ec94fdc8-d6e6-4ebf-8761-2f8ad68cc66e.jpg?size=128x128",
                review: "Un site bien organisé et pratique. Je ne peux que recommander.",
                source: null,
                sourceUrl: null,
                itemName: "Perceuse Sans Fil Metabo - Qualité pro",
                itemUrl: "https://sharinplace.fr/item/Perceuse-Sans-Fil-Metabo---Qualite-professionnelle-29"
            }, {
                userName: "Sabrina",
                userId: 497,
                profileImgSrc: "https://sharinplace.fr/api/media/get/604/45bd134c-9ad5-41f1-aea6-5b201cd08b0b.jpg?size=128x128",
                review: "Echange qui c'est tres bien passé, tres bonne convivialité des proprietaires de l'objet que j'ai loué.",
                source: null,
                sourceUrl: null,
                itemName: "Kärcher K5 Compact",
                itemUrl: "https://sharinplace.fr/item/Karcher-K5-Compact---Nettoyeur-haute-pression-100"
            }, {
                userName: "Axel",
                userId: 1627,
                profileImgSrc: "https://sharinplace.fr/api/media/get/2366/77340fed-15f0-4428-8fae-705492f34651.jpg?size=128x128",
                review: "N'hésitez pas\xa0! Le service est juste parfait\xa0!",
                source: null,
                sourceUrl: null,
                itemName: "Mini enceintes ultraportables UE Boom 2",
                itemUrl: "https://sharinplace.fr/item/Mini-enceintes-ultraportables-UE-Boom-2-189"
            }, {
                userName: "Laura",
                userId: 1319,
                profileImgSrc: "https://sharinplace.fr/api/media/get/1809/8c03503e-d259-45c9-8688-ece89816c28e.jpg?size=128x128",
                review: "Comme toujours, location parfaite, super échanges avec Sharinplace\xa0!",
                source: null,
                sourceUrl: null,
                itemName: "Mini enceintes ultraportables UE Boom 2",
                itemUrl: "https://sharinplace.fr/item/Mini-enceintes-ultraportables-UE-Boom-2-189"
            }, {
                userName: "Jérôme",
                userId: 1490,
                profileImgSrc: "https://sharinplace.fr/api/media/get/2074/84cb41be-0f92-454b-85bd-a123f19e4df4.jpg?size=128x128",
                review: "Plateforme super sympa et très sérieuse. On peut leur faire confiance les yeux fermés.",
                source: null,
                sourceUrl: null,
                itemName: "Vidéoprojecteur Home-Cinéma Philips Screeneo",
                itemUrl: "https://sharinplace.fr/item/Videoprojecteur-Home-Cinema-Philips-Screeneo---Son-integre----27"
            }];

            scope.testimonials = _.sample(testimonials, 3);
        }

    }

})();
