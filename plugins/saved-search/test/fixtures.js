const { testTools: { factory } } = require('../../serverTooling')

const { createModel } = factory

const now = new Date().toISOString()

module.exports = {

  document: [
    createModel({
      id: 'sch_2l7fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        name: 'My saved search',
        search: {
          assetTypeId: 'typ_RFpfQps1I3a1gJYz2I3a'
        },
        active: true
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'sch_emdfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        name: 'My saved search',
        search: {
          query: 'Honda'
        },
        active: true
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'sch_eusfwHs1m001gvOa5m00',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        name: 'My saved search',
        search: {
          customAttributes: {
            seatingCapacity: 4,
            options: ['tinted-glass', 'convertible']
          }
        },
        active: false
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'sch_Hu470ws1Jzt1gTOT5Jzt',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        score: 0,
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
        transactionId: 'trn_UG1fQps1I3a1gJYz2I3a'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'sch_IO2L2Ts1S0Q1gbP05S0Q',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        score: 60,
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
        transactionId: 'trn_UG1fQps1I3a1gJYz2I3a'
      },
      metadata: { existingData: [true] },
      platformData: {}
    })
  ]

}
