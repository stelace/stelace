require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')

const userServer = express()
const userServerCalls = {}
const userServerCallsHeaders = {}
let userApp

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')

const {
  computeDate,

  checkCursorPaginationScenario,
  checkCursorPaginatedListObject,
} = require('../../util')

/* eslint-disable no-template-curly-in-string */

const defaultTestDelay = 4000

let createdWorkflows

async function createWorkflowLogs (t) {
  if (createdWorkflows) return createdWorkflows

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'workflowLog:list:all',
      'workflow:create:all',
      'category:create:all',
      'entry:create:all',
      'message:create:all',
    ]
  })

  // should create workflows that listen to events that are not triggered by any tests below

  const { body: categoryWorkflow } = await request(t.context.serverUrl)
    .post('/workflows')
    .set(authorizationHeaders)
    .send({
      name: 'Workflow for category creation',
      event: 'category__created',
      run: { // single-step object allowed
        endpointMethod: 'PATCH',
        endpointUri: '/categories/${object.id}',
        endpointPayload: JSON.stringify({ // simulate real API call (string JSON only)
          metadata: {
            updated: true
          }
        })
      }
    })
    .expect(200)

  const { body: messageWorkflow } = await request(t.context.serverUrl)
    .post('/workflows')
    .set(authorizationHeaders)
    .send({
      name: 'Workflow for message creation',
      event: 'message__created',
      run: { // single-step object allowed
        endpointMethod: 'PATCH',
        endpointUri: '/messages/${object.id}',
        endpointPayload: JSON.stringify({ // simulate real API call (string JSON only)
          metadata: {
            updated: true
          }
        })
      }
    })
    .expect(200)

  const { body: entryWorkflow } = await request(t.context.serverUrl)
    .post('/workflows')
    .set(authorizationHeaders)
    .send({
      name: 'Workflow for entry creation',
      event: 'entry__created',
      run: { // single-step object allowed
        endpointMethod: 'PATCH',
        endpointUri: '/entries/${object.id}',
        endpointPayload: JSON.stringify({ // simulate real API call (string JSON only)
          metadata: {
            updated: true
          }
        })
      }
    })
    .expect(200)

  createdWorkflows = _.keyBy([
    categoryWorkflow,
    messageWorkflow,
    entryWorkflow,
  ], 'event')

  await request(t.context.serverUrl)
    .post('/categories')
    .set(authorizationHeaders)
    .send({
      name: 'Some category',
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/messages')
    .set(authorizationHeaders)
    .send({
      topicId: 'ast_2l7fQps1I3a1gJYz2I3a',
      receiverId: 'user-external-id',
      content: 'Good',
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'someCollection',
      locale: 'en-US',
      name: 'nameExample',
      fields: {
        title: 'Random title',
        content: 'Random content',
        nestedContent: {
          random1: {
            random2: 'hello'
          },
          random3: 'bye'
        }
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, defaultTestDelay))
}

test.before(async (t) => {
  await before({ name: 'workflow' })(t)
  await beforeEach()(t)

  userServer.use(bodyParser.json())
  userServer.all('*', function (req, res, next) {
    req._workflowName = req.path.replace('/', '')
    req._stopped = _.get(req.body, 'lastStep.stopped') // falsy `filter` or truthy `stop` in some step

    if (!Array.isArray(userServerCallsHeaders[req._workflowName])) {
      userServerCallsHeaders[req._workflowName] = []
    }
    userServerCallsHeaders[req._workflowName].unshift(req.headers)
    next()
  })
  userServer.post('/error', function (req, res) {
    res.status(500).json({ message: 'Webhook target server error' })
  })
  userServer.post('*', function (req, res) {
    // Filtered workflows logs could also be stored separately
    if (req._stopped) return res.json({ ok: true })

    if (!Array.isArray(userServerCalls[req._workflowName])) {
      userServerCalls[req._workflowName] = []
    }
    userServerCalls[req._workflowName].unshift(req.body)
    res.json({ ok: true })
  })

  await new Promise((resolve, reject) => {
    userApp = userServer.listen((err) => {
      if (err) return reject(err)

      resolve()
    })
  })

  await createWorkflowLogs(t)
})
// test.beforeEach(beforeEach()) // tests are run concurrently
test.after(async (t) => {
  await after()(t)
  await userApp.close()
})

// need serial to ensure there is no insertion/deletion during pagination scenario
test.serial('list workflow logs', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['workflowLog:list:all'] })

  await checkCursorPaginationScenario({
    t,
    endpointUrl: '/workflow-logs',
    authorizationHeaders,
  })
})

test('list workflow logs with id filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['workflowLog:list:all'] })

  const { body: { results: workflowLogs } } = await request(t.context.serverUrl)
    .get('/workflow-logs')
    .set(authorizationHeaders)
    .expect(200)

  const workflowLog = workflowLogs[0]

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/workflow-logs?id=${workflowLog.id}`)
    .set(authorizationHeaders)
    .expect(200)

  checkCursorPaginatedListObject(t, obj)
  t.is(obj.results.length, 1)
})

test('list workflow logs with advanced filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['workflowLog:list:all'] })

  const now = new Date().toISOString()
  const minDate = computeDate(now, '-10d')

  const {
    category__created: categoryWorkflow,
    message__created: messageWorkflow,
  } = createdWorkflows

  const params = `createdDate[gte]=${encodeURIComponent(minDate)}` +
    `&workflowId[]=${categoryWorkflow.id}` +
    `&workflowId[]=${messageWorkflow.id}`

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/workflow-logs?${params}`)
    .set(authorizationHeaders)
    .expect(200)

  const checkResultsFn = (t, workflowLog) => {
    t.true(workflowLog.createdDate >= minDate)
    t.true([categoryWorkflow.id, messageWorkflow.id].includes(workflowLog.workflowId))
  }

  checkCursorPaginatedListObject(t, obj, { checkResultsFn })
})

test('finds a workflow log', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'workflowLog:list:all',
      'workflowLog:read:all'
    ]
  })

  const { body: { results: workflowLogs } } = await request(t.context.serverUrl)
    .get('/workflow-logs')
    .set(authorizationHeaders)
    .expect(200)

  const { body: workflowLog } = await request(t.context.serverUrl)
    .get(`/workflow-logs/${workflowLogs[0].id}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(workflowLog.id, workflowLogs[0].id)
})
