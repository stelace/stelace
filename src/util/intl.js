// With current version (12.14) of Node.js, `small-icu` is embedded by default
// (only English support for dates and numbers)
// https://nodejs.org/api/intl.html#intl_options_for_building_node_js

// `full-icu` is included by default starting from v13
// https://github.com/nodejs/node/pull/29522

// For the time being, we need to apply a polyfill to support all locales.
// Here's a function to detect if some locale is missing:
// https://nodejs.org/api/intl.html#intl_detecting_internationalization_support
function hasFullICU () {
  try {
    const january = new Date(9e8)
    const spanish = new Intl.DateTimeFormat('es', { month: 'long' })
    return spanish.format(january) === 'enero'
  } catch (err) {
    return false
  }
}

function applyIntlPolyfill () {
  if (hasFullICU()) return

  const IntlPolyfill = require('intl')

  if (global.Intl) {
    // Intl exists, but it doesn't have the data we need, so load the
    // polyfill and patch the constructors we need with the polyfill's.
    Intl.NumberFormat = IntlPolyfill.NumberFormat
    Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat
  } else {
    // No Intl, so use and load the polyfill.
    global.Intl = IntlPolyfill
  }
}

module.exports = {
  hasFullICU,
  applyIntlPolyfill
}
