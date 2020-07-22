require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const {
  getObjectEvent,
  testEventMetadata,
  checkOffsetPaginatedListObject,
  checkCursorPaginatedListObject,
} = require('../../util')

test.before(async t => {
  await before({ name: 'assessment' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

const createAssessment = async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:create:all'] })

  const { body: assessment } = await request(t.context.serverUrl)
    .post('/assessments')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_2l7fQps1I3a1gJYz2I3a',
      ownerId: 'user-external-id',
      takerId: null,
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {},
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {}
      },
      signCodes: {
        'user-external-id': 'secret',
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': 'secret2'
      },
      nbSigners: 1
    })

  return assessment
}

test('list assessments', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:list:all'] })

  const { body: obj } = await request(t.context.serverUrl)
    .get('/assessments?assetId=ast_2l7fQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  checkCursorPaginatedListObject(t, obj)
})

test('finds an assessment', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:read:all'] })

  const result = await request(t.context.serverUrl)
    .get('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
})

test('shows the sign code only for the current signer if the user has normal rights', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:read:all'] })

  const result = await request(t.context.serverUrl)
    .get('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.deepEqual(assessment.signCodes, {})

  const result2 = await request(t.context.serverUrl)
    .get('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
    }))
    .expect(200)

  const assessment2 = result2.body

  t.is(assessment2.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.deepEqual(typeof assessment2.signCodes['7e779b5f-876c-4cbc-934c-2fdbcacef4d6'], 'string')

  const result3 = await request(t.context.serverUrl)
    .get('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': 'user-external-id'
    }))
    .expect(200)

  const assessment3 = result3.body

  t.is(assessment3.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.is(typeof assessment3.signCodes['7e779b5f-876c-4cbc-934c-2fdbcacef4d6'], 'undefined')
  t.is(typeof assessment3.signCodes['user-external-id'], 'string')
})

test('shows all sign codes if there is the config right', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:read:all', 'assessment:config:all'] })

  const result = await request(t.context.serverUrl)
    .get('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.is(typeof assessment.signCodes['7e779b5f-876c-4cbc-934c-2fdbcacef4d6'], 'string')
  t.is(typeof assessment.signCodes['user-external-id'], 'string')
})

test('creates an assessment', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:create:all'] })

  const result = await request(t.context.serverUrl)
    .post('/assessments')
    .set(authorizationHeaders)
    .send({
      statement: null,
      status: null,
      assetId: 'ast_2l7fQps1I3a1gJYz2I3a',
      transactionId: null,
      ownerId: 'user-external-id',
      takerId: null,
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {},
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {}
      },
      nbSigners: 1,
      expirationDate: null,
      metadata: { dummy: true }
    })
    .expect(200)

  const assessment = result.body

  t.is(assessment.assetId, 'ast_2l7fQps1I3a1gJYz2I3a')
  t.is(assessment.signers['user-external-id'].comment, null)
  t.is(assessment.signers['user-external-id'].statement, null)
  t.is(assessment.signCodes['user-external-id'], null)
  t.is(assessment.metadata.dummy, true)
})

test('updates an assessment with configuration parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'assessment:edit:all',
      'assessment:config:all'
    ]
  })

  const result = await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {
          comment: 'Nothing to report'
        }
      },
      nbSigners: 2
    })
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.is(assessment.signers['user-external-id'].comment, 'Nothing to report')
})

test('updates an assessment with configuration parameters using simple config permission', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:edit:all', 'assessment:config'],
    userId: 'user-external-id'
  })

  const result = await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {
          comment: 'Nothing to report'
        }
      }
    })
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.is(assessment.signers['user-external-id'].comment, 'Nothing to report')
})

test('fails to update an assessment with configuration parameters using simple config permission if the user is not specified in signers list', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:edit:all', 'assessment:config']
  })

  await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      emitterId: 'user-external-id',
      receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
      signers: {
        'user-external-id': {
          comment: 'Nothing to report'
        }
      }
    })
    .expect(403)

  t.pass()
})

test('adds a signer to an assessment will generate a new sign code if not specified', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:edit:all', 'assessment:config:all']
  })

  const result = await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {}
      }
    })
    .expect(200)

  const assessment = result.body

  t.is(assessment.id, 'assm_SWtQps1I3a1gJYz2I3a')
  t.is(typeof assessment.signCodes['user-external-id'], 'string')
})

