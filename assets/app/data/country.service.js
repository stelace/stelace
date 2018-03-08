(function () {

    angular
        .module("app.data")
        .factory("CountryService", CountryService);

    function CountryService() {
        var indexedAlpha2Countries;

        var service = {};

        service.hasLang = hasLang;
        service.getCountry = getCountry;
        service.getCountries = getCountries;
        service.isIBANCountry = isIBANCountry;

        return service;



        function _getIndexedAlpha2Countries() {
            if (indexedAlpha2Countries) {
                return indexedAlpha2Countries;
            }

            var countries = getCountries();
            indexedAlpha2Countries = _.indexBy(countries, 'alpha2');
            return indexedAlpha2Countries;
        }

        function hasLang(lang) {
            return _.includes(['en', 'fr'], lang);
        }

        function getCountry(code, lang) {
            var indexedAlpha2Countries = _getIndexedAlpha2Countries();
            var c = (code || '').toUpperCase();

            if (lang) {
                var lg = (lang || '').toLowerCase();
                return indexedAlpha2Countries[c][lg];
            } else {
                return indexedAlpha2Countries[c];
            }
        }

        function isIBANCountry(country) {
            var ibanCountries = ['AT', 'BE', 'DK', 'FI', 'FR', 'DE', 'GI', 'IE', 'IT', 'LU', 'NL', 'NO', 'PT', 'ES', 'SE', 'CH'];
            return _.includes(ibanCountries, country);
        }

        function getCountries() {
            var countries = [
                {
                    alpha2: "AD",
                    en: "Andorra",
                    fr: "Andorre"
                },
                {
                    alpha2: "AE",
                    en: "United Arab Emirates",
                    fr: "Émirats arabes unis"
                },
                {
                    alpha2: "AF",
                    en: "Afghanistan",
                    fr: "Afghanistan"
                },
                {
                    alpha2: "AG",
                    en: "Antigua and Barbuda",
                    fr: "Antigua-et-Barbuda"
                },
                {
                    alpha2: "AI",
                    en: "Anguilla",
                    fr: "Anguilla"
                },
                {
                    alpha2: "AL",
                    en: "Albania",
                    fr: "Albanie"
                },
                {
                    alpha2: "AM",
                    en: "Armenia",
                    fr: "Arménie"
                },
                {
                    alpha2: "AO",
                    en: "Angola",
                    fr: "Angola"
                },
                {
                    alpha2: "AQ",
                    en: "Antarctica",
                    fr: "Antarctique"
                },
                {
                    alpha2: "AR",
                    en: "Argentina",
                    fr: "Argentine"
                },
                {
                    alpha2: "AS",
                    en: "American Samoa",
                    fr: "Samoa américaines"
                },
                {
                    alpha2: "AT",
                    en: "Austria",
                    fr: "Autriche"
                },
                {
                    alpha2: "AU",
                    en: "Australia",
                    fr: "Australie"
                },
                {
                    alpha2: "AW",
                    en: "Aruba",
                    fr: "Aruba"
                },
                {
                    alpha2: "AX",
                    en: "Aland Islands",
                    fr: "Îles Åland"
                },
                {
                    alpha2: "AZ",
                    en: "Azerbaijan",
                    fr: "Azerbaïdjan"
                },
                {
                    alpha2: "BA",
                    en: "Bosnia and Herzegovina",
                    fr: "Bosnie-Herzégovine"
                },
                {
                    alpha2: "BB",
                    en: "Barbados",
                    fr: "Barbade"
                },
                {
                    alpha2: "BD",
                    en: "Bangladesh",
                    fr: "Bangladesh"
                },
                {
                    alpha2: "BE",
                    en: "Belgium",
                    fr: "Belgique"
                },
                {
                    alpha2: "BF",
                    en: "Burkina Faso",
                    fr: "Burkina Faso"
                },
                {
                    alpha2: "BG",
                    en: "Bulgaria",
                    fr: "Bulgarie"
                },
                {
                    alpha2: "BH",
                    en: "Bahrain",
                    fr: "Bahreïn"
                },
                {
                    alpha2: "BI",
                    en: "Burundi",
                    fr: "Burundi"
                },
                {
                    alpha2: "BJ",
                    en: "Benin",
                    fr: "Bénin"
                },
                {
                    alpha2: "BL",
                    en: "Saint Barthélemy",
                    fr: "Saint-Barthélémy"
                },
                {
                    alpha2: "BM",
                    en: "Bermuda",
                    fr: "Bermudes"
                },
                {
                    alpha2: "BN",
                    en: "Brunei Darussalam",
                    fr: "Brunéi Darussalam"
                },
                {
                    alpha2: "BO",
                    en: "Bolivia",
                    fr: "Bolivie"
                },
                {
                    alpha2: "BQ",
                    en: "Caribbean Netherlands",
                    fr: "Pays-Bas caribéens"
                },
                {
                    alpha2: "BR",
                    en: "Brazil",
                    fr: "Brésil"
                },
                {
                    alpha2: "BS",
                    en: "Bahamas",
                    fr: "Bahamas"
                },
                {
                    alpha2: "BT",
                    en: "Bhutan",
                    fr: "Bhoutan"
                },
                {
                    alpha2: "BV",
                    en: "Bouvet Island",
                    fr: "Île Bouvet"
                },
                {
                    alpha2: "BW",
                    en: "Botswana",
                    fr: "Botswana"
                },
                {
                    alpha2: "BY",
                    en: "Belarus",
                    fr: "Bélarus"
                },
                {
                    alpha2: "BZ",
                    en: "Belize",
                    fr: "Belize"
                },
                {
                    alpha2: "CA",
                    en: "Canada",
                    fr: "Canada"
                },
                {
                    alpha2: "CC",
                    en: "Cocos (Keeling) Islands",
                    fr: "Îles Cocos (Keeling)"
                },
                {
                    alpha2: "CD",
                    en: "Democratic Republic of Congo",
                    fr: "République Démocratique du Congo"
                },
                {
                    alpha2: "CF",
                    en: "Central African Republic",
                    fr: "République centrafricaine"
                },
                {
                    alpha2: "CG",
                    en: "Congo",
                    fr: "Congo"
                },
                {
                    alpha2: "CH",
                    en: "Switzerland",
                    fr: "Suisse"
                },
                {
                    alpha2: "CI",
                    en: "Cote d'Ivoire",
                    fr: "Côte d’Ivoire"
                },
                {
                    alpha2: "CK",
                    en: "Cook Islands",
                    fr: "Îles Cook"
                },
                {
                    alpha2: "CL",
                    en: "Chile",
                    fr: "Chili"
                },
                {
                    alpha2: "CM",
                    en: "Cameroon",
                    fr: "Cameroun"
                },
                {
                    alpha2: "CN",
                    en: "China",
                    fr: "Chine"
                },
                {
                    alpha2: "CO",
                    en: "Colombia",
                    fr: "Colombie"
                },
                {
                    alpha2: "CR",
                    en: "Costa Rica",
                    fr: "Costa Rica"
                },
                {
                    alpha2: "CU",
                    en: "Cuba",
                    fr: "Cuba"
                },
                {
                    alpha2: "CV",
                    en: "Cabo Verde",
                    fr: "Cap-Vert"
                },
                {
                    alpha2: "CW",
                    en: "Curaçao",
                    fr: "Curaçao"
                },
                {
                    alpha2: "CX",
                    en: "Christmas Island",
                    fr: "Île Christmas"
                },
                {
                    alpha2: "CY",
                    en: "Cyprus",
                    fr: "Chypre"
                },
                {
                    alpha2: "CZ",
                    en: "Czechia",
                    fr: "République tchèque"
                },
                {
                    alpha2: "DE",
                    en: "Germany",
                    fr: "Allemagne"
                },
                {
                    alpha2: "DJ",
                    en: "Djibouti",
                    fr: "Djibouti"
                },
                {
                    alpha2: "DK",
                    en: "Denmark",
                    fr: "Danemark"
                },
                {
                    alpha2: "DM",
                    en: "Dominica",
                    fr: "Dominique"
                },
                {
                    alpha2: "DO",
                    en: "Dominican Republic",
                    fr: "République dominicaine"
                },
                {
                    alpha2: "DZ",
                    en: "Algeria",
                    fr: "Algérie"
                },
                {
                    alpha2: "EC",
                    en: "Ecuador",
                    fr: "Équateur"
                },
                {
                    alpha2: "EE",
                    en: "Estonia",
                    fr: "Estonie"
                },
                {
                    alpha2: "EG",
                    en: "Egypt",
                    fr: "Égypte"
                },
                {
                    alpha2: "EH",
                    en: "Western Sahara",
                    fr: "Sahara occidental"
                },
                {
                    alpha2: "ER",
                    en: "Eritrea",
                    fr: "Érythrée"
                },
                {
                    alpha2: "ES",
                    en: "Spain",
                    fr: "Espagne"
                },
                {
                    alpha2: "ET",
                    en: "Ethiopia",
                    fr: "Éthiopie"
                },
                {
                    alpha2: "FI",
                    en: "Finland",
                    fr: "Finlande"
                },
                {
                    alpha2: "FJ",
                    en: "Fiji",
                    fr: "Fidji"
                },
                {
                    alpha2: "FK",
                    en: "Falkland Islands (Malvinas)",
                    fr: "Îles Malouines"
                },
                {
                    alpha2: "FM",
                    en: "Federated States of Micronesia",
                    fr: "États fédérés de Micronésie"
                },
                {
                    alpha2: "FO",
                    en: "Faroe Islands",
                    fr: "Îles Féroé"
                },
                {
                    alpha2: "FR",
                    en: "France",
                    fr: "France"
                },
                {
                    alpha2: "GA",
                    en: "Gabon",
                    fr: "Gabon"
                },
                {
                    alpha2: "GB",
                    en: "United Kingdom",
                    fr: "Royaume-Uni"
                },
                {
                    alpha2: "GD",
                    en: "Grenada",
                    fr: "Grenade"
                },
                {
                    alpha2: "GE",
                    en: "Georgia",
                    fr: "Géorgie"
                },
                {
                    alpha2: "GF",
                    en: "French Guiana",
                    fr: "Guyane française"
                },
                {
                    alpha2: "GG",
                    en: "Guernsey",
                    fr: "Guernesey"
                },
                {
                    alpha2: "GH",
                    en: "Ghana",
                    fr: "Ghana"
                },
                {
                    alpha2: "GI",
                    en: "Gibraltar",
                    fr: "Gibraltar"
                },
                {
                    alpha2: "GL",
                    en: "Greenland",
                    fr: "Groenland"
                },
                {
                    alpha2: "GM",
                    en: "Gambia",
                    fr: "Gambie"
                },
                {
                    alpha2: "GN",
                    en: "Guinea",
                    fr: "Guinée"
                },
                {
                    alpha2: "GP",
                    en: "Guadeloupe",
                    fr: "Guadeloupe"
                },
                {
                    alpha2: "GQ",
                    en: "Equatorial Guinea",
                    fr: "Guinée équatoriale"
                },
                {
                    alpha2: "GR",
                    en: "Greece",
                    fr: "Grèce"
                },
                {
                    alpha2: "GS",
                    en: "South Georgia and the South Sandwich Islands",
                    fr: "Géorgie du Sud et les Îles Sandwich du Sud"
                },
                {
                    alpha2: "GT",
                    en: "Guatemala",
                    fr: "Guatemala"
                },
                {
                    alpha2: "GU",
                    en: "Guam",
                    fr: "Guam"
                },
                {
                    alpha2: "GW",
                    en: "Guinea-Bissau",
                    fr: "Guinée-Bissau"
                },
                {
                    alpha2: "GY",
                    en: "Guyana",
                    fr: "Guyana"
                },
                {
                    alpha2: "HK",
                    en: "Hong Kong",
                    fr: "Hong Kong"
                },
                {
                    alpha2: "HM",
                    en: "Heard Island and McDonald Islands",
                    fr: "Îles Heard et MacDonald"
                },
                {
                    alpha2: "HN",
                    en: "Honduras",
                    fr: "Honduras"
                },
                {
                    alpha2: "HR",
                    en: "Croatia",
                    fr: "Croatie"
                },
                {
                    alpha2: "HT",
                    en: "Haiti",
                    fr: "Haïti"
                },
                {
                    alpha2: "HU",
                    en: "Hungary",
                    fr: "Hongrie"
                },
                {
                    alpha2: "ID",
                    en: "Indonesia",
                    fr: "Indonésie"
                },
                {
                    alpha2: "IE",
                    en: "Ireland",
                    fr: "Irlande"
                },
                {
                    alpha2: "IL",
                    en: "Israel",
                    fr: "Israël"
                },
                {
                    alpha2: "IM",
                    en: "Isle of Man",
                    fr: "Île de Man"
                },
                {
                    alpha2: "IN",
                    en: "India",
                    fr: "Inde"
                },
                {
                    alpha2: "IO",
                    en: "British Indian Ocean Territory",
                    fr: "Territoire britannique de l'océan Indien"
                },
                {
                    alpha2: "IQ",
                    en: "Iraq",
                    fr: "Irak"
                },
                {
                    alpha2: "IR",
                    en: "Iran",
                    fr: "Iran"
                },
                {
                    alpha2: "IS",
                    en: "Iceland",
                    fr: "Islande"
                },
                {
                    alpha2: "IT",
                    en: "Italy",
                    fr: "Italie"
                },
                {
                    alpha2: "JE",
                    en: "Jersey",
                    fr: "Jersey"
                },
                {
                    alpha2: "JM",
                    en: "Jamaica",
                    fr: "Jamaïque"
                },
                {
                    alpha2: "JO",
                    en: "Jordan",
                    fr: "Jordanie"
                },
                {
                    alpha2: "JP",
                    en: "Japan",
                    fr: "Japon"
                },
                {
                    alpha2: "KE",
                    en: "Kenya",
                    fr: "Kenya"
                },
                {
                    alpha2: "KG",
                    en: "Kyrgyzstan",
                    fr: "Kirghizistan"
                },
                {
                    alpha2: "KH",
                    en: "Cambodia",
                    fr: "Cambodge"
                },
                {
                    alpha2: "KI",
                    en: "Kiribati",
                    fr: "Kiribati"
                },
                {
                    alpha2: "KM",
                    en: "Comoros",
                    fr: "Comores"
                },
                {
                    alpha2: "KN",
                    en: "Saint Kitts and Nevis",
                    fr: "Saint-Kitts-et-Nevis"
                },
                {
                    alpha2: "KP",
                    en: "North Korea",
                    fr: "Corée du Nord"
                },
                {
                    alpha2: "KR",
                    en: "South Korea",
                    fr: "Corée du Sud"
                },
                {
                    alpha2: "KW",
                    en: "Kuwait",
                    fr: "Koweït"
                },
                {
                    alpha2: "KY",
                    en: "Cayman Islands",
                    fr: "Îles Caïmans"
                },
                {
                    alpha2: "KZ",
                    en: "Kazakhstan",
                    fr: "Kazakhstan"
                },
                {
                    alpha2: "LA",
                    en: "Laos",
                    fr: "Laos"
                },
                {
                    alpha2: "LB",
                    en: "Lebanon",
                    fr: "Liban"
                },
                {
                    alpha2: "LC",
                    en: "Saint Lucia",
                    fr: "Sainte-Lucie"
                },
                {
                    alpha2: "LI",
                    en: "Liechtenstein",
                    fr: "Liechtenstein"
                },
                {
                    alpha2: "LK",
                    en: "Sri Lanka",
                    fr: "Sri Lanka"
                },
                {
                    alpha2: "LR",
                    en: "Liberia",
                    fr: "Libéria"
                },
                {
                    alpha2: "LS",
                    en: "Lesotho",
                    fr: "Lesotho"
                },
                {
                    alpha2: "LT",
                    en: "Lithuania",
                    fr: "Lituanie"
                },
                {
                    alpha2: "LU",
                    en: "Luxembourg",
                    fr: "Luxembourg"
                },
                {
                    alpha2: "LV",
                    en: "Latvia",
                    fr: "Lettonie"
                },
                {
                    alpha2: "LY",
                    en: "Libya",
                    fr: "Libye"
                },
                {
                    alpha2: "MA",
                    en: "Morocco",
                    fr: "Maroc"
                },
                {
                    alpha2: "MC",
                    en: "Monaco",
                    fr: "Monaco"
                },
                {
                    alpha2: "MD",
                    en: "Moldova",
                    fr: "Moldavie"
                },
                {
                    alpha2: "ME",
                    en: "Montenegro",
                    fr: "Monténégro"
                },
                {
                    alpha2: "MF",
                    en: "Saint Martin (French part)",
                    fr: "Saint-Martin (partie française)"
                },
                {
                    alpha2: "MG",
                    en: "Madagascar",
                    fr: "Madagascar"
                },
                {
                    alpha2: "MH",
                    en: "Marshall Islands",
                    fr: "Îles Marshall"
                },
                {
                    alpha2: "MK",
                    en: "Macedonia",
                    fr: "Macédoine"
                },
                {
                    alpha2: "ML",
                    en: "Mali",
                    fr: "Mali"
                },
                {
                    alpha2: "MM",
                    en: "Myanmar",
                    fr: "Myanmar"
                },
                {
                    alpha2: "MN",
                    en: "Mongolia",
                    fr: "Mongolie"
                },
                {
                    alpha2: "MO",
                    en: "Macao",
                    fr: "Macao"
                },
                {
                    alpha2: "MP",
                    en: "Northern Mariana Islands",
                    fr: "Îles Mariannes du Nord"
                },
                {
                    alpha2: "MQ",
                    en: "Martinique",
                    fr: "Martinique"
                },
                {
                    alpha2: "MR",
                    en: "Mauritania",
                    fr: "Mauritanie"
                },
                {
                    alpha2: "MS",
                    en: "Montserrat",
                    fr: "Montserrat"
                },
                {
                    alpha2: "MT",
                    en: "Malta",
                    fr: "Malte"
                },
                {
                    alpha2: "MU",
                    en: "Mauritius",
                    fr: "Maurice"
                },
                {
                    alpha2: "MV",
                    en: "Maldives",
                    fr: "Maldives"
                },
                {
                    alpha2: "MW",
                    en: "Malawi",
                    fr: "Malawi"
                },
                {
                    alpha2: "MX",
                    en: "Mexico",
                    fr: "Mexique"
                },
                {
                    alpha2: "MY",
                    en: "Malaysia",
                    fr: "Malaisie"
                },
                {
                    alpha2: "MZ",
                    en: "Mozambique",
                    fr: "Mozambique"
                },
                {
                    alpha2: "NA",
                    en: "Namibia",
                    fr: "Namibie"
                },
                {
                    alpha2: "NC",
                    en: "New Caledonia",
                    fr: "Nouvelle-Calédonie"
                },
                {
                    alpha2: "NE",
                    en: "Niger",
                    fr: "Niger"
                },
                {
                    alpha2: "NF",
                    en: "Norfolk Island",
                    fr: "Île Norfolk"
                },
                {
                    alpha2: "NG",
                    en: "Nigeria",
                    fr: "Nigéria"
                },
                {
                    alpha2: "NI",
                    en: "Nicaragua",
                    fr: "Nicaragua"
                },
                {
                    alpha2: "NL",
                    en: "Netherlands",
                    fr: "Pays-Bas"
                },
                {
                    alpha2: "NO",
                    en: "Norway",
                    fr: "Norvège"
                },
                {
                    alpha2: "NP",
                    en: "Nepal",
                    fr: "Népal"
                },
                {
                    alpha2: "NR",
                    en: "Nauru",
                    fr: "Nauru"
                },
                {
                    alpha2: "NU",
                    en: "Niue",
                    fr: "Niue"
                },
                {
                    alpha2: "NZ",
                    en: "New Zealand",
                    fr: "Nouvelle-Zélande"
                },
                {
                    alpha2: "OM",
                    en: "Oman",
                    fr: "Oman"
                },
                {
                    alpha2: "PA",
                    en: "Panama",
                    fr: "Panama"
                },
                {
                    alpha2: "PE",
                    en: "Peru",
                    fr: "Pérou"
                },
                {
                    alpha2: "PF",
                    en: "French Polynesia",
                    fr: "Polynésie française"
                },
                {
                    alpha2: "PG",
                    en: "Papua New Guinea",
                    fr: "Papouasie-Nouvelle-Guinée"
                },
                {
                    alpha2: "PH",
                    en: "Philippines",
                    fr: "Philippines"
                },
                {
                    alpha2: "PK",
                    en: "Pakistan",
                    fr: "Pakistan"
                },
                {
                    alpha2: "PL",
                    en: "Poland",
                    fr: "Pologne"
                },
                {
                    alpha2: "PM",
                    en: "Saint Pierre and Miquelon",
                    fr: "Saint-Pierre-et-Miquelon"
                },
                {
                    alpha2: "PN",
                    en: "Pitcairn",
                    fr: "Pitcairn"
                },
                {
                    alpha2: "PR",
                    en: "Puerto Rico",
                    fr: "Porto Rico"
                },
                {
                    alpha2: "PS",
                    en: "Palestine",
                    fr: "Palestine"
                },
                {
                    alpha2: "PT",
                    en: "Portugal",
                    fr: "Portugal"
                },
                {
                    alpha2: "PW",
                    en: "Palau",
                    fr: "Palaos"
                },
                {
                    alpha2: "PY",
                    en: "Paraguay",
                    fr: "Paraguay"
                },
                {
                    alpha2: "QA",
                    en: "Qatar",
                    fr: "Qatar"
                },
                {
                    alpha2: "RE",
                    en: "Réunion",
                    fr: "Réunion"
                },
                {
                    alpha2: "RO",
                    en: "Romania",
                    fr: "Roumanie"
                },
                {
                    alpha2: "RS",
                    en: "Serbia",
                    fr: "Serbie"
                },
                {
                    alpha2: "RU",
                    en: "Russia",
                    fr: "Russie"
                },
                {
                    alpha2: "RW",
                    en: "Rwanda",
                    fr: "Rwanda"
                },
                {
                    alpha2: "SA",
                    en: "Saudi Arabia",
                    fr: "Arabie saoudite"
                },
                {
                    alpha2: "SB",
                    en: "Solomon Islands",
                    fr: "Îles Salomon"
                },
                {
                    alpha2: "SC",
                    en: "Seychelles",
                    fr: "Seychelles"
                },
                {
                    alpha2: "SD",
                    en: "Sudan",
                    fr: "Soudan"
                },
                {
                    alpha2: "SE",
                    en: "Sweden",
                    fr: "Suède"
                },
                {
                    alpha2: "SG",
                    en: "Singapore",
                    fr: "Singapour"
                },
                {
                    alpha2: "SH",
                    en: "Saint Helena",
                    fr: "Sainte-Hélène"
                },
                {
                    alpha2: "SI",
                    en: "Slovenia",
                    fr: "Slovénie"
                },
                {
                    alpha2: "SJ",
                    en: "Svalbard and Jan Mayen",
                    fr: "Svalbard et Île Jan Mayen"
                },
                {
                    alpha2: "SK",
                    en: "Slovakia",
                    fr: "Slovaquie"
                },
                {
                    alpha2: "SL",
                    en: "Sierra Leone",
                    fr: "Sierra Leone"
                },
                {
                    alpha2: "SM",
                    en: "San Marino",
                    fr: "Saint-Marin"
                },
                {
                    alpha2: "SN",
                    en: "Senegal",
                    fr: "Sénégal"
                },
                {
                    alpha2: "SO",
                    en: "Somalia",
                    fr: "Somalie"
                },
                {
                    alpha2: "SR",
                    en: "Suriname",
                    fr: "Suriname"
                },
                {
                    alpha2: "SS",
                    en: "South Sudan",
                    fr: "Soudan du Sud"
                },
                {
                    alpha2: "ST",
                    en: "Sao Tome and Principe",
                    fr: "Sao Tomé-et-Príncipe"
                },
                {
                    alpha2: "SV",
                    en: "El Salvador",
                    fr: "El Salvador"
                },
                {
                    alpha2: "SX",
                    en: "Sint Maarten (Dutch part)",
                    fr: "Saint-Martin (partie néerlandaise)"
                },
                {
                    alpha2: "SY",
                    en: "Syria",
                    fr: "Syrie"
                },
                {
                    alpha2: "SZ",
                    en: "Swaziland",
                    fr: "Swaziland"
                },
                {
                    alpha2: "TC",
                    en: "Turks and Caicos Islands",
                    fr: "Îles Turks et Caïques"
                },
                {
                    alpha2: "TD",
                    en: "Chad",
                    fr: "Tchad"
                },
                {
                    alpha2: "TF",
                    en: "French Southern Territories",
                    fr: "Terres australes françaises"
                },
                {
                    alpha2: "TG",
                    en: "Togo",
                    fr: "Togo"
                },
                {
                    alpha2: "TH",
                    en: "Thailand",
                    fr: "Thaïlande"
                },
                {
                    alpha2: "TJ",
                    en: "Tajikistan",
                    fr: "Tadjikistan"
                },
                {
                    alpha2: "TK",
                    en: "Tokelau",
                    fr: "Tokelau"
                },
                {
                    alpha2: "TL",
                    en: "Timor-Leste",
                    fr: "Timor oriental"
                },
                {
                    alpha2: "TM",
                    en: "Turkmenistan",
                    fr: "Turkménistan"
                },
                {
                    alpha2: "TN",
                    en: "Tunisia",
                    fr: "Tunisie"
                },
                {
                    alpha2: "TO",
                    en: "Tonga",
                    fr: "Tonga"
                },
                {
                    alpha2: "TR",
                    en: "Turkey",
                    fr: "Turquie"
                },
                {
                    alpha2: "TT",
                    en: "Trinidad and Tobago",
                    fr: "Trinité-et-Tobago"
                },
                {
                    alpha2: "TV",
                    en: "Tuvalu",
                    fr: "Tuvalu"
                },
                {
                    alpha2: "TW",
                    en: "Taiwan",
                    fr: "Taïwan"
                },
                {
                    alpha2: "TZ",
                    en: "Tanzania",
                    fr: "Tanzanie"
                },
                {
                    alpha2: "UA",
                    en: "Ukraine",
                    fr: "Ukraine"
                },
                {
                    alpha2: "UG",
                    en: "Uganda",
                    fr: "Ouganda"
                },
                {
                    alpha2: "UM",
                    en: "United States Minor Outlying Islands",
                    fr: "Îles éloignées des États-Unis"
                },
                {
                    alpha2: "US",
                    en: "United States of America",
                    fr: "États-Unis"
                },
                {
                    alpha2: "UY",
                    en: "Uruguay",
                    fr: "Uruguay"
                },
                {
                    alpha2: "UZ",
                    en: "Uzbekistan",
                    fr: "Ouzbékistan"
                },
                {
                    alpha2: "VA",
                    en: "Holy See",
                    fr: "État de la Cité du Vatican"
                },
                {
                    alpha2: "VC",
                    en: "Saint Vincent and the Grenadines",
                    fr: "Saint-Vincent-et-les Grenadines"
                },
                {
                    alpha2: "VE",
                    en: "Venezuela",
                    fr: "Venezuela"
                },
                {
                    alpha2: "VG",
                    en: "Virgin Islands, British",
                    fr: "Îles Vierges britanniques"
                },
                {
                    alpha2: "VI",
                    en: "Virgin Islands, U.S.",
                    fr: "Îles Vierges des États-Unis"
                },
                {
                    alpha2: "VN",
                    en: "Viet Nam",
                    fr: "Viêt Nam"
                },
                {
                    alpha2: "VU",
                    en: "Vanuatu",
                    fr: "Vanuatu"
                },
                {
                    alpha2: "WF",
                    en: "Wallis and Futuna",
                    fr: "Wallis-et-Futuna"
                },
                {
                    alpha2: "WS",
                    en: "Samoa",
                    fr: "Samoa"
                },
                {
                    alpha2: "XK",
                    en: "Kosovo",
                    fr: "Kosovo"
                },
                {
                    alpha2: "YE",
                    en: "Yemen",
                    fr: "Yémen"
                },
                {
                    alpha2: "YT",
                    en: "Mayotte",
                    fr: "Mayotte"
                },
                {
                    alpha2: "ZA",
                    en: "South Africa",
                    fr: "Afrique du Sud"
                },
                {
                    alpha2: "ZM",
                    en: "Zambia",
                    fr: "Zambie"
                },
                {
                    alpha2: "ZW",
                    en: "Zimbabwe",
                    fr: "Zimbabwe"
                }
            ];

            return countries;
        }
    }

})();
