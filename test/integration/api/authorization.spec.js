require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders, getSystemKey } = require('../../auth')

test.before(async t => {
  await before({ name: 'authorization' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

test('permissions can be checked', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['category:list:all'] })

  const platformId = t.context.platformId

  const { body: permissionsObject } = await request(t.context.serverUrl)
    .post('/permissions/check')
    .send({
      permissions: [
        'category:list',
        'category:list:all'
      ]
    })
    .set(authorizationHeaders)
    .expect(200)

  t.is(permissionsObject['category:list:all'], true)
  t.is(permissionsObject['category:list'], false)

  // unknown permissions are handled
  const { body: permissionsObject2 } = await request(t.context.serverUrl)
    .post('/permissions/check')
    .send({
      permissions: [
        'unknownPermission'
      ]
    })
    .set(authorizationHeaders)
    .expect(200)

  t.is(permissionsObject2['unknownPermission'], false)

  // check public permissions
  const { body: permissionsObject3 } = await request(t.context.serverUrl)
    .post('/permissions/check')
    .send({
      permissions: [
        'category:list:all',
        'role:create:all'
      ]
    })
    .set({
      'x-platform-id': platformId,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  t.is(permissionsObject3['category:list:all'], true)
  t.is(permissionsObject3['role:create:all'], false)

  // permissions to check are needed
  await request(t.context.serverUrl)
    .post('/permissions/check')
    .set({
      'x-platform-id': platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)
})

test('cannot access/create/modify a resource only with platformData:edit:all permission', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['platformData:edit:all'] })

  await request(t.context.serverUrl)
    .post('/categories')
    .send({
      name: 'Random category'
    })
    .set(authorizationHeaders)
    .expect(403)

  t.pass()
})

test('use system features but check the provided permissions', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: [] }) // no permissions
  const systemKey = getSystemKey()

  // can create a category because it's from the system
  await request(t.context.serverUrl)
    .post('/categories')
    .send({
      name: 'Random category'
    })
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-system-key': systemKey
    }))
    .expect(200)

  // cannot create a category because even if it's from the system,
  // the 'x-stelace-system-permissions' header means the permissions check should be performed
  // before allowing the request
  await request(t.context.serverUrl)
    .post('/categories')
    .send({
      name: 'Random category'
    })
    .set(Object.assign({}, authorizationHeaders, {
      'x-stelace-system-key': systemKey,
      'x-stelace-system-permissions': 'check'
    }))
    .expect(403)

  t.pass()
})