test('adds a signer to an assessment and generates a sign code for her', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:edit:all', 'assessment:config:all']
  })

  const assessment = await createAssessment(t)

  const { body: assessment1 } = await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {}
      },
      signCodes: {
        'user-external-id': null
      }
    })
    .expect(200)

  t.is(assessment1.id, assessment.id)
  t.is(assessment1.signCodes['user-external-id'], null)

  const { body: assessment2 } = await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        '3a6b266e-ed58-483c-873f-aee68c3b11d2': {}
      },
      signCodes: {
        '3a6b266e-ed58-483c-873f-aee68c3b11d2': 'secret'
      }
    })
    .expect(200)

  t.is(assessment2.id, assessment.id)
  t.is(assessment2.signCodes['3a6b266e-ed58-483c-873f-aee68c3b11d2'], 'secret')
})

test('signs an assessment', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  const { body: updatedAssessment } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(updatedAssessment.id, assessment.id)
  t.truthy(typeof updatedAssessment.signCodes['user-external-id'])

  // the assessment is signed because there is only one signer
  t.truthy(updatedAssessment.signedDate)

  // the assessment is signed, so status is set to "accept" because there were no problem
  t.is(updatedAssessment.status, 'accept')

  // the assessment is signed, so statement is set to "pass" because there were no problem
  t.is(updatedAssessment.statement, 'pass')

  // TODO: find an elegant way to solve this issue (same for other tests below)
  // add a delay because the assessment signature can lead to a series of events (webhooks here)
  // that generates database queries during its reset (after each test)
  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('signs an assessment with a challenge statement', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all', 'assessment:edit:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {
          statement: 'challenge'
        }
      }
    })

  const { body: updatedAssessment } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(updatedAssessment.id, assessment.id)
  t.truthy(typeof updatedAssessment.signCodes['user-external-id'])
  t.is(updatedAssessment.status, 'draft')
  t.is(updatedAssessment.statement, 'challenge')

  // the assessment is signed because there is only one signer
  t.truthy(updatedAssessment.signedDate)

  // add a delay because the assessment signature can lead to a series of events (webhooks here)
  // that generates database queries during its reset (after each test)
  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('signs an assessment partially will propagate the user statement to the global assessment statement', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all', 'assessment:edit:all', 'assessment:config:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  // the first signer sets the statement to "pass"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {
          statement: 'pass'
        }
      },
      nbSigners: 4
    })
    .expect(200)

  const { body: assessment1 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(assessment1.id, assessment.id)
  t.truthy(typeof assessment1.signCodes['user-external-id'])
  t.is(assessment1.status, 'draft')
  t.is(assessment1.statement, 'pass')

  // the second signer sets the statement to "challenge"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {
          statement: 'challenge'
        }
      }
    })
    .expect(200)

  const { body: assessment2 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
    }))
    .send({
      signCode: 'secret2'
    })
    .expect(200)

  t.is(assessment2.id, assessment.id)
  t.truthy(typeof assessment2.signCodes['user-external-id'])
  t.is(assessment2.status, 'draft')
  t.is(assessment2.statement, 'challenge')

  // add a delay because the assessment signature can lead to a series of events (webhooks here)
  // that generates database queries during its reset (after each test)
  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('updating a partial signed challenge assessment to pass will reset the statement', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all', 'assessment:edit:all', 'assessment:config:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  // the first signer sets the statement to "challenge"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {
          statement: 'challenge'
        }
      },
      nbSigners: 4
    })
    .expect(200)

  const { body: assessment1 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(assessment1.id, assessment.id)
  t.truthy(typeof assessment1.signCodes['user-external-id'])
  t.is(assessment1.status, 'draft')
  t.is(assessment1.statement, 'challenge')

  // the second signer sets the statement to "challenge"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {
          statement: 'pass'
        }
      }
    })
    .expect(200)

  const { body: assessment2 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
    }))
    .send({
      signCode: 'secret2'
    })
    .expect(200)

  t.is(assessment2.id, assessment.id)
  t.truthy(typeof assessment2.signCodes['user-external-id'])
  t.is(assessment2.status, 'draft')
  t.is(assessment2.statement, 'challenge')

  // add a delay because the assessment signature can lead to a series of events (webhooks here)
  // that generates database queries during its reset (after each test)
  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('updating a partial signed to pass after a challenge statement will get a global challenge statement', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all', 'assessment:edit:all', 'assessment:config:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  // the first signer sets the statement to "challenge"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        'user-external-id': {
          statement: 'challenge'
        }
      },
      nbSigners: 4
    })
    .expect(200)

  const { body: assessment1 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(assessment1.id, assessment.id)
  t.truthy(typeof assessment1.signCodes['user-external-id'])
  t.is(assessment1.status, 'draft')
  t.is(assessment1.statement, 'challenge')

  // reset the statement to "pass"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      statement: 'pass'
    })
    .expect(200)

  // the second signer sets the statement to "pass"
  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      signers: {
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {
          statement: 'pass'
        }
      }
    })
    .expect(200)

  const { body: assessment2 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
    }))
    .send({
      signCode: 'secret2'
    })
    .expect(200)

  t.is(assessment2.id, assessment.id)
  t.truthy(typeof assessment2.signCodes['user-external-id'])
  t.is(assessment2.status, 'draft')
  t.is(assessment2.statement, 'pass')

  // add a delay because the assessment signature can lead to a series of events (webhooks here)
  // that generates database queries during its reset (after each test)
  await new Promise(resolve => setTimeout(resolve, 1000))
})

