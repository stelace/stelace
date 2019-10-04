// Adapted from: https://github.com/panva/node-oidc-provider-example/blob/master/03-oidc-views-accounts/account.js

const openIdUserId = '23121d3c-84df-44ac-b458-3d63a9a05497'

const users = [
  {
    id: openIdUserId,
    email: 'openid@example.com',
    email_verified: true,
    name: 'OpenID user'
  },
  {
    id: 123456789,
    email: 'oauth2@github.com',
    email_verified: false,
    name: 'Github user',
    first_name: 'Firstname 2',
    last_name: 'Lastname 2'
  }
]

const nbLoginsPerUser = {}

class Account {
  // This interface is required by oidc-provider
  static async findAccount (ctx, id) {
    // This would ideally be just a check whether the account is still in your storage
    const account = users.find(user => user.id === id)
    if (!account) return

    return {
      accountId: id,
      // and this claims() method would actually query to retrieve the account claims
      async claims (use) {
        if (use === 'id_token') {
          nbLoginsPerUser[id] = (nbLoginsPerUser[id] || 0) + 1
        }

        if (nbLoginsPerUser[id] === 2 && id === openIdUserId) {
          // do not include any claims for the second login for the tests
          return {
            sub: id,
            email: null,
            email_verified: null,
            name: null,
            first_name: 'New firstname',
            last_name: 'New lastname'
          }
        }

        return {
          sub: id,
          email: account.email,
          email_verified: account.email_verified,
          name: account.name
        }
      }
    }
  }

  // This can be anything you need to authenticate a user
  static async authenticate (email, password) {
    try {
      if (!password) throw new Error('password must be provided')
      if (!email) throw new Error('email must be provided')
      const lowercased = String(email).toLowerCase()
      const account = users.find(user => user.email === lowercased)
      if (!account) throw new Error('invalid credentials provided')

      return account.id
    } catch (err) {
      return undefined
    }
  }
}

module.exports = Account
