const { URL } = require('url')

function setSearchParams (url, newParams) {
  const urlObject = new URL(url)

  Object.keys(newParams).forEach(key => {
    const value = newParams[key]
    if (urlObject.searchParams.has(key)) {
      urlObject.searchParams.set(key, value)
    } else {
      urlObject.searchParams.append(key, value)
    }
  })

  return urlObject.toString()
}

module.exports = {
  setSearchParams
}
