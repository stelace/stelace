(function () {

    angular
        .module("app.core")
        .factory("mangopay", mangopay);

    // https://github.com/Mangopay/cardregistration-js-kit/blob/master/kit/mangopay-kit.js
    function mangopay($q, tools) {
        var cardRegisterData;

        var validation = {
            cvvValidator: {
                validate: cvvValidator_validate
            },
            expirationDateValidator: {
                validate: expirationDateValidator_validate
            },
            cardNumberValidator: {
                validate: cardNumberValidator_validate,
                validateCheckDigit: cardNumberValidator_validateCheckDigit
            }
        };

        var service = {};
        service.corsSupport = corsSupport;

        service.cardRegistration = {};
        service.cardRegistration.init         = init;
        service.cardRegistration.registerCard = registerCard;

        return service;



        /**
         * Initialize card registration object
         *
         * @param {object} cardData Card pre-registration data {id, cardRegistrationURL, preregistrationData, accessKey}
         */
        function init(cardData) {
            cardRegisterData = cardData;
        }

        /**
         * Processes card registration
         *
         * @param {object} cardData Sensitive card details {cardNumber, cardType, cardExpirationDate, cardCvx}
         */
        function registerCard(cardData) {
            return $q(function (resolve, reject) {
                if (! corsSupport()) {
                    reject({
                        resultCode: "009999",
                        resultMessage: "Browser does not support making cross-origin Ajax calls"
                    });
                }

                var isCardValid = _validateCardData(cardData);
                if (isCardValid !== true) {
                    return reject(isCardValid);
                }

                _tokenizeCard(cardData)
                    .then(function (data) {
                        resolve(data);
                    })
                    .catch(function (err) {
                        reject(err);
                    });
            });
        }

        /**
         * Gets Payline token for the card
         *
         * @param {object} cardData Sensitive card details {cardNumber, cardExpirationDate, cardCvx, cardType}
         */
        function _tokenizeCard(cardData) {
            return $q(function (resolve, reject) {

                // Get Payline token
                _ajax({

                    // Payline expects POST
                    type: "post",

                    // Payline service URL obtained from the mangoPay.cardRegistration.init() call
                    url: cardRegisterData.cardRegistrationURL,

                    // Force CORS
                    crossDomain: true,

                    // Sensitive card data plus pre-registration data and access key received from the mangoPay.cardRegistration.init() call
                    data: {
                        data: cardRegisterData.preregistrationData,
                        accessKeyRef: cardRegisterData.accessKey,
                        cardNumber: cardData.cardNumber,
                        cardExpirationDate: cardData.cardExpirationDate,
                        cardCvx: cardData.cardCvx
                    },

                    // Forward response to the return URL
                    success: function (data) {

                        // Something wrong, no data came back from Payline
                        if (data === null) {
                            reject({
                                resultCode: "001599",
                                resultMessage: "Token processing error"
                            });
                        } else {
                            resolve(data);
                        }
                    },

                    error: function (/* xmlhttp */) {
                        reject({
                            resultCode: "001599",
                            resultMessage: "Token processing error"
                        });
                    }

                });

            });
        }

        function corsSupport() {
            // IE 10 and above, Firefox, Chrome, Opera etc.
            if ("withCredentials" in new XMLHttpRequest()) {
                return true;
            }

            // IE 8 and IE 9
            if (window.XDomainRequest) {
                return true;
            }

            return false;
        }

        function _validateCardData(cardData) {
            // Validate card number
            var isCardValid = validation.cardNumberValidator.validate(cardData.cardNumber);
            if (isCardValid !== true) {
                return isCardValid;
            }

            // Validate expiration date
            var isDateValid = validation.expirationDateValidator.validate(cardData.cardExpirationDate, new Date());
            if (isDateValid !== true) {
                return isDateValid;
            }

            // Validate card CVx based on card type
            var isCvvValid = validation.cvvValidator.validate(cardData.cardCvx, cardData.cardType);
            if (isCvvValid !== true) {
                return isCvvValid;
            }

            // The data looks good
            return true;
        }

        function _isOnlyNumeric(str) {
            var numbers = (/^[0-9]+$/);
            return numbers.test(str);
        }

        /**
         * Performs an asynchronous HTTP (Ajax) request
         *
         * @param {object} settings {type, crossDomain, url, data}
         */
        function _ajax(settings) {
            // XMLHttpRequest object
            var xmlhttp = new XMLHttpRequest();

            // Put together input data as string
            var parameters = "";
            _.forEach(settings.data, function (value, key) {
                parameters += (parameters.length > 0 ? '&' : '') + key + "=" + encodeURIComponent(value);
            });

            // URL to hit, with parameters added for GET request
            var url = settings.url;
            if (settings.type === "get") {
                url = settings.url + (settings.url.indexOf("?") > -1 ? '&' : '?') + parameters;
            }

            // Cross-domain requests in IE 7, 8 and 9 using XDomainRequest
            if (settings.crossDomain && !("withCredentials" in xmlhttp) && window.XDomainRequest) {
                var xdr = new XDomainRequest();
                xdr.onerror = function () {
                    settings.error(xdr);
                };
                xdr.onload = function () {
                    settings.success(xdr.responseText);
                };
                xdr.open(settings.type, url);
                xdr.send(settings.type === "post" ? parameters : null);
                return;
            }

            // Attach success and error handlers
            xmlhttp.onload = function () {
                if (/^2[0-9][0-9]$/.test(xmlhttp.status)) {
                    settings.success(xmlhttp.responseText);
                } else {
                    settings.error(xmlhttp, xmlhttp.status, xmlhttp.statusText);
                }
            };

            xmlhttp.onerror = function (err) {
                settings.error(err.error);
            };

            // Open connection
            xmlhttp.open(settings.type, url, true);

            // Send extra header for POST request
            if (settings.type === "post") {
                xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            }

            // Send data
            xmlhttp.send(settings.type === "post" ? parameters : null);
        }

        /**
         * Validates CVV code
         *
         * @param {string} cvv Card CVx to check
         * @param {string} cardType Type of card to check (AMEX or CB_VISA_MASTERCARD)
         */
        function cvvValidator_validate(cvv, cardType) {
            cvv = cvv ? tools.trim(cvv) : "";
            cardType = cardType ? tools.trim(cardType) : "";

            // CVV is 3 to 4 digits for AMEX cards and 3 digits for all other cards
            if (_isOnlyNumeric(cvv) === true) {
                if (cardType === "AMEX" && (cvv.length === 3 || cvv.length === 4)) {
                    return true;
                }
                if (cardType === "CB_VISA_MASTERCARD" && cvv.length === 3) {
                    return true;
                }
            }

            // Invalid format
            return {
                resultCode: "105204",
                resultMessage: "CVV_FORMAT_ERROR"
            };
        }

        /**
         * Validates date code in mmyy format
         *
         * @param {string} cardDate Card expiration date to check
         */
        function expirationDateValidator_validate(cardDate, currentDate) {
            cardDate = cardDate ? tools.trim(cardDate) : "";

            // Requires 2 digit for month and 2 digits for year
            if (cardDate.length === 4) {

                var year  = parseInt(cardDate.substr(2, 2), 10) + 2000;
                var month = parseInt(cardDate.substr(0, 2), 10);

                if (month > 0 && month <= 12) {

                    var currentYear = currentDate.getFullYear();
                    if (currentYear < year) {
                        return true;
                    }

                    if (currentYear === year) {
                        var currentMonth = currentDate.getMonth() + 1;
                        if (currentMonth <= month) {
                            return true;
                        }
                    }

                    // Date is in the past
                    return {
                        resultCode: "105203",
                        resultMessage: "PAST_EXPIRY_DATE_ERROR"
                    };

                }
            }

            // Date does not look correct
            return {
                resultCode: "105203",
                resultMessage: "EXPIRY_DATE_FORMAT_ERROR"
            };
        }

        /**
         * Validates card number
         *
         * @param {string} cardNumber Card number to check
         */
        function cardNumberValidator_validate(cardNumber) {
            cardNumber = cardNumber ? tools.trim(cardNumber) : "";

            // Check for numbers only
            if (_isOnlyNumeric(cardNumber) === false) {
                return {
                    resultCode: "105202",
                    resultMessage: "CARD_NUMBER_FORMAT_ERROR"
                };
            }

            // Compute and validate check digit
            if (validation.cardNumberValidator.validateCheckDigit(cardNumber) === false) {
                return {
                    resultCode: "105202",
                    resultMessage: "CARD_NUMBER_FORMAT_ERROR"
                };
            }

            // Number seems ok
            return true;
        }

        /**
         * Validates card number check digit
         *
         * @param {string} cardNumber Card number to check
         */
        function cardNumberValidator_validateCheckDigit(cardNumber) {
            // From https://stackoverflow.com/questions/12310837/implementation-of-luhn-algorithm
            var nCheck = 0;
            var nDigit = 0;
            var bEven = false;

            var value = cardNumber.replace(/\D/g, "");

            for (var n = value.length - 1; n >= 0; n--) {
                var cDigit = value.charAt(n);
                nDigit = parseInt(cDigit, 10);
                if (bEven) {
                    if ((nDigit *= 2) > 9) {
                        nDigit -= 9;
                    }
                }
                nCheck += nDigit;
                bEven = !bEven;
            }

            return (nCheck % 10) === 0;
        }
    }

})();
