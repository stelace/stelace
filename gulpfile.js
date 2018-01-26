var gulp        = require('gulp');
var $$          = require('gulp-load-plugins')();
var del         = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var fs          = require('fs');
var crypto      = require('crypto'); // eslint-disable-line
var path        = require('path');
var exec        = require('child_process').exec;

var reload      = browserSync.reload;

///////////////////
// Configuration //
///////////////////

var jsConfig = {

    "app-pre": [
        "assets/vendors/modernizr-custom.js"
    ],

    "app-lib": [
        // vendor
        "assets/bower_components/lodash/lodash.js",
        "assets/bower_components/moment/min/moment.min.js",
        "assets/bower_components/moment/locale/fr.js",
        "assets/bower_components/es6-promise-polyfill/promise.js",
        "assets/bower_components/source-map/dist/source-map.js",
        "assets/js/alias/sourceMap.js", // useful for stacktrace.js
        "assets/bower_components/stackframe/dist/stackframe.js",
        "assets/bower_components/stacktrace-gps/dist/stacktrace-gps.js",
        "assets/bower_components/domurl/url.js",
        "assets/bower_components/error-stack-parser/dist/error-stack-parser.js",
        "assets/bower_components/stack-generator/dist/stack-generator.js",
        "assets/bower_components/stacktrace-js/dist/stacktrace.min.js",
        "assets/bower_components/fastclick/lib/fastclick.js",
        "assets/bower_components/cryptojslib/rollups/sha1.js",
        "assets/bower_components/cryptojslib/rollups/sha256.js",
        "assets/bower_components/localforage/dist/localforage.js",
        "assets/bower_components/svg4everybody/dist/svg4everybody.js",
        "assets/bower_components/hammerjs/hammer.js",
        "assets/bower_components/photoswipe/dist/photoswipe.js",
        "assets/bower_components/photoswipe/dist/photoswipe-ui-default.js",
        "assets/bower_components/spin.js/spin.js",
        "assets/bower_components/viewport-units-buggyfill/viewport-units-buggyfill.js",
        "assets/vendors/redux-3.7.2.min.js",
        "assets/bower_components/angular/angular.js",
        "assets/bower_components/angular-i18n/angular-locale_fr-fr.js",
        "assets/bower_components/restangular/dist/restangular.js",
        "assets/bower_components/angular-ui-router/release/angular-ui-router.js",

        "assets/bower_components/angular-ui-select/dist/select.min.js",
        // used patched version (0.13.2) for tag deletion on button click instead of cross click only
        // "assets/bower_components/angular-ui-select-patched/dist/select.js",
        "assets/bower_components/angular-animate/angular-animate.js",
        "assets/bower_components/angular-cookies/angular-cookies.js", // official (for translations)
        "assets/bower_components/angular-cookie/angular-cookie.js",
        "assets/bower_components/angular-credit-cards/release/angular-credit-cards.js",
        "assets/bower_components/angular-easyfb/build/angular-easyfb.js",
        "assets/bower_components/angular-localforage/dist/angular-localForage.js",
        "assets/bower_components/angular-jwt/dist/angular-jwt.js",
        "assets/bower_components/angular-google-maps/dist/angular-google-maps.js",
        "assets/bower_components/angular-simple-logger/dist/angular-simple-logger.js",
        // "assets/bower_components/ngAutocomplete/src/ngAutocomplete.js",  // commit the module in project widgets for the moment
        "assets/bower_components/angular-spinner/angular-spinner.js",
        "assets/bower_components/angular-toastr/dist/angular-toastr.tpls.js",
        "assets/bower_components/angularjs-slider/dist/rzslider.js",
        "assets/bower_components/angular-lazy-img/release/angular-lazy-img.js",

        // use a custom version where production message build is removed (do not use the minified version of bower because it breaks the workflow)
        "assets/vendors/ng-redux-3.5.2.js",
        // "assets/bower_components/ng-redux/dist/ng-redux.js",

        // Translations (cookie is a dependency for local storage)
        "assets/bower_components/messageformat/messageformat.js",
        "assets/bower_components/angular-translate/angular-translate.js",
        "assets/bower_components/angular-translate-storage-cookie/angular-translate-storage-cookie.js",
        "assets/bower_components/angular-translate-storage-local/angular-translate-storage-local.js",
        "assets/bower_components/angular-translate-loader-static-files/angular-translate-loader-static-files.js",
        "assets/bower_components/angular-translate-interpolation-messageformat/angular-translate-interpolation-messageformat.js",

        // Foundation for apps
        "assets/bower_components/foundation-apps/dist/js/foundation-apps.js", // apply foundation-patch after bower
        "assets/bower_components/foundation-apps/dist/js/foundation-apps-templates.js",
    ],

    "app-lib-dev": [
        // monitoring
        "assets/bower_components/ng-stats/dist/ng-stats.js"
    ],

    app: [
        // Sharinplace app
        "assets/app/actions/**/*.js",
        "assets/app/reducers/**/*.js",
        "assets/app/core/core.module.js",
        "assets/app/data/data.module.js",
        "assets/app/**/*.module.js",
        "assets/app/app.module.js",
        "assets/app/core/restangular.config.js",
        "assets/app/**/*.route.js",
        "assets/app/**/*.js"
    ]

};

