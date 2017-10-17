module.exports = {

    getSize,
    resize,
    compress,

    getColor,
    getPlaceholder,

};

const gm       = require('gm');
const Imagemin = require('imagemin');

/**
 * Get the image dimensions
 * @param  {string} filepath
 * @return {object} size
 * @return {number} size.width
 * @return {number} size.height
 */
function getSize(filepath) {
    return new Promise((resolve, reject) => {
        gm(filepath).size((err, size) => {
            if (err) {
                reject(err);
            } else {
                resolve(size);
            }
        });
    });
}

function resize(filepath, destPath, { width, height }) {
    return new Promise((resolve, reject) => {
        gm(filepath)
            .resize(width, height)
            .write(destPath, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
    });
}

function compress(filepath, destPath) {
    return new Promise((resolve, reject) => {
        var imagemin = new Imagemin()
                        .src(filepath)
                        .dest(destPath)
                        .use(Imagemin.jpegtran({ progressive: true }))
                        .use(Imagemin.optipng({ optimizationLevel: 3 }));

        imagemin.run((err, files) => {
            if (err) {
                reject(err);
            } else {
                resolve(files[0]);
            }
        });
    });
}

function getColor(filepath) {
    return new Promise((resolve, reject) => {
        gm(filepath)
            .resize(250, 250)
            .colors(1)
            .toBuffer('RGB', (err, buffer) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buffer.slice(0, 3).toString('hex'));
                }
            });
    });
}

function getPlaceholder(filepath) {
    return new Promise((resolve, reject) => {
        gm(filepath)
            .resize(3, 3)
            .toBuffer('GIF', function (err, buffer) {
                if (err) {
                    reject(err);
                } else {
                    const dataSrc = `data:image/gif;base64,${buffer.toString('base64')}`;
                    resolve(dataSrc);
                }
            });
    });
}
