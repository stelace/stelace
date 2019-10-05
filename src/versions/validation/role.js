const { Joi, objectIdParamsSchema } = require('../../util/validation')

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = null
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    value: Joi.string().required(),
    parentId: Joi.string().allow(null),
    permissions: Joi.array().unique().items(Joi.string()),
    readNamespaces: Joi.array().unique().items(Joi.string()),
    editNamespaces: Joi.array().unique().items(Joi.string()),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .fork('value', schema => schema.forbidden())
    .fork('name', schema => schema.optional())
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'role.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'role.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'role.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'role.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'role.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
