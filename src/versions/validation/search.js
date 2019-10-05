const { Joi, searchSchema } = require('../../util/validation')

const ifSaving = (joiTypeIfTrue, joiTypeIfFalse) => Joi.when('save', {
  is: joiTypeIfTrue ? Joi.boolean().valid(true).required() : Joi.boolean().valid(false),
  then: joiTypeIfTrue || joiTypeIfFalse,
  otherwise: Joi.any().forbidden()
})

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = {
  query: Joi.object().keys({
    _size: Joi.number().integer().positive(), // only used in testing environment
    _validateOnly: Joi.boolean() // only used by system, do not trigger search at all
  }),
  body: searchSchema
    .keys({
      save: Joi.boolean().default(false),

      name: ifSaving(Joi.string().max(255).required()),
      userId: ifSaving(Joi.string()),
      metadata: ifSaving(Joi.object().unknown()),
      platformData: ifSaving(Joi.object().unknown()),

      savedSearch: ifSaving(
        null,
        Joi.object().keys({
          userId: Joi.string(),
          ids: Joi.array().unique().items(Joi.string())
        })
      )
    })
    .required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'search.list',
      schema: schemas['2019-05-20'].list
    }
  ]
}

module.exports = validationVersions
