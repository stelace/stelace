var i18nCompile = require('i18n-compile');
var path = require('path');

i18nCompile(
    [path.join(__dirname, '../translations/source/*.yaml'), path.join(__dirname, '../translations/user/*.yaml')],
    path.join(__dirname, '../translations/[lang].json'),
    {langPlace: '[lang]'}
);
