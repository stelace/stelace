const _ = require('lodash')

const { computeDate } = require('../util')
const { createModel } = require('./factory')

const roles = require('../../src/roles')

const now = new Date().toISOString()

const asset1 = {
  id: 'ast_0TYM7rs1OwP1gQRuCOwP',
  createdDate: now,
  updatedDate: now,
  name: 'Chevrolet',
  ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
  description: 'Beautiful car',
  categoryId: 'ctgy_ejQQps1I3a1gJYz2I3a',
  validated: true,
  locations: [
    { latitude: 34.05223, longitude: -118.24368 }
  ],
  active: true,
  assetTypeId: 'typ_RFpfQps1I3a1gJYz2I3a',
  quantity: 1,
  currency: 'USD',
  price: 200,
  customAttributes: {
    seatingCapacity: 4,
    options: ['tinted-glass', 'convertible']
  },
  metadata: {
    metadataOnly: 'notPlatformData',
    _private: {
      test: true
    },
    _protected: {
      test: true
    }
  },
  platformData: {
    platformDataOnly: 'notMetadata',
    _private: {
      test: true
    },
    _protected: {
      test: true
    }
  }
}

const assetType1 = {
  id: 'typ_RFpfQps1I3a1gJYz2I3a',
  createdDate: now,
  updatedDate: now,
  name: 'Renting',
  timeBased: true,
  infiniteStock: false,
  pricing: {
    ownerFeesPercent: 5,
    takerFeesPercent: 15
  },
  timing: {
    timeUnit: 'd',
    minDuration: { d: 1 },
    maxDuration: { d: 100 }
  },
  isDefault: true,
  active: true,
  metadata: {},
  platformData: {}
}

const asset2 = {
  id: 'ast_CrCRGNe1zkh1iM8t2zkh',
  createdDate: now,
  updatedDate: now,
  name: 'Mazda',
  ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
  description: 'Awesome',
  categoryId: 'ctgy_ejQQps1I3a1gJYz2I3a',
  validated: true,
  locations: [
    { latitude: 34.05223, longitude: -118.24368 }
  ],
  active: true,
  assetTypeId: 'typ_rL6IBMe1wlK1iJ9NNwlK',
  quantity: 1,
  currency: 'USD',
  price: 200,
  customAttributes: {
    seatingCapacity: 4,
    options: ['tinted-glass', 'convertible']
  },
  metadata: {
    metadataOnly: 'notPlatformData',
    _private: {
      test: true
    },
    _protected: {
      test: true
    }
  },
  platformData: {
    platformDataOnly: 'notMetadata',
    _private: {
      test: true
    },
    _protected: {
      test: true
    }
  }
}

const assetType2 = {
  id: 'typ_rL6IBMe1wlK1iJ9NNwlK',
  createdDate: now,
  updatedDate: now,
  name: 'Asset type without fees',
  timeBased: true,
  infiniteStock: false,
  pricing: {
    ownerFeesPercent: 0,
    takerFeesPercent: 0
  },
  timing: {
    timeUnit: 'd',
    minDuration: { d: 1 },
    maxDuration: { d: 100 }
  },
  isDefault: false,
  active: true,
  metadata: {},
  platformData: {}
}