test('signs an assessment as many times as it should to be completely signed', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['assessment:sign:all', 'assessment:edit:all', 'assessment:config:all'],
    userId: 'user-external-id'
  })

  const assessment = await createAssessment(t)

  await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send({
      nbSigners: 2
    })
    .expect(200)

  const { body: assessment1 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(authorizationHeaders)
    .send({
      signCode: 'secret'
    })
    .expect(200)

  t.is(assessment1.id, assessment.id)
  t.truthy(assessment1.signers['user-external-id'].signedDate)
  t.falsy(assessment1.signedDate)

  const { body: assessment2 } = await request(t.context.serverUrl)
    .post(`/assessments/${assessment.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
    }))
    .send({
      signCode: 'secret2'
    })
    .expect(200)

  t.is(assessment2.id, assessment.id)
  t.truthy(assessment2.signers['7e779b5f-876c-4cbc-934c-2fdbcacef4d6'].signedDate)
  t.truthy(assessment2.signedDate)
})

test('removes an assessment', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['assessment:remove:all'] })

  const assessment = await createAssessment(t)

  const { body: removedAssessment } = await request(t.context.serverUrl)
    .delete(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(removedAssessment.id, assessment.id)
})

// TODO: can’t delete a signed assessment (422)

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create an assessment if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/assessments')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/assessments')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"assetId" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/assessments')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      status: true,
      statement: true,
      assetId: true,
      transactionId: true,
      ownerId: true,
      takerId: true,
      emitterId: true,
      receiverId: true,
      signers: true,
      nbSigners: true,
      signCodes: true,
      expirationDate: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"status" must be a string'))
  t.true(error.message.includes('"statement" must be a string'))
  t.true(error.message.includes('"assetId" must be a string'))
  t.true(error.message.includes('"transactionId" must be a string'))
  t.true(error.message.includes('"ownerId" must be a string'))
  t.true(error.message.includes('"takerId" must be a string'))
  t.true(error.message.includes('"emitterId" must be a string'))
  t.true(error.message.includes('"receiverId" must be a string'))
  t.true(error.message.includes('"signers" must be of type object'))
  t.true(error.message.includes('"nbSigners" must be a number'))
  t.true(error.message.includes('"signCodes" must be of type object'))
  t.true(error.message.includes('"expirationDate" must be a string'))
})

test('fails to update an assessment if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/assessments/assm_SWtQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      status: true,
      statement: true,
      emitterId: true,
      receiverId: true,
      signers: true,
      nbSigners: true,
      signCodes: true,
      expirationDate: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"status" must be a string'))
  t.true(error.message.includes('"statement" must be a string'))
  t.true(error.message.includes('"emitterId" must be a string'))
  t.true(error.message.includes('"receiverId" must be a string'))
  t.true(error.message.includes('"signers" must be of type object'))
  t.true(error.message.includes('"nbSigners" must be a number'))
  t.true(error.message.includes('"signCodes" must be of type object'))
  t.true(error.message.includes('"expirationDate" must be a string'))
})

test('fails to sign an assessment if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/assessments/assm_SWtQps1I3a1gJYz2I3a/signatures')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/assessments/assm_SWtQps1I3a1gJYz2I3a/signatures')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      signCode: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"signCode" must be a string'))
})

// ////// //
// EVENTS //
// ////// //

// Event tests must run serially before the other tests
test.serial('generates assessment__* events', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'assessment:create:all',
      'assessment:edit:all',
      'assessment:config:all',
      'assessment:sign:all',
      'assessment:remove:all',
      'platformData:edit:all',
      'event:list:all'
    ],
    readNamespaces: ['custom'],
    editNamespaces: ['custom']
  })

  const assessmentCreatedBody = {
    assetId: 'ast_2l7fQps1I3a1gJYz2I3a',
    ownerId: 'user-external-id',
    emitterId: 'user-external-id',
    receiverId: '7e779b5f-876c-4cbc-934c-2fdbcacef4d6',
    signers: {},
    nbSigners: 2,
    expirationDate: null,
    metadata: { dataOnly: true },
    platformData: { platformDataOnly: true }
  }

  const { body: assessment } = await request(t.context.serverUrl)
    .post('/assessments')
    .set(authorizationHeaders)
    .send(assessmentCreatedBody)
    .expect(200)

  const signers = [
    'user-external-id',
    '7e779b5f-876c-4cbc-934c-2fdbcacef4d6'
  ]
  const patchPayload = {
    signers: {
      [signers[0]]: {},
      [signers[1]]: {}
    },
    platformData: { hasplatformData: { test: true } }
  }

  const { body: assessmentUpdated } = await request(t.context.serverUrl)
    .patch(`/assessments/${assessment.id}`)
    .set(authorizationHeaders)
    .send(patchPayload)
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const assessmentCreatedEvent = getObjectEvent({
    events,
    eventType: 'assessment__created',
    objectId: assessment.id
  })
  await testEventMetadata({ event: assessmentCreatedEvent, object: assessment, t })
  t.is(assessmentCreatedEvent.object.assetId, assessment.assetId)
  t.is(assessmentCreatedEvent.object.ownerId, assessment.ownerId)
  t.is(assessmentCreatedEvent.object.emitterId, assessment.emitterId)
  t.is(assessmentCreatedEvent.object.nbSigners, assessment.nbSigners)
  t.deepEqual(assessmentCreatedEvent.object.metadata, { dataOnly: true })
  t.deepEqual(assessmentCreatedEvent.object.platformData, { platformDataOnly: true })

  const assessmentUpdatedEvent = getObjectEvent({
    events,
    eventType: 'assessment__draft_updated',
    objectId: assessmentUpdated.id
  })

  // Lack of DRYness in assessment service makes
  // appropriate patchPayload/changesRequested comparison test harder
  await testEventMetadata({
    event: assessmentUpdatedEvent,
    object: assessmentUpdated,
    t,
    patchPayload: Object.assign({}, patchPayload, {
      signers: {
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': {
          comment: null,
          statement: null,
          signedDate: null
        },
        'user-external-id': {
          comment: null,
          statement: null,
          signedDate: null
        }
      },
      signCodes: {
        '7e779b5f-876c-4cbc-934c-2fdbcacef4d6': null,
        'user-external-id': null
      }
    })
  })
  t.is(assessmentUpdatedEvent.object.assetId, assessment.assetId)
  t.is(assessmentUpdatedEvent.object.ownerId, assessment.ownerId)
  t.is(assessmentUpdatedEvent.object.emitterId, assessment.emitterId)
  t.is(assessmentUpdatedEvent.object.nbSigners, assessment.nbSigners)
  t.true(Object.keys(assessmentUpdatedEvent.object.signers).includes(signers[0]))
  t.true(Object.keys(assessmentUpdatedEvent.object.signers).includes(signers[1]))
  t.deepEqual(assessmentUpdatedEvent.object.metadata, { dataOnly: true })
  t.deepEqual(assessmentUpdatedEvent.object.platformData, {
    platformDataOnly: true,
    hasplatformData: { test: true }
  })

  const { body: assessmentSignedOnce } = await request(t.context.serverUrl)
    .post(`/assessments/${assessmentUpdated.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': signers[0]
    }))
    .send({})
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterSignedOnce } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const assessmentAfterSignedOnce = getObjectEvent({
    events: eventsAfterSignedOnce,
    eventType: 'assessment__signed_once',
    objectId: assessmentSignedOnce.id
  })
  await testEventMetadata({ event: assessmentAfterSignedOnce, object: assessmentSignedOnce, t })

  const { body: assessmentSigned } = await request(t.context.serverUrl)
    .post(`/assessments/${assessmentUpdated.id}/signatures`)
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-user-id': signers[1]
    }))
    .send({})
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterSigned } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const assessmentAfterSigned = getObjectEvent({
    events: eventsAfterSigned,
    eventType: 'assessment__signed',
    objectId: assessmentSigned.id
  })
  await testEventMetadata({ event: assessmentAfterSigned, object: assessmentSigned, t })

  // Can’t delete signed assessment, so we create a new one
  const { body: assessmentToDelete } = await request(t.context.serverUrl)
    .post('/assessments')
    .set(authorizationHeaders)
    .send(assessmentCreatedBody)
    .expect(200)

  await request(t.context.serverUrl)
    .delete(`/assessments/${assessmentToDelete.id}`)
    .set(authorizationHeaders)
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterDelete } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const assessmentDeletedEvent = getObjectEvent({
    events: eventsAfterDelete,
    eventType: 'assessment__deleted',
    objectId: assessmentToDelete.id
  })
  await testEventMetadata({ event: assessmentDeletedEvent, object: assessmentToDelete, t })
})

// //////// //
// VERSIONS //
// //////// //

test('2019-05-20: list assessments', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    apiVersion: '2019-05-20',
    t,
    permissions: ['assessment:list:all']
  })

  const { body: obj } = await request(t.context.serverUrl)
    .get('/assessments?assetId=ast_2l7fQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  checkOffsetPaginatedListObject(t, obj)
})
