function encodeBase64 (str) {
  const buffer = Buffer.from(str)
  return buffer.toString('base64')
}

function decodeBase64 (str) {
  const buffer = Buffer.from(str, 'base64')
  return buffer.toString('ascii')
}

module.exports = {
  encodeBase64,
  decodeBase64
}
