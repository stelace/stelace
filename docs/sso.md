# SSO

## OpenID

Here is how you can generate a jwks object from a public certificate in case your provider does not expose a `jwks_uri` endpoint.

You may need to add this `jwks` object to your `ssoConnection` with `openid` protocol.

```js
const fs = require('fs')
const jose = require('node-jose') // yarn add -D node-jose

const certificateContent = fs.readFileSync('./my_public_certificate.cer')

const keystore = jose.JWK.createKeyStore()

keystore
  .add(certificateContent, 'pem')
  .then(() => {
    const jwks = keystore.toJSON()
    console.log(JSON.stringify(jwks, null, 2))
  })
```
