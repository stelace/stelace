/* global axios, Buefy, CryptoJS, Vue */

Vue.use(Buefy.default);

var defaultSelectedLang = 'en';

new Vue({
    el: '#app',
    mounted: function () {
        var _this = this;

        this.fetchInstallStatus()
            .then(function (res) {
                var installed = res.installed;

                if (!installed) {
                    _this.installing = true;
                    _this.installed = false;
                } else {
                    _this.installing = false;
                    _this.installed = true;
                }

                if (installed) {
                    return _this.getStelaceConfig()
                        .then(function (stelaceConfig) {
                            _this.selectedLang = stelaceConfig.config.lang;
                        });
                }
            })
            .then(function () {
                _this.loaded = true;
            });
    },
    data: {
        loaded: false,
        installing: false,
        installed: false,
        step: 1,
        selectedLang: defaultSelectedLang,
        serviceName: null,
        email: null,
        password: null,
        errors: {
            serviceName: null,
            email: null,
            password: null,
        },
        installationFailed: false
    },
    computed: {
        lang: function () {
            return window.lang[this.selectedLang];
        }
    },
    methods: {
        fetchInstallStatus: function () {
            return axios.get('/api/stelace/config/install/status')
                .then(function (res) {
                    return res.data;
                });
        },
        postInstall: function (params) {
            return axios
                .post('/api/stelace/config/install', {
                    lang: params.lang,
                    serviceName: params.serviceName,
                    email: params.email,
                    password: params.password
                });
        },
        getStelaceConfig: function () {
            return axios.get('/api/stelace/config')
                .then(function (res) {
                    return res.data;
                });
        },
        goBack: function () {
            this.step -= 1;
        },
        goNext: function () {
            this.step += 1;
        },
        goToHome: function () {
            window.location.href = '/';
        },
        install: function () {
            var _this = this;

            this.resetErrors();
            this.installationFailed = false;

            this.setFormErrors();
            if (this.hasError()) return;

            var params = {
                lang: this.selectedLang,
                serviceName: this.serviceName,
                email: this.email,
                password: CryptoJS.SHA256(this.password).toString()
            };

            return this.postInstall(params)
                .then(function () {
                    _this.step += 1;
                })
                .catch(function () {
                    _this.installationFailed = true;
                });
        },
        setFormErrors: function () {
            if (!this.serviceName) {
                this.errors.serviceName = this.lang.emptyFieldError;
            }
            if (!this.email) {
                this.errors.email = this.lang.emptyFieldError;
            } else if (!this.isEmail(this.email)) {
                this.errors.email = this.lang.emailErrorFormat;
            }
            if (!this.password) {
                this.errors.password = this.lang.emptyFieldError;
            } else if (this.password.length < 8) {
                this.errors.password = this.lang.passwordErrorLength;
            }
        },
        resetErrors: function () {
            this.errors = {
                serviceName: null,
                email: null,
                password: null
            };
        },
        hasError: function () {
            return _.reduce(this.errors, function (memo, isError) {
                if (isError) return true;
                return memo;
            }, false);
        },
        isEmail: function (value) {
            var emailRegex = /^[a-z0-9._-]+@[a-z0-9._-]{2,}\.[a-z]{2,}$/;
            return typeof value === "string" && emailRegex.test(value);
        }
    }
});
