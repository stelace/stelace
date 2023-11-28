// const { computeDate } = require('../util')
const { createModel } = require('./factory')

const roles = require('../../src/roles')

const now = new Date().toISOString()

module.exports = (env, apiKeys = {}) => ({
  apiKey: [
    createModel({
      id: 'apik_aHZQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Master Secret key',
      key: apiKeys.secret || `seck_${env}_wakWA41rBTUXs1Y5oNRjeY5o`, // platformId 1 api key
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'apik_WB2Oks1pKm1hh0EcpKm',
      createdDate: now,
      updatedDate: now,
      name: 'Publishable key',
      key: apiKeys.publishable || `pubk_${env}_HZ908JhKNeLWs16Ccl7N46Cc`, // platformId 1 api key
      roles: [],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    })
  ],

  assessment: [
  ],

  asset: [
  ],

  authMean: [
  ],

  authToken: [
  ],

  availability: [
  ],

  category: [
  ],

  config: [
    createModel({
      id: 'conf_WhgRVs1C7m1gxihuC7m',
      createdDate: now,
      updatedDate: now,
      access: 'default',
      stelace: {
        instant: {
          locale: 'en',
          currency: 'USD'
        }
      },
      custom: {},
      theme: {}
    }),

    createModel({
      id: 'conf_rzR4hs1EqR1hO8W3EqR',
      createdDate: now,
      updatedDate: now,
      access: 'private',
      stelace: {
        instant: {
        }
      },
      custom: {},
      theme: {}
    }),

    createModel({
      id: 'conf_OwtrPs1h0r1hSbn1h0r',
      createdDate: now,
      updatedDate: now,
      access: 'system',
      stelace: {
      },
      custom: {},
      theme: {}
    })
  ],

  customAttribute: [
  ],

  document: [
  ],

  entry: [
  ],

  event: [
  ],

  message: [
  ],

  order: [
  ],

  role: [
    createModel({
      id: 'role_C5ZIBs105v1gHK1i05v',
      createdDate: now,
      updatedDate: now,
      metadata: {},
      platformData: {},
      ...roles.dev
    }),

    createModel({
      id: 'role_6toGqs1vyG1hDNAsvyG',
      createdDate: now,
      updatedDate: now,
      metadata: {},
      platformData: {},
      ...roles.user
    }),

    createModel({
      id: 'role_Lpisxs1W0L1hDWL1W0L',
      createdDate: now,
      updatedDate: now,
      metadata: {},
      platformData: {},
      ...roles.provider
    }),

    createModel({
      id: 'role_lj840s1v7v1hCM29v7v',
      createdDate: now,
      updatedDate: now,
      metadata: {},
      platformData: {},
      ...roles.public
    }),

    createModel({
      id: 'role_cdFiOs1MTM1gdhTMMTM',
      createdDate: now,
      updatedDate: now,
      metadata: {},
      platformData: {},
      ...roles.organization
    }),

    createModel({
      id: 'role_AxWI5s1Hv61h9aa4Hv6',
      createdDate: now,
      updatedDate: now,
      name: 'Premium',
      value: 'premium',
      customRole: true,
      permissions: [
        'transaction:list:all'
      ],
      readNamespaces: ['premium'],
      editNamespaces: [],
      metadata: {
        instant: {
          // used in Stelace Dashboard to display localized custom role names
          i18n: {
            label: {
              entry: 'instant',
              field: 'config.roles.premium_label'
            }
          },
          // `isEditableFor` specifies if the role can be added or removed and to which type of users
          // array values: provide a role like `provider` or a getter for custom logic like `getters.mainOrganization`
          isEditableFor: ['getters.mainOrganization']
        }
      },
      platformData: {}
    })
  ],

  transaction: [
  ],

  user: [
  ],

  workflow: [
  ],

  webhook: [
  ]

})