var scssConfig = {

    sass: [
        "assets/scss/app.scss"
    ],

    linker: {

        app: "assets/build/css/app.css"

    }

};





//////////////////////
// Helper functions //
//////////////////////

var getChecksum = function (filepath, algorithm, encoding) {
    var data = fs.readFileSync(filepath, { encoding: "utf8" });

    return crypto
        .createHash(algorithm || "md5")
        .update(data, "utf8")
        .digest(encoding || "hex");
};

var getSassConfig = function (prod) {
    prod = prod || false;

    return {
        outputStyle: (prod ? "compressed" : "nested"),
        errLogToConsole: true,
        includePaths: ["assets/bower_components/foundation-apps/scss"]
    };
};

var getAutoprefixerConfig = function () {
    return {
        cascade: false
    };
};

var getSvgSpriteConfig = function (prod) {
    prod = prod || false;

    var configSymbol = {
        dest: "",
        prefix: "icon-%s",
        sprite: "sprite.svg",
        inline: false
    };

    if (! prod) {
        configSymbol.example = {
            dest: "sprite.html"
        };
    }

    var config = {
        mode: {
            symbol: configSymbol
        }
    };

    return config;
};

var getTemplateCacheConfig = function () {
    return {
        filename: "app-template.js",
        module: "app.templates",
        standalone: true,
        transformUrl: url => "/assets/app/" + url
    };
};





////////////////
// Gulp tasks //
////////////////

/** Clean **/
gulp.task('clean', function (cb) {
    del([".tmp"]).then(function () { cb(); });
});

gulp.task('clean-build', function (cb) {
    del([
        "assets/build/**/*",
        ".tmp"
    ]).then(function () { cb(); });
});

/** Browser sync **/
gulp.task('browser-sync', function () {
    browserSync.init({
        proxy: "localhost:1337",
        open: false
    });
});

/** Cache bust **/
gulp.task('cache-bust', function () {
    var folderpath = ".tmp/public/assets/build";
    var source = [
        folderpath + "/**/*.{css,js}",
        "!" + folderpath + "/**/*-h.{css,js}"
    ];

    return gulp.src(source)
        .pipe($$.rename(function (p) {
            var filepath = path.join(__dirname, folderpath, p.dirname, p.basename + p.extname);
            var checksum = getChecksum(filepath);

            p.basename += "." + checksum + "-h";
        }))
        .pipe(gulp.dest(folderpath));
});

/** Assets **/
gulp.task('serve:root', function () {
    return gulp.src("assets/root/**/*")
        .pipe(gulp.dest(".tmp/public"));
});

gulp.task('serve:translations', function () {
    return gulp.src("translations/*.json")
        .pipe($$.jsonFormat(4))
        .pipe($$.eol("\n"))
        .pipe(gulp.dest("translations"))
        .pipe(gulp.dest(".tmp/public/assets/translations"));
});

gulp.task('serve:newsletters', function () {
    return gulp.src("assets/newsletters/**/*.html")
        .pipe($$.minifyHtml({
            empty: true,
            conditionals: true,
            quotes: true
        }))
        .pipe(gulp.dest(".tmp/public/newsletters", { base: "assets/newsletters" }));
});

gulp.task('serve:images:dev', function () {
    return gulp.src("assets/img/**/*")
        .pipe(gulp.dest(".tmp/public/assets/img", { base: "assets/img" }));
});

gulp.task('serve:images:prod', ['minify:images', 'serve:images-svg']);

gulp.task('minify:images', function () {
    return gulp.src([
            "assets/img/**/*",
            "!assets/img/**/*.svg"
        ])
        .pipe($$.imagemin({
            progressive: true
        }))
        .pipe(gulp.dest(".tmp/public/assets/img", { base: "assets/img" }));
});

gulp.task('serve:images-svg', function () {
    return gulp.src("assets/img/**/*.svg")
        .pipe(gulp.dest(".tmp/public/assets/img", { base: "assets/img" }));
});

gulp.task('serve:bower_components', function () {
    return gulp.src("assets/bower_components/**/*")
        .pipe(gulp.dest(".tmp/public/assets/bower_components", { base: "assets/bower_components" }));
});

