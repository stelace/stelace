require('dotenv').config()

const test = require('ava')

const {
  getModelInfo,
  User,
  Asset
} = require('../../../src/models')

test('get model info', (t) => {
  const info = getModelInfo({ objectId: 'org_xC3ZlGs1Jo71gb2G0Jo7' })
  t.is(info.idPrefix, 'org')
  t.is(info.objectType, 'user')
  t.is(info.Model, User)

  const info2 = getModelInfo({ objectId: 'random' })
  t.is(info2.idPrefix, null)
  t.is(info2.objectType, null)
  t.is(info2.Model, null)

  const info3 = getModelInfo({ objectType: 'user' })
  t.is(info3.idPrefix, null)
  t.is(info3.objectType, 'user')
  t.is(info3.Model, User)

  const Models = { User: {} }
  const info4 = getModelInfo({ objectType: 'user', Models })
  t.is(info4.idPrefix, null)
  t.is(info4.objectType, 'user')
  t.is(info4.Model, Models.User)
})

test('get ID prefix', (t) => {
  t.is(getModelInfo({ objectId: 'usr_WHlfQps1I3a1gJYz2I3a' }).idPrefix, 'usr')
  t.is(getModelInfo({ objectId: 'org_xC3ZlGs1Jo71gb2G0Jo7' }).idPrefix, 'org')
  t.is(getModelInfo({ objectId: 'ast_lCfxJNs10rP1g2Mww0rP' }).idPrefix, 'ast')
})

test('get Object type', (t) => {
  t.is(getModelInfo({ objectId: 'usr_WHlfQps1I3a1gJYz2I3a' }).objectType, 'user')
  t.is(getModelInfo({ objectId: 'org_xC3ZlGs1Jo71gb2G0Jo7' }).objectType, 'user')
  t.is(getModelInfo({ objectId: 'ast_lCfxJNs10rP1g2Mww0rP' }).objectType, 'asset')

  t.is(getModelInfo({ idPrefix: 'usr' }).objectType, 'user')
  t.is(getModelInfo({ idPrefix: 'org' }).objectType, 'user')
  t.is(getModelInfo({ idPrefix: 'ast' }).objectType, 'asset')
})

test('get Model', (t) => {
  t.is(getModelInfo({ objectId: 'usr_WHlfQps1I3a1gJYz2I3a' }).Model, User)
  t.is(getModelInfo({ objectId: 'org_xC3ZlGs1Jo71gb2G0Jo7' }).Model, User)
  t.is(getModelInfo({ objectId: 'ast_lCfxJNs10rP1g2Mww0rP' }).Model, Asset)

  t.is(getModelInfo({ idPrefix: 'usr' }).Model, User)
  t.is(getModelInfo({ idPrefix: 'org' }).Model, User)
  t.is(getModelInfo({ idPrefix: 'ast' }).Model, Asset)

  t.is(getModelInfo({ objectType: 'user' }).Model, User)
  t.is(getModelInfo({ objectType: 'asset' }).Model, Asset)
})
