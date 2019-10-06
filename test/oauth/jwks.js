const { JWKS: { KeyStore } } = require('jose')

function generateJwks () {
  const keystore = new KeyStore()
  keystore.generateSync('RSA', 2048, {
    alg: 'RS256',
    use: 'sig'
  })

  return keystore.toJWKS(true)
}

module.exports = {
  generateJwks
}