gulp.task('serve:build', function () {
    return gulp.src("assets/build/**/*")
        .pipe(gulp.dest(".tmp/public/assets/build", { base: "assets/build" }));
});

/** App templates **/
const appTemplatesStream = ({ destFolder }) => {
    return gulp.src("assets/app/**/*.html")
        .pipe($$.plumber())
        .pipe($$.minifyHtml({
            empty: true,
            conditionals: true,
            quotes: true
        }))
        .pipe($$.angularTemplatecache(getTemplateCacheConfig()))
        .pipe(gulp.dest(destFolder));
};

gulp.task('build:app-templates', function () {
    return appTemplatesStream({ destFolder: 'assets/build/js' });
});

gulp.task('watch:app-templates', function () {
    return appTemplatesStream({ destFolder: '.tmp/public/assets/build/js' })
        .pipe(reload({ stream: true }));
});

/** App **/
const appDevStream = ({ destFolder }) => {
    return gulp.src(jsConfig.app)
        .pipe($$.plumber())
        .pipe($$.sourcemaps.init())
            .pipe($$.concat("app.js"))
            .pipe($$.ngAnnotate())
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest(destFolder));
};

gulp.task('build:app:dev', function () {
    return appDevStream({ destFolder: 'assets/build/js' });
});

gulp.task('watch:app:dev', function () {
    return appDevStream({ destFolder: '.tmp/public/assets/build/js' });
});

const appPreStream = ({ destFolder, isProd = false }) => {
    return gulp.src(jsConfig["app-pre"])
        .pipe($$.plumber())
        .pipe($$.sourcemaps.init())
            .pipe($$.concat("app-pre.js"))
            .pipe($$.if(isProd, $$.uglify()))
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest(destFolder));
};

gulp.task('build:app-pre:dev', function () {
    return appPreStream({ destFolder: 'assets/build/js' });
});

gulp.task('build:app-pre:prod', function () {
    return appPreStream({ destFolder: 'assets/build/js', isProd: true });
});

gulp.task('build:app-lib', function () {
    var source = jsConfig["app-lib"]
        .concat(jsConfig["app-lib-dev"]);

    return gulp.src(source)
        .pipe($$.plumber())
        .pipe($$.sourcemaps.init())
            .pipe($$.concat("app-lib.js"))
            .pipe($$.ngAnnotate())
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest("assets/build/js"));
});

gulp.task('build:app:prod', function () {
    var source = jsConfig["app-lib"]
        .concat("assets/build/js/app-template.js")
        .concat(jsConfig.app);

    return gulp.src(source)
        .pipe($$.plumber())
        .pipe($$.sourcemaps.init())
            .pipe($$.concat("app.js"))
            .pipe($$.ngAnnotate())
            .pipe($$.uglify())
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest("assets/build/js"));
});

/** Translations **/
gulp.task('build:translations', function (cb) {
    exec('npm run translate', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb(err);
    });
});

const translationsCacheStream = ({ destFolder }) => {
    // Cache main language to avoid flash of untranslated content (FOUC)
    const lang = 'en'; // TODO: use config default language
    // cf. https://www.npmjs.com/package/gulp-ng-lang2js

    const source = `translations/${lang}.json`;

    return gulp.src(source)
        .pipe($$.plumber())
        .pipe($$.ngLang2js({
            declareModule: true,
            moduleName   : 'stelace.translationCache',
            prefix       : 'assets/translations/'
        }))
        .pipe($$.sourcemaps.init())
            .pipe($$.concat("app-lang.js"))
            .pipe($$.ngAnnotate())
            .pipe($$.uglify())
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest(destFolder));
};

gulp.task('build:translations:cache', function () {
    return translationsCacheStream({ destFolder: 'assets/build/js' });
});

gulp.task('watch:translations:cache', function () {
    return translationsCacheStream({ destFolder: '.tmp/public/assets/build/js' });
});

/** Sass **/
const sassStream = ({ destFolder, base, isProd = false }) => {
    let destOptions = {};

    if (base) {
        destOptions.base = base;
    }

    return gulp.src(scssConfig.sass)
        .pipe($$.sourcemaps.init())
            .pipe($$.sass(getSassConfig(isProd)))
                .on("error", $$.sass.logError)
            .pipe($$.autoprefixer(getAutoprefixerConfig()))
        .pipe($$.sourcemaps.write("../sourcemaps"))
        .pipe(gulp.dest(destFolder, destOptions));
};

gulp.task('build:sass:dev', function () {
    return sassStream({ destFolder: 'assets/build/css' });
});

gulp.task('watch:sass:dev', function () {
    return sassStream({ destFolder: '.tmp/public/assets/build/css', base: 'assets/scss' })
        .pipe($$.filter("**/*.css"))
        .pipe(reload({ stream: true }));
});

