const Joi = require('@hapi/joi')

const { objectIdParamsSchema } = require('../../util/validation')

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
    parentId: Joi.string().allow(null),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .optionalKeys('name')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'category.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'category.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'category.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'category.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'category.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
