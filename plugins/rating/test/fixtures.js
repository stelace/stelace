const { testTools: { factory } } = require('../../serverTooling')

const { createModel } = factory

const now = new Date().toISOString()

module.exports = {

  document: [
    createModel({
      id: 'rtg_2l7fQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      type: 'rating',
      label: 'main',
      data: {
        score: 80,
        comment: 'Wonderful',
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
        transactionId: 'trn_a3BfQps1I3a1gJYz2I3a'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'rtg_emdfQps1I3a1gJYz2I3a',
      createdDate: now,
      updatedDate: now,
      authorId: 'user-external-id',
      targetId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      type: 'rating',
      label: 'main',
      data: {
        score: 70,
        comment: 'Good',
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'rtg_eusfwHs1m001gvOa5m00',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: 'usr_T2VfQps1I3a1gJYz2I3a',
      type: 'rating',
      label: 'main:friendliness',
      data: {
        score: 100,
        comment: 'Bad',
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
        transactionId: 'trn_UG1fQps1I3a1gJYz2I3a'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'rtg_Hu470ws1Jzt1gTOT5Jzt',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: 'usr_T2VfQps1I3a1gJYz2I3a',
      type: 'rating',
      label: 'main:precision',
      data: {
        score: 0,
        assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
        transactionId: 'trn_UG1fQps1I3a1gJYz2I3a'
      },
      metadata: { existingData: [true] },
      platformData: {}
    }),

    createModel({
      id: 'rtg_IO2L2Ts1S0Q1gbP05S0Q',
      createdDate: now,
      updatedDate: now,
      authorId: 'usr_WHlfQps1I3a1gJYz2I3a',
      targetId: 'usr_T2VfQps1I3a1gJYz2I3a',
      type: 'rating',
      label: 'main:pricing',
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