gulp.task('build:sass:prod', function () {
    return sassStream({ destFolder: 'assets/build/css', isProd: true });
});

/** Sprites **/
const spritesSvgStream = ({ destFolder, isProd = false }) => {
    return gulp.src("assets/icons/*.svg")
        .pipe($$.svgSprite(getSvgSpriteConfig(isProd)))
        .pipe(gulp.dest(destFolder));
};

gulp.task('build:sprites-svg:dev', function () {
    return spritesSvgStream({ destFolder: 'assets/build/icons' });
});

gulp.task('build:sprites-svg:prod', function () {
    return spritesSvgStream({ destFolder: 'assets/build/icons', isProd: true });
});

/** Linker **/
gulp.task('linker:dev', function () {
    return gulp.src("views/layouts/**/*.ejs")
        .pipe($$.inject(gulp.src("assets/build/js/app-pre.js", { read: false }), { name: "app-pre" }))
        .pipe($$.inject(gulp.src([
            "assets/build/js/app-lib.js",
            "assets/build/js/app-template.js",
            "assets/build/js/app.js"
        ], { read: false }), { name: "app" }))
        .pipe($$.inject(gulp.src("assets/build/js/app-lang.js", { read: false }), { name: "app-lang" }))
        .pipe($$.inject(gulp.src(scssConfig.linker.app, { read: false }), { name: "app" }))
        .pipe(gulp.dest("views/layouts"));
});

gulp.task('linker:prod', function () {
    return gulp.src("views/layouts/**/*.ejs")
        .pipe($$.inject(gulp.src("assets/build/js/app-pre.js", { read: false }), {
            name: "app-pre",
            transform: transformScript
        }))
        .pipe($$.inject(gulp.src("assets/build/js/app.js", { read: false }), {
            name: "app",
            transform: transformScript
        }))
        .pipe($$.inject(gulp.src("assets/build/js/app-lang.js", { read: false }), {
            name: "app-lang",
            transform: transformScript
        }))
        .pipe($$.inject(gulp.src(scssConfig.linker.app, { read: false }), {
            name: "app",
            transform: transformStyle
        }))
        .pipe(gulp.dest("views/layouts"));



    function transformScript(filepath) {
        var checksum    = getChecksum(path.join(__dirname, filepath));
        var newFilepath = filepath.replace(/^(.*)(\..*)$/gi, `$1.${checksum}-h$2`);

        return `<script src="${newFilepath}"></script>`;
    }

    function transformStyle(filepath) {
        var checksum    = getChecksum(path.join(__dirname, filepath));
        var newFilepath = filepath.replace(/^(.*)(\..*)$/gi, `$1.${checksum}-h$2`);

        return `<link rel="stylesheet" href="${newFilepath}">`;
    }
});






/////////////////////
// Gulp main tasks //
/////////////////////

gulp.task('default', ['build', 'browser-sync'], function () {
    gulp.watch(jsConfig.app, ["watch:app:dev"]);

    gulp.watch("assets/img/**/*", ["serve:images:dev"]);

    gulp.watch("translations/**/*.yaml", ['build:translations']);

    gulp.watch("translations/*.json", ['serve:translations', 'watch:translations:cache']);

    gulp.watch("assets/scss/**/*", ["watch:sass:dev"]);

    gulp.watch("assets/app/**/*.html", ["watch:app-templates"]);
});

gulp.task('build', function (cb) {
    runSequence(
        ['build:app-pre:dev', 'build:app:dev', 'build:app-lib', 'build:app-templates', 'build:sass:dev', 'build:sprites-svg:dev', 'build:translations'],
        ['serve:root', 'serve:translations', 'serve:newsletters', 'serve:images:dev', 'serve:build', 'serve:bower_components', 'build:translations:cache'],
        'linker:dev',
        cb
    );
});

gulp.task('build-prod', function (cb) {
    runSequence(
        ['build:app-templates', 'build:translations'],
        ['build:app-pre:prod', 'build:app:prod', 'build:sass:prod', 'build:sprites-svg:prod', 'build:translations:cache'],
        ['serve:root', 'serve:translations', 'serve:newsletters', 'serve:images:dev', 'serve:build', 'serve:bower_components'],
        ['linker:prod', 'cache-bust'],
        'compress',
        cb
    );
});

gulp.task('compress', function () {
    return gulp.src([
            ".tmp/public/**/*",
            "!.tmp/public/**/*.gz"
        ])
        .pipe($$.gzip({
            append: true,
            threshold: 1400,
            gzipOptions: {
                level: 9
            }
        }))
        .pipe(gulp.dest(".tmp/public"));
});