module.exports = {

  apiKey: [
    createModel({
      id: 'apik_aHZQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Main',
      key: 'seck_test_wakWA41rBTUXs1Y5oNRjeY5o', // platformId 1 api key for instant-data
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'apik_aHZQps1I3b1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Main',
      key: 'seck_test_wakWA41rBTUXs1Y5pNRjeY5o', // platformId 2 for apiKey test suite
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'apik_SVBQps1I3b1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Secondary',
      key: 'seck_test_XeaEoPrnR83Bs1t0xcgSAt0w', // platformId 2 for apiKey test suite
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    // api key to use for test updates
    createModel({
      id: 'apik_A30Gye1mER1iEyNAmEQ',
      createdDate: now,
      updatedDate: now,
      name: 'Secondary',
      key: 'seck_test_x0zNOBsEAurfe1FTOue58zVr5BiBiFTN', // platformId 2 for apiKey test suite
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    // api key to use for test updates
    createModel({
      id: 'apik_tnEpBe15gs1hYQox5gr',
      createdDate: now,
      updatedDate: now,
      name: 'Secondary',
      key: 'seck_test_RS1OQ21Bosuoe1CJDh5cr9vUHDQ1hCJC', // platformId 2 for apiKey test suite
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'apik_UUcQps1I3b1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Main',
      key: 'seck_live_iuJzTKo5wumuE1imSjmcgimR', // platformId 2 for apiKey test suite
      roles: ['dev'],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'apik_UnBkaTg3TnMxXGcQ9Klh22gwkgmHMxJ',
      createdDate: now,
      updatedDate: now,
      name: 'Publishable key',
      key: 'pubk_test_HZ908JhKNeLWs16Ccl7N46Cc', // platformId 1 api key for instant-data
      roles: [],
      permissions: [],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    })
  ],

  assessment: [
    createModel({
      id: 'assm_SWtQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      state: null,
      status: 'draft',
      assetId: 'ast_2l7fQps1I3a1gJYz2I3a',
      transactionId: null,
      ownerId: 'user-external-id',
      takerId: null,
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {
          comment: null,
          statement: null,
          signedDate: null
        },
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {
          comment: null,
          statement: null,
          signedDate: null
        }
      },
      signCodes: {
        'user-external-id': 'secret',
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': 'secret2'
      },
      nbSigners: 1,
      expirationDate: null,
      signedDate: null,
      assessmentDate: now,
      metadata: {},
      platformData: {}
    })
  ],

  authMean: [
    createModel({
      id: 'amn_NzVfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      provider: '_local_',
      password: '$2a$10$u.c3b5155ZgPXR72Gi8gOu/psVF0K6.AnGJzENF/gPTj.RQst4.1S', // admin
      userId: 'usr_WHlfQps1I3a1gJYz2I3a',
      tokens: {}
    }),
    createModel({
      id: 'amn_MVRfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      provider: '_local_',
      password: '$2a$10$w63W0DNgHpijKglc0Vjh9etBNGL9086DvHsyQeg/kS3btLrq3AsBi', // user
      userId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      tokens: {}
    }),
    createModel({
      id: 'amn_75ZIFNe1IIX1hl3HNIIX',
      createdDate: now,
      updatedDate: now,
      provider: '_local_',
      password: '$2b$10$CaaEI54nPhE5aZfInIoplOSCx8YO/9gLNJ2P9y73mvQ/taXnqvX/a', // user2
      userId: 'usr_em9SToe1nI01iG4yRnHz',
      tokens: {}
    }),
    createModel({
      id: 'amn_0ppE0Be1N7y1hpsiWN7y',
      createdDate: now,
      updatedDate: now,
      provider: '_local_',
      password: '$2b$10$cVHtLqGx/55YXdHv.6QBLuhr1gPX.QCUYNlkjlnymv6T7kQU8fqf6', // user3
      userId: 'usr_bF9Mpoe1cDG1i4xyxcDG',
      tokens: {}
    })
  ],

  authToken: [
    createModel({
      id: 'atk_Q0hfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      type: 'refresh',
      value: 'refreshToken1',
      userId: 'usr_WHlfQps1I3a1gJYz2I3a',
      expirationDate: computeDate(now, '14d'),
      reference: {
        userAgent: 'node-superagent/3.8.3'
      }
    }),
    createModel({
      id: 'atk_d1QfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      type: 'refresh',
      value: 'refreshToken2',
      userId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      expirationDate: computeDate(now, '14d'),
      reference: {
        userAgent: 'node-superagent/3.8.3'
      }
    }),
    createModel({
      id: 'atk_VWFfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      type: 'resetPassword',
      value: 'resetToken1',
      userId: 'usr_WHlfQps1I3a1gJYz2I3a',
      expirationDate: computeDate(now, '1h'),
      reference: {}
    }),
    createModel({
      id: 'atk_QmtfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      type: 'resetPassword',
      value: 'expiredResetToken',
      userId: 'usr_WHlfQps1I3a1gJYz2I3a',
      expirationDate: computeDate(now, '-1h'),
      reference: {}
    })
  ],

  config: [
    createModel({
      id: 'conf_WhgRVs1C7m1gxihuC7m',
      createdDate: now,
      updatedDate: now,
      access: 'default',
      stelace: {
        instant: {
          locale: 'en'
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
        workflow: {
          contexts: {
            test: {
              TEST_ENV_VARIABLE: 'true',
              TEST_ENV_VARIABLE_2: 'Not overwritten'
            },
            other: {
              OTHER_ENV_VARIABLE: 'test'
            },
            override: {
              TEST_ENV_VARIABLE: "'Overwritten'",
              OTHER_ENV_VARIABLE: 'Overwritten "too"'
            }
          },
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
      stelace: {},
      custom: {},
      theme: {}
    })
  ],

  customAttribute: [
    createModel({
      id: 'attr_WmwQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'seatingCapacity',
      type: 'number',
      listValues: null,
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'attr_REFQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'customScore',
      type: 'number',
      listValues: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_S1VQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'licensePlate',
      type: 'text',
      listValues: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_WE9Qps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'unusedCustomAttribute',
      type: 'text',
      listValues: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_RjVQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'options',
      type: 'tags',
      listValues: ['convertible', 'tinted-glass', 'gps', 'bluetooth', 'sunroof'],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_SjVQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'freeTags',
      type: 'tags',
      listValues: null, // default: same as empty array
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_VHdQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'automaticTransmission',
      type: 'boolean',
      listValues: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_SWtQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'make',
      type: 'select',
      listValues: ['BMW', 'Honda', 'Toyota', 'Chevrolet'],
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'attr_eEFQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'customDescription',
      type: 'text',
      listValues: null,
      metadata: {},
      platformData: {}
    })
  ],

  document: [
    createModel({
      id: 'doc_WWRfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'invoice',
      label: null,
      data: {
        invoiceUrl: 'https://example.com/invoice'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'doc_2l7fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: null,
      data: {
        title: 'Awesome post',
        content: 'Some content to publish'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_4g7boIs1rRi1h0ufkrRi',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: 'main:random',
      data: {
        title: 'Title 2',
        content: 'Content 2'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_mjBLOOs12xl1gCQik2xl',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: 'main:random',
      data: {
        title: 'Title 3',
        content: 'Content 3'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_1CvqpKs1xWj1h6zgkxWj',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: 'main:random',
      data: {
        title: 'Title 4',
        content: 'Content 4'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_I7m2gRs1l5e1guYbkl5e',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: 'main:popular',
      data: {
        title: 'Title 5',
        content: 'Content 5'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_J0RnmPs19VZ1gIyWk9VZ',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_QVQfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'blogpost',
      label: 'main:popular',
      data: {
        title: 'Title 6',
        content: 'Content 6'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_dmM034s1gi81giDergi8',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Spirited Away',
        year: 2001,
        duration: 125,
        score: 8.6,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_dp7s0Hs10S61g9vQE0S6',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Spirited Away',
        year: 2001,
        duration: 125,
        score: 9.3,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_lCfxJNs10rP1g2Mww0rP',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'My Neighbor Totoro',
        year: 1988,
        duration: 86,
        score: 8.2,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_EnZop0s1kGo1gtkBTkGo',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'My Neighbor Totoro',
        year: 1988,
        duration: 86,
        score: 7.9,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_g29VxDs1DEa1gEk9KDEa',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Castle in the Sky',
        year: 1986,
        duration: 125,
        score: 8.1,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi',
        tags: {
          awesome: true,
          timesSeen: 10,
          heroes: ['Sheeta', 'Pazu']
        }
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_EG30qFs1m1q1gvVDTm1q',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Howl’s Moving Castle',
        year: 2004,
        duration: 119,
        score: 8.5,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_QT1QJcs1m0N1gnVvem0N',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Princess Mononoke',
        year: 1997,
        duration: 134,
        score: 8.4,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_lCQQm8s18rC1gIKZy8rC',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Princess Mononoke',
        year: 1997,
        duration: 134,
        score: 8.7,
        director: 'Hayao Miyazaki',
        composer: 'Joe Hisaishi'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_Ezn28as1k0M1glVvkk0M',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Rashomon',
        year: 1950,
        duration: 88,
        score: 8.3,
        director: 'Akira Kurosawa',
        composer: 'Fumio Hayasaka'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_0awjoGs1PA41gYdSJPA4',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Rashomon',
        year: 1950,
        duration: 88,
        score: 7.8,
        director: 'Akira Kurosawa',
        composer: 'Fumio Hayasaka'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_ZnRfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Seven Samurai',
        year: 1954,
        duration: 207,
        score: 8.7,
        director: 'Akira Kurosawa',
        composer: 'Fumio Hayasaka',
        tags: {
          awesome: true,
        }
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_6yey0is1EvX1gOOvJEvX',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Seven Samurai',
        year: 1954,
        duration: 207,
        score: 8.9,
        director: 'Akira Kurosawa',
        composer: 'Fumio Hayasaka'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_emdfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'Kagemusha',
        year: 1980,
        duration: 162,
        score: 8,
        director: 'Akira Kurosawa',
        composer: 'Shin’ichirō Ikebe'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_ReKS6hs1dH31gmkS5dH3',
      createdDate: now,
      updatedDate: now,
      authorId: null,
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'Kagemusha',
        year: 1980,
        duration: 162,
        score: 7.4,
        director: 'Akira Kurosawa',
        composer: 'Shin’ichirō Ikebe'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_ZU9fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: null,
      targetId: null,
      type: 'movie',
      label: 'source:imdb',
      data: {
        title: 'The Hidden Fortress',
        year: 1958,
        duration: 126,
        score: 8.1,
        director: 'Akira Kurosawa',
        composer: 'Masaru Sato'
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'doc_ZhijJus18RU1gHutP8RU',
      createdDate: now,
      updatedDate: now,
      authorId: null,
      targetId: null,
      type: 'movie',
      label: 'source:random',
      data: {
        title: 'The Hidden Fortress',
        year: 1958,
        duration: 126,
        score: 8.2,
        director: 'Akira Kurosawa',
        composer: 'Masaru Sato'
      },
      metadata: {},
      platformData: {}
    })
  ],

  event: [
    createModel({
      id: 'evt_WWRfQps1I3a1gJYz2I3a',
      createdDate: now,
      type: 'asset__created',
      objectType: 'asset',
      objectId: asset1.id,
      object: asset1,
      relatedObjectsIds: {
        assetTypeId: asset1.assetTypeId,
        categoryId: asset1.categoryId,
        ownerId: asset1.ownerId
      },
      apiVersion: '2019-05-20',
      parentId: null,
      emitter: 'core',
      emitterId: null,
      metadata: {}
    }),

    createModel({
      id: 'evt_K00gGqs1BeT1h6gywBeT',
      createdDate: now,
      type: 'custom_event',
      objectType: 'asset',
      objectId: 'ast_lCfxJNs10rP1g2Mww0rP',
      object: asset1,
      relatedObjectsIds: {},
      apiVersion: '2019-05-20',
      parentId: null,
      emitter: 'custom',
      emitterId: 'random',
      metadata: {
        nested: {
          object: true,
          string: 'true'
        }
      }
    }),

    createModel({
      id: 'evt_J00gGqs1BeT1h6gywBeT',
      createdDate: computeDate(now, '30 years'),
      type: 'future_event',
      objectType: 'asset',
      objectId: 'ast_lCfxJNs10rP1g2Mww0rP',
      object: asset1,
      relatedObjectsIds: {},
      apiVersion: '2019-05-20',
      parentId: null,
      emitter: 'custom',
      emitterId: 'Delorean',
      metadata: {
        someTags: ['Doc', 'Brown'],
        name: 'DMC-12',
        nested: {
          object: true,
          string: 'true'
        }
      }
    })
  ],

  entry: [
    createModel({
      id: 'ent_4KquHhs1WeG1hK71uWeG',
      createdDate: now,
      updatedDate: now,
      collection: 'website',
      locale: 'en-US',
      name: 'home',
      fields: {
        title: 'Welcome to Stelace',
        description: '',
        nestedContent: {
          random1: {
            random2: 'hello'
          },
          random3: 'bye'
        }
      },
      metadata: {}
    }),
    createModel({
      id: 'ent_f5HQIUs1Wwq1hKPjJWwq',
      createdDate: now,
      updatedDate: now,
      collection: 'website',
      locale: 'en-US',
      name: 'aboutUs',
      fields: {
        title: 'About us',
        description: 'Our team is wonderful.'
      },
      metadata: {}
    }),
    createModel({
      id: 'ent_9WLLTGs1wnR1hkGQwwnR',
      createdDate: now,
      updatedDate: now,
      collection: 'email',
      locale: 'en-US',
      name: 'signup',
      fields: {
        subject: 'Hi, welcome to Stelace',
        content: 'You just signed up. Please check your email.'
      },
      metadata: {}
    })
  ],

  asset: [
    createModel(asset1),

    createModel({
      id: 'ast_0KAm3He1ze11iSSR4ze0',
      createdDate: now,
      updatedDate: now,
      name: 'Ferrari',
      ownerId: 'user-external-id',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: true,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: true,
      assetTypeId: 'typ_Vr001Be1JBF1hlzxYJBE',
      quantity: 5,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_2l7fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Honda',
      ownerId: 'user-external-id',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: false,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: false,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 1,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_dmM034s1gi81giDergi8',
      createdDate: now,
      updatedDate: now,
      name: 'Honda',
      ownerId: 'user-external-id',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: false,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: false,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 1,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_lCfxJNs10rP1g2Mww0rP',
      createdDate: now,
      updatedDate: now,
      name: 'Honda',
      ownerId: 'usr_WHlfQps1I3a1gJYz2I3a',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: false,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: false,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 1,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_g29VxDs1DEa1gEk9KDEa',
      createdDate: now,
      updatedDate: now,
      name: 'Nissan',
      ownerId: '6f74682c-1cb9-4fcf-b484-7b73457452da',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: true,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: true,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 0,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_QT1QJcs1m0N1gnVvem0N',
      createdDate: now,
      updatedDate: now,
      name: 'Mazda',
      ownerId: 'user-external-id',
      description: null,
      categoryId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      validated: true,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: true,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 1,
      currency: 'USD',
      price: 200,
      customAttributes: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ast_Ezn28as1k0M1glVvkk0M',
      createdDate: now,
      updatedDate: now,
      name: 'Renault',
      ownerId: '6f74682c-1cb9-4fcf-b484-7b73457452da',
      description: null,
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      validated: true,
      locations: [
        { latitude: 32.05223, longitude: -120.24368 }
      ],
      active: true,
      assetTypeId: 'typ_T3ZfQps1I3a1gJYz2I3a',
      quantity: 1,
      currency: 'USD',
      price: 50,
      customAttributes: {},
      metadata: {},
      platformData: {}
    })
  ],

  availability: [
    createModel({
      id: 'avl_ZnRfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate: computeDate(now, '2 days'),
      endDate: computeDate(now, '4 days'),
      quantity: '-1',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'avl_emdfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: 'ast_g29VxDs1DEa1gEk9KDEa',
      startDate: computeDate(now, '2 days'),
      endDate: computeDate(now, '4 days'),
      quantity: '+1',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'avl_2Rm9Ane1tQD1iMCaltQC',
      createdDate: now,
      updatedDate: now,
      assetId: 'ast_lCfxJNs10rP1g2Mww0rP',
      startDate: computeDate(now, '1 days'),
      endDate: computeDate(now, '3 days'),
      quantity: '+1',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'avl_AGW3Dge1x1M1iPnjox1L',
      createdDate: now,
      updatedDate: now,
      assetId: 'ast_lCfxJNs10rP1g2Mww0rP',
      startDate: computeDate(now, '5 days'),
      endDate: computeDate(now, '7 days'),
      quantity: '0',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'avl_m7Gq0Fe13L71hW6Cn3L6',
      createdDate: now,
      updatedDate: now,
      assetId: 'ast_lCfxJNs10rP1g2Mww0rP',
      startDate: computeDate(now, '10 days'),
      endDate: computeDate(now, '15 days'),
      quantity: '+1',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: {},
      platformData: {}
    })
  ],

  category: [
    createModel({
      id: 'ctgy_ejQQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Sport',
      parentId: null,
      metadata: {
        metadataOnly: 'notPlatformData'
      },
      platformData: {
        platformDataOnly: 'notMetadata'
      }
    }),

    createModel({
      id: 'ctgy_N1FQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Compact car',
      parentId: null,
      metadata: {
        metadataOnly: true
      },
      platformData: {}
    }),

    createModel({
      id: 'ctgy_WW5Qps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Unused category',
      parentId: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ctgy_UVdQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Unused category child',
      parentId: 'ctgy_WW5Qps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    })
  ],

  assetType: [
    createModel(assetType1),

    createModel({
      id: 'typ_MGsfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Selling',
      timeBased: false,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 0,
        takerFeesPercent: 20
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'typ_Vr001Be1JBF1hlzxYJBE',
      createdDate: now,
      updatedDate: now,
      name: 'Asset type without limits',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 15
      },
      timing: {
        timeUnit: 'd',
        minDuration: null,
        maxDuration: null
      },
      active: true,
      metadata: {},
      platformData: {}
    }),

    // asset type with no assets (for tests)
    createModel({
      id: 'typ_Z0xfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Empty',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 0,
        takerFeesPercent: 0
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {
        metadataOnly: 'notPlatformData'
      },
      platformData: {
        platformDataOnly: 'notMetadata'
      }
    }),

    createModel({
      id: 'typ_T3ZfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Custom renting',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 15
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'typ_ZU9fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Renting multiple',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 15
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      unavailableWhen: ['confirmed', 'validated', 'completed'],
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    }),

    // asset type with all possible custom attributes
    createModel({
      id: 'typ_MnkfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Test asset type',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 15
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    }),

    // asset type with all assessment hooks disabled
    createModel({
      id: 'typ_MWNfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'No assessment hooks',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 15
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'typ_rL6IBMe1wlK1iJ9NNwlK',
      createdDate: now,
      updatedDate: now,
      name: 'No fees',
      timeBased: true,
      infiniteStock: false,
      pricing: {
        ownerFeesPercent: 0,
        takerFeesPercent: 0
      },
      timing: {
        timeUnit: 'd',
        minDuration: { d: 1 },
        maxDuration: { d: 100 }
      },
      isDefault: false,
      active: true,
      metadata: {},
      platformData: {}
    })
  ],

  message: [
    createModel({
      id: 'msg_Vuz9KRs10NK1gAHrp0NK',
      createdDate: now,
      updatedDate: now,
      topicId: 'trn_a3BfQps1I3a1gJYz2I3a',
      conversationId: 'conv_4FqUqs1zln1h9gZhzln',
      content: 'Hello',
      attachments: [],
      read: false,
      senderId: 'user-external-id',
      receiverId: 'usr_WHlfQps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'msg_Wg01MFs1Crb1gMm8pCrb',
      createdDate: now,
      updatedDate: now,
      topicId: 'ast_lCfxJNs10rP1g2Mww0rP',
      conversationId: 'conv_cbj4ks1qxT1h0sFhqxT',
      content: 'Bye',
      attachments: [],
      read: false,
      senderId: 'usr_QVQfQps1I3a1gJYz2I3a',
      receiverId: 'usr_WHlfQps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    })
  ],

  order: [
    createModel({
      id: 'ord_eP0hwes1jwf1gxMLCjwf',
      createdDate: now,
      updatedDate: now,
      lines: [
        {
          id: 'ordl_KdA9vs1st51h6q3wst5',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_eP0hwes1jwf1gxMLCjwf',
          transactionId: 'trn_a3BfQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
          senderAmount: 1177,
          receiverId: null,
          receiverAmount: null,
          platformAmount: 177,
          currency: 'USD',
          metadata: {},
          platformData: {}
        },
        {
          id: 'ordl_BLusYs1mlp1h0inwmlp',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_eP0hwes1jwf1gxMLCjwf',
          transactionId: 'trn_a3BfQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: null,
          senderAmount: null,
          receiverId: 'fd7b4ea9-a899-4dba-b9b0-ef8537a70efe',
          receiverAmount: 1000,
          platformAmount: 50,
          currency: 'USD',
          metadata: {},
          platformData: {}
        }
      ],
      moves: [

      ],
      amountDue: 1177,
      amountPaid: 0,
      amountRemaining: 1177,
      currency: 'USD',
      senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      paymentAttempted: false,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ord_ax0hwes1jwf1gxMLCjwf',
      createdDate: now,
      updatedDate: now,
      lines: [],
      moves: [],
      amountDue: null,
      amountPaid: null,
      amountRemaining: null,
      currency: 'EUR',
      senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      paymentAttempted: false,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ord_ax1hwes1jwf1gxMLCjwf',
      createdDate: now,
      updatedDate: now,
      lines: [
        {
          id: 'ordl_KdA9vs1st51h6q3wst6',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_ax1hwes1jwf1gxMLCjwf',
          transactionId: 'trn_a3BfQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
          senderAmount: 216,
          receiverId: null,
          receiverAmount: null,
          platformAmount: 36,
          currency: 'EUR',
          metadata: {},
          platformData: {}
        }
      ],
      moves: [],
      amountDue: 216,
      amountPaid: 0,
      amountRemaining: 216,
      currency: 'EUR',
      senderId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      paymentAttempted: false,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'ord_om2DV3s1R5E1geUuCR5E',
      createdDate: now,
      updatedDate: now,
      lines: [
        {
          id: 'ordl_BPlQws16p51gKm3w6p5',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_om2DV3s1R5E1geUuCR5E',
          transactionId: 'trn_Wm1fQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: 'usr_Y0tfQps1I3a1gJYz2I3a',
          senderAmount: 200,
          receiverId: null,
          receiverAmount: null,
          platformAmount: 0,
          currency: 'USD',
          metadata: {},
          platformData: {}
        },
        {
          id: 'ordl_C0jh2s1pO81h3L6wpO8',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_om2DV3s1R5E1geUuCR5E',
          transactionId: 'trn_Wm1fQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: null,
          senderAmount: null,
          receiverId: 'usr_QVQfQps1I3a1gJYz2I3a',
          receiverAmount: 200,
          platformAmount: 0,
          currency: 'USD',
          metadata: {},
          platformData: {}
        }
      ],
      moves: [
        {
          id: 'ordm_yJLKVs101Q1gDyYe01Q',
          createdDate: now,
          updatedDate: now,
          orderId: 'ord_om2DV3s1R5E1geUuCR5E',
          transactionId: 'trn_Wm1fQps1I3a1gJYz2I3a',
          reversal: false,
          senderId: 'usr_Y0tfQps1I3a1gJYz2I3a',
          senderAmount: 200,
          receiverId: null,
          receiverAmount: null,
          platformAmount: 0,
          currency: 'USD',
          real: {
            senderAmount: 173,
            platformAmount: 0,
            currency: 'EUR'
          },
          metadata: {},
          platformData: {}
        }
      ],
      amountDue: 200,
      amountPaid: 200,
      amountRemaining: 0,
      currency: 'USD',
      senderId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      paymentAttempted: true,
      metadata: {},
      platformData: {}
    })
  ],

  role: [
    createModel({
      id: 'role_C5ZIBs105v1gHK1i05v',
      createdDate: now,
      updatedDate: now,
      ...roles.dev
    }),

    createModel({
      id: 'role_6toGqs1vyG1hDNAsvyG',
      createdDate: now,
      updatedDate: now,
      ...roles.user
    }),

    createModel({
      id: 'role_Lpisxs1W0L1hDWL1W0L',
      createdDate: now,
      updatedDate: now,
      ...roles.provider
    }),

    createModel({
      id: 'role_lj840s1v7v1hCM29v7v',
      createdDate: now,
      updatedDate: now,
      ..._.mapValues( // remove this default public permission for testing purpose
        roles.public,
        (v, k) => k === 'permissions' ? _.difference(v, ['asset:list:all']) : v
      )
    }),

    createModel({
      id: 'role_cdFiOs1MTM1gdhTMMTM',
      createdDate: now,
      updatedDate: now,
      ...roles.organization
    }),

    createModel({
      id: 'role_2tem1s1CSC1gTgJYCSC',
      createdDate: now,
      updatedDate: now,
      name: 'Custom',
      value: 'custom',
      customRole: true,
      permissions: [
        'asset:read:all',
        'asset:create:all',
        'asset:edit:all',
        'asset:remove:all'
      ],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    }),

    // unused role (to remove)
    createModel({
      id: 'role_HfYEVs1mTi1h3hplmTi',
      createdDate: now,
      updatedDate: now,
      name: 'Unused role',
      value: 'unused',
      customRole: true,
      permissions: [
        'asset:read:all',
        'asset:create:all',
        'asset:edit:all',
        'asset:remove:all'
      ],
      readNamespaces: [],
      editNamespaces: [],
      metadata: {},
      platformData: {}
    })
  ],

  task: [
    createModel({
      id: 'task_4bJEZe1bA91i7IQYbA8',
      createdDate: now,
      updatedDate: now,
      executionDate: computeDate(now, '1 day'),
      recurringPattern: null,
      recurringTimezone: null,
      eventType: 'asset_timeout',
      eventMetadata: {},
      eventObjectId: 'ast_2l7fQps1I3a1gJYz2I3a',
      active: true,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'task_cgIXze1nD71iJLPsnD6',
      createdDate: now,
      updatedDate: now,
      executionDate: null,
      recurringPattern: '0 * * * 2,4-6',
      recurringTimezone: 'Europe/London',
      eventType: 'asset_checked',
      eventMetadata: {},
      eventObjectId: 'ast_lCfxJNs10rP1g2Mww0rP',
      active: true,
      metadata: {},
      platformData: {}
    })
  ],

  transaction: [
    // transaction neither paid nor accepted
    createModel({
      id: 'trn_a3BfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'fd7b4ea9-a899-4dba-b9b0-ef8537a70efe',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '5 days'),
      endDate: computeDate(now, '10 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction paid
    createModel({
      id: 'trn_RjhfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'pending-acceptance',
      statusHistory: [
        { status: 'pending-acceptance', date: now },
        { status: 'draft', date: now }
      ],
      ownerId: 'fd7b4ea9-a899-4dba-b9b0-ef8537a70efe',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '25 days'),
      endDate: computeDate(now, '30 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction accepted
    createModel({
      id: 'trn_ZVZfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'accepted',
      statusHistory: [
        { status: 'accepted', date: now },
        { status: 'draft', date: now }
      ],
      ownerId: 'fd7b4ea9-a899-4dba-b9b0-ef8537a70efe',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '7 days'),
      endDate: computeDate(now, '12 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction to cancel
    createModel({
      id: 'trn_UG1fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'fd7b4ea9-a899-4dba-b9b0-ef8537a70efe',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '8 days'),
      endDate: computeDate(now, '13 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction paid and accepted
    createModel({
      id: 'trn_Wm1fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'validated',
      statusHistory: [
        { status: 'validated', date: now },
        { status: 'pending-acceptance', date: now },
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      quantity: 1,
      startDate: computeDate(now, '1 days'),
      endDate: computeDate(now, '2 days'),
      duration: { d: 1 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 100,
      ownerAmount: 95,
      takerAmount: 118,
      platformAmount: 23,
      ownerFees: 5,
      takerFees: 18,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction paid and accepted
    createModel({
      id: 'trn_VHgfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'validated',
      statusHistory: [
        { status: 'validated', date: now },
        { status: 'pending-acceptance', date: now },
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      quantity: 1,
      startDate: computeDate(now, '5 days'),
      endDate: computeDate(now, '7 days'),
      duration: { d: 2 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 200,
      ownerAmount: 190,
      takerAmount: 236,
      platformAmount: 46,
      ownerFees: 10,
      takerFees: 36,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // transaction in Euro
    createModel({
      id: 'trn_ndKcBks1TV21ggvMqTV2',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      quantity: 1,
      startDate: computeDate(now, '5 days'),
      endDate: computeDate(now, '7 days'),
      duration: { d: 2 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 200,
      ownerAmount: 190,
      takerAmount: 236,
      platformAmount: 46,
      ownerFees: 10,
      takerFees: 36,
      currency: 'EUR',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    // empty transaction with no information
    createModel({
      id: 'trn_UEZfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      assetId: null,
      assetSnapshot: {}, // default is empty object
      assetTypeId: null,
      assetType: null,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: null,
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: null,
      endDate: null,
      duration: null,
      timeUnit: null,
      unitPrice: null,
      value: null,
      ownerAmount: null,
      takerAmount: null,
      platformAmount: null,
      ownerFees: null,
      takerFees: null,
      currency: null,
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'trn_ph6nyKe15hU1hU0Wz5hU',
      createdDate: now,
      updatedDate: now,
      assetId: asset1.id,
      assetSnapshot: asset1,
      assetTypeId: assetType1.id,
      assetType: assetType1,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'org_xC3ZlGs1Jo71gb2G0Jo7',
      quantity: 1,
      startDate: computeDate(now, '25 days'),
      endDate: computeDate(now, '30 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'bgk_svEC9Te1UPo1hqo8MUPo',
      createdDate: now,
      updatedDate: now,
      assetId: asset2.id,
      assetSnapshot: asset2,
      assetTypeId: assetType2.id,
      assetType: assetType2,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '5 days'),
      endDate: computeDate(now, '10 days'),
      duration: { d: 5 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 500,
      ownerAmount: 475,
      takerAmount: 589,
      platformAmount: 114,
      ownerFees: 25,
      takerFees: 89,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'bgk_dRuSeXe15jH1hS7ao5jH',
      createdDate: now,
      updatedDate: now,
      assetId: asset2.id,
      assetSnapshot: asset2,
      assetTypeId: assetType2.id,
      assetType: assetType2,
      status: 'draft',
      statusHistory: [
        { status: 'draft', date: now }
      ],
      ownerId: 'usr_QVQfQps1I3a1gJYz2I3a',
      takerId: 'ff4bf0dd-b1d9-49c9-8c61-3e3baa04181c',
      quantity: 1,
      startDate: computeDate(now, '15 days'),
      endDate: computeDate(now, '23 days'),
      duration: { d: 8 },
      timeUnit: 'd',
      unitPrice: 100,
      value: 800,
      ownerAmount: 800,
      takerAmount: 800,
      platformAmount: 0,
      ownerFees: 0,
      takerFees: 0,
      currency: 'USD',
      completedDate: null,
      cancelledDate: null,
      cancellationReason: null,
      metadata: {},
      platformData: {}
    }),
  ],

  user: [
    createModel({
      id: 'usr_WHlfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      username: 'admin',
      displayName: 'Admin',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['dev', 'user', 'provider'],
      organizations: {
        org_xC3ZlGs1Jo71gb2G0Jo7: {
          roles: ['user', 'provider']
        }
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'usr_Y0tfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      username: 'user',
      displayName: 'User',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider', 'custom'],
      organizations: {
        org_yiBSnhs1zaP1hh8rczaP: {
          roles: ['user', 'provider']
        },
        org_4YsuuQe1X0h1hznSoX0g: {
          roles: ['user', 'provider']
        },
        org_VPq2HKe1uSC1iNF5JuSB: {
          roles: ['user', 'provider']
        }
      },
      metadata: {},
      platformData: {}
    }),
    createModel({
      id: 'usr_AAtfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      username: 'uniqueOrgMixUser',
      displayName: 'User with unique combination of orgs',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {
        org_xC3ZlGs1Jo71gb2G0Jo7: {
          roles: ['user', 'provider']
        },
        org_yiBSnhs1zaP1hh8rczaP: {
          roles: ['user', 'provider']
        },
        org_VPq2HKe1uSC1iNF5JuSB: {
          roles: ['user', 'provider']
        }
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'usr_em9SToe1nI01iG4yRnHz',
      createdDate: now,
      updatedDate: now,
      username: 'user2',
      displayName: 'User 2',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {
        org_yiBSnhs1zaP1hh8rczaP: {
          roles: ['user', 'provider']
        }
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'usr_bF9Mpoe1cDG1i4xyxcDG',
      createdDate: now,
      updatedDate: now,
      username: 'user3',
      displayName: 'User 3',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'usr_J2sofue1xi01iQSjPxi0',
      createdDate: now,
      updatedDate: now,
      username: 'user4',
      displayName: 'User 4',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    // unused user
    createModel({
      id: 'usr_T2VfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      username: 'unused',
      displayName: 'Unused',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    // user to remove
    createModel({
      id: 'usr_RBWOkBe17RG1haELt7RF',
      createdDate: now,
      updatedDate: now,
      username: 'toRemoved',
      displayName: 'To removed',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['user', 'provider'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'usr_QVQfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      username: 'anotherUser',
      displayName: 'Another user',
      firstname: 'Foo',
      lastname: 'Bar',
      email: 'another@example.com',
      roles: ['user', 'provider'],
      organizations: {
        org_toMLWis1EpB1gwNcfEpB: {
          roles: ['user', 'provider']
        }
      },
      metadata: {
        _private: {
          test: true
        },
        _protected: {
          test: true
        }
      },
      platformData: {
        _private: {
          test: true
        },
        _protected: {
          test: true
        }
      }
    }),

    createModel({
      id: 'usr_IoyayAs1sBJ1h8BgesBJ',
      createdDate: now,
      updatedDate: now,
      username: 'admin@example.com',
      displayName: 'Admin example',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['dev'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'org_xC3ZlGs1Jo71gb2G0Jo7',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization example',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {},
      orgOwnerId: 'usr_WHlfQps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'org_toMLWis1EpB1gwNcfEpB',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization Parent',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {},
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'org_b2uQEos1lDa1hSm2XlDa',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization Child 1',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {
        org_toMLWis1EpB1gwNcfEpB: {}
      },
      metadata: {},
      platformData: {}
    }),

    createModel({
      id: 'org_yiBSnhs1zaP1hh8rczaP',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization Child 2',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {
        org_toMLWis1EpB1gwNcfEpB: {}
      },
      metadata: {},
      platformData: {}
    }),

    // organization to remove
    createModel({
      id: 'org_VPq2HKe1uSC1iNF5JuSB',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization Child 3',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {
        org_toMLWis1EpB1gwNcfEpB: {}
      },
      orgOwnerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    }),

    // organization to remove
    createModel({
      id: 'org_4YsuuQe1X0h1hznSoX0g',
      createdDate: now,
      updatedDate: now,
      username: null,
      displayName: 'Organization Child 4',
      firstname: null,
      lastname: null,
      email: null,
      roles: ['organization', 'user', 'provider'],
      organizations: {
        org_toMLWis1EpB1gwNcfEpB: {}
      },
      orgOwnerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      metadata: {},
      platformData: {}
    })
  ],

  workflow: [
    createModel({
      id: 'wfw_SEIfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Test workflow',
      event: '',
      run: null,
      active: false,
      stats: {
        nbTimesRun: 0
      },
      metadata: {},
      platformData: {
        test: true,
        _custom: {
          test: true
        }
      }
    })
  ],

  webhook: [
    createModel({
      id: 'whk_SEIfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      name: 'Test webhook',
      targetUrl: 'https://example.com',
      event: 'asset__created',
      active: false,
      metadata: {},
      platformData: {
        test: true,
        _custom: {
          test: true
        }
      }
    })
  ]

}
