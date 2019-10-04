const createError = require('http-errors')
const { transaction } = require('objection')

const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const _ = require('lodash')

const {
  getPaginationMeta,
  parseArrayValues
} = require('../util/list')

let responder

function start ({ communication }) {
  const {
    getResponder
  } = communication

  responder = getResponder({
    name: 'Document Responder',
    key: 'document'
  })

  responder.on('getStats', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      field,
      groupBy,
      orderBy,
      order,
      page,
      nbResultsPerPage,
      documentType: type,
      label,

      authorId,
      targetId,
      data,
      avgPrecision
    } = req
    let {
      computeRanking
    } = req

    let isDataGroupByExpression
    let sqlGroupByExpression
    let sqlStatsFieldExpression
    let groupByDataField
    let statsDataField

    if (field === groupBy) {
      throw createError(422, `${field} cannot be field and groupBy at the same time`)
    }

    // Prepare SQL expressions for below build queries
    if (field) {
      const {
        valid,
        sqlFieldExpression,
        dataField
      } = parseDataField(field)
      if (!valid) {
        throw createError(400, `The field value ${field} is invalid`)
      }

      sqlStatsFieldExpression = sqlFieldExpression
      statsDataField = dataField
    }

    if (['authorId', 'targetId'].includes(groupBy)) {
      sqlGroupByExpression = `"${groupBy}"`
      isDataGroupByExpression = false
    } else {
      const {
        valid,
        sqlFieldExpression,
        dataField
      } = parseDataField(groupBy)
      if (!valid) {
        throw createError(400, `The field value ${groupBy} is invalid`)
      }

      isDataGroupByExpression = true
      sqlGroupByExpression = sqlFieldExpression
      groupByDataField = dataField
    }

    // We have to separate filters into two categories: pre-ranking and post-ranking
    // There is at most one post-ranking filter.
    // The post-ranking filter is the filter whose field match the groupBy field.
    // The other filters are classified as pre-ranking filters.
    // If we don't separate filters, we lost ranking indicator.

    // Example: Suppose each document represent a student grade and we want to retrieve the statictics for a student.
    // First, we compute the statistics for all student and we sort them so we can get the ranking.
    // Then, we filter on the student we're interested in.

    // If we filter on the grades of the student first, we lost the grades from the other students.

    // Here's a SQLFiddle to play with:
    // http://sqlfiddle.com/#!17/f717b/1
    const filtersPreRanking = {
      attributes: [],
      dataAttributes: []
    }
    let filterPostRanking

    if (authorId) {
      const parsedAuthorIds = parseArrayValues(authorId)

      const filter = {
        key: 'authorId',
        value: parsedAuthorIds
      }

      if (groupBy === 'authorId') {
        filterPostRanking = filter
      } else {
        filtersPreRanking.attributes.push(filter)
      }
    }
    if (targetId) {
      const parsedTargetIds = parseArrayValues(targetId)

      const filter = {
        key: 'targetId',
        value: parsedTargetIds
      }

      if (groupBy === 'targetId') {
        filterPostRanking = filter
      } else {
        filtersPreRanking.attributes.push(filter)
      }
    }
    if (data) {
      Object.keys(data).forEach(key => {
        const isValidKey = key.indexOf(':') === -1
        if (!isValidKey) {
          throw createError(400, `Invalid format for data key: ${key}`)
        }

        const parsedIds = parseArrayValues(data[key])

        const filter = {
          key,
          value: parsedIds
        }

        if (groupByDataField === key) {
          filterPostRanking = filter
        } else {
          filtersPreRanking.dataAttributes.push(filter)
        }
      })
    }

    const parsedLabels = !label ? [] : parseArrayValues(label)

    const multipleLabels = parsedLabels.length >= 2
    const uniqueGroupByResult = filterPostRanking && filterPostRanking.value.length === 1

    if (multipleLabels && !uniqueGroupByResult) {
      throw createError(422, `Multiple labels can be applied if the groupBy ${groupBy} is filtered with one value`)
    }
    if (multipleLabels && uniqueGroupByResult) {
      computeRanking = false
    }

    const getQueryBuilderByLabel = (label) => {
      const knex = Document.knex()
      let queryBuilder = knex

      queryBuilder = queryBuilder.with(`aggregations`, qb => {
        let selectExpressions = [
          knex.raw(`${sqlGroupByExpression} as "groupByField"`)
        ]

        // No ranking possible if stats field isn't provided (we cannot know which field to aggregate)
        if (computeRanking && sqlStatsFieldExpression) {
          // Double-check (normally done in Joi validation step) the operator and the direction
          // because we manually build the query so it can subject to SQL injection
          const allowedOperators = ['count', 'avg', 'sum', 'min', 'max']
          if (!allowedOperators.includes(orderBy)) {
            throw createError(`Unknown operator: ${orderBy}`) // internal error, should not happen
          }

          const allowedDirections = ['asc', 'desc']
          if (!allowedDirections.includes(order)) {
            throw createError(`Unknown direction: ${order}`) // internal error, should not happen
          }

          selectExpressions = selectExpressions.concat([
            knex.raw(`ROW_NUMBER() OVER (ORDER BY ${orderBy}((${sqlStatsFieldExpression})::REAL) ${order}) AS "ranking"`),
            knex.raw(`COUNT(*) OVER () as "lowestRanking"`)
          ])
        }

        qb
          .from(`${Document.defaultSchema}.document`)
          .select(selectExpressions)
          .count()
          .where('type', type)
          .groupBy('groupByField')
          .orderBy(orderBy, order)

        if (label) {
          const sqlLikeValue = label.replace(/\*/gi, '%')
          qb.where('label', 'like', sqlLikeValue)
        }

        // If any pre-ranking filters are provided, apply them
        filtersPreRanking.attributes.forEach(filter => {
          qb.whereIn(filter.key, filter.value)
        })
        filtersPreRanking.dataAttributes.forEach(filter => {
          // TODO: make it work if numbers are provided
          // Currently, numbers are converted into string due to the query params
          qb.whereRaw(`to_jsonb(data->>'${filter.key}') <@ ?::jsonb`, [JSON.stringify(filter.value)])
        })

        // filter the post-ranking filter here (to reduce results set) if there is no ranking
        if (filterPostRanking && !computeRanking) {
          if (isDataGroupByExpression) {
            qb.whereRaw(`to_jsonb(${sqlGroupByExpression}) <@ ?::jsonb`, [JSON.stringify(filterPostRanking.value)])
          } else {
            qb.whereIn(groupBy, filterPostRanking.value)
          }
        }

        // If the stats field isn't provided, we cannot perform aggregation operations except for count (done above)
        if (sqlStatsFieldExpression) {
          // Only consider documents that have the data field
          // Check the link: https://knexjs.org/#Raw-Bindings for the syntax
          qb.whereRaw('?? \\? ?', ['data', statsDataField])

          // Convert the stats field into real (PostgreSQL decimal number)
          // from default json text value
          // Aggregation operations can only work with numbers
          qb
            .avg({ avg: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
            .sum({ sum: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
            .min({ min: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
            .max({ max: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
        }

        return qb
      })

      queryBuilder
        .select()
        .from('aggregations')
        .offset((page - 1) * nbResultsPerPage)
        .limit(nbResultsPerPage)

      if (filterPostRanking && computeRanking) {
        queryBuilder.whereIn('groupByField', filterPostRanking.value)
      }

      return queryBuilder
    }

    let paginationMeta

    if (multipleLabels && uniqueGroupByResult) {
      const labelPromises = parsedLabels.map(label => getQueryBuilderByLabel(label))
      const statsByLabel = await Promise.all(labelPromises)

      const aggregatedStats = {}

      parsedLabels.forEach((label, index) => {
        aggregatedStats[label] = statsByLabel[index][0]

        if (aggregatedStats[label]) {
          aggregatedStats[label] = transformDocStats(aggregatedStats[label], {
            computeRanking,
            groupBy,
            avgPrecision
          })
        } else {
          // if there is no result for a specific label, set it to a default object
          aggregatedStats[label] = {
            groupBy,
            groupByValue: null,
            count: 0,
            avg: null,
            sum: null,
            min: null,
            max: null
          }
        }
      })

      paginationMeta = getPaginationMeta({
        nbResults: 1,
        nbResultsPerPage,
        page
      })

      paginationMeta.results = [aggregatedStats]
    } else {
      const queryBuilder = getQueryBuilderByLabel(label)
      const countQueryBuilder = queryBuilder.clone()

      queryBuilder
        .offset((page - 1) * nbResultsPerPage)
        .limit(nbResultsPerPage)

      let [
        documentStats,
        [{ count: nbDocuments }]
      ] = await Promise.all([
        queryBuilder,
        countQueryBuilder.count()
      ])

      paginationMeta = getPaginationMeta({
        nbResults: nbDocuments,
        nbResultsPerPage,
        page
      })

      paginationMeta.results = documentStats.map(doc => {
        return transformDocStats(doc, {
          computeRanking,
          groupBy,
          avgPrecision
        })
      })
    }

    return paginationMeta
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      documentType: type,
      label,
      authorId,
      targetId,
      data
    } = req

    const queryBuilder = Document.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        type: {
          dbField: 'type',
          value: type
        },
        labels: {
          value: label,
          transformValue: 'array',
          query: (queryBuilder, labels) => {
            const includeAllLabels = labels.includes('*')
            if (!includeAllLabels) {
              queryBuilder.where(qb => {
                labels.forEach((label, index) => {
                  const sqlLikeValue = label.replace(/\*/gi, '%')
                  if (index === 0) {
                    qb.where('label', 'like', sqlLikeValue)
                  } else {
                    qb.orWhere('label', 'like', sqlLikeValue)
                  }
                })

                return qb
              })
            }
          }
        },
        authorIds: {
          dbField: 'authorId',
          value: authorId,
          transformValue: 'array',
          query: 'inList'
        },
        targetId: {
          dbField: 'targetId',
          value: targetId,
          transformValue: 'array',
          query: 'inList'
        },
        data: {
          value: data,
          query: (queryBuilder, data) => {
            queryBuilder.whereRaw('??::jsonb @> ?::jsonb', ['data', data])
          }
        }
      },
      paginationActive: true,
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    paginationMeta.results = Document.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const documentId = req.documentId

    const document = await Document.query().findById(documentId)
    if (!document) {
      throw createError(404)
    }

    return Document.expose(document, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      documentId, // can be provided if custom prefix is needed (like rating with rtg_id)
      authorId,
      targetId,
      documentType: type,
      label,
      data,
      metadata,
      platformData
    } = req

    const createAttrs = {
      id: documentId || await getObjectId({ prefix: Document.idPrefix, platformId, env }),
      authorId,
      targetId,
      type,
      label,
      data,
      metadata,
      platformData
    }

    const document = await Document.query().insert(createAttrs)

    return Document.expose(document, { req })
  })

  responder.on('batchCreate', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      documents
    } = req

    const documentsAttrs = []
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      documentsAttrs.push({
        // can be provided if custom prefix is needed (like rating with rtg_id)
        id: doc.id || await getObjectId({ prefix: Document.idPrefix, platformId, env }),
        authorId: doc.authorId,
        targetId: doc.targetId,
        type: doc.type,
        label: doc.label,
        data: doc.data,
        metadata: doc.metadata,
        platformData: doc.platformData
      })
    }

    await Document.query().insert(documentsAttrs)

    return { success: true }
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      documentId,
      label,
      data,
      metadata,
      platformData,

      replaceDataProperties
    } = req

    let document = await Document.query().findById(documentId)
    if (!document) {
      throw createError(404)
    }

    const updateAttrs = {
      label
    }

    if (metadata) {
      updateAttrs.metadata = Document.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Document.rawJsonbMerge('platformData', platformData)
    }

    let newDocument

    const knex = Document.knex()

    await transaction(knex, async (trx) => {
      newDocument = await Document.query(trx).patchAndFetchById(documentId, updateAttrs)

      // JSONB column `data` may have properties `replaceDataProperties` that should be replaced
      // instead of being merged via `rawJsonbMerge`
      if (data) {
        newDocument = await Document.updateJsonb({
          modelId: documentId,
          baseObjectName: 'data',
          changesObject: data,
          replacingProperties: replaceDataProperties,
          trx
        })
      }
    })

    return Document.expose(newDocument, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Document } = await getModels({ platformId, env })

    const {
      documentId
    } = req

    const document = await Document.query().findById(documentId)
    if (!document) {
      return { id: documentId }
    }

    await Document.query().deleteById(documentId)

    return { id: documentId }
  })
}

function getSqlDataFieldExpression (field) {
  return `data->>'${field}'`
}

function parseDataField (str) {
  const result = {
    valid: false,
    sqlFieldExpression: null,
    dataField: null
  }

  const parts = str.split('.')
  result.valid = parts.length === 2

  if (!result.valid) {
    return result
  }

  result.dataField = parts[1]
  result.sqlFieldExpression = getSqlDataFieldExpression(result.dataField)

  return result
}

function getFloatWithPrecision (number, precision) {
  return parseFloat(number.toFixed(precision))
}

function transformDocStats (stat, { computeRanking, groupBy, avgPrecision }) {
  stat = _.cloneDeep(stat)

  stat.groupBy = groupBy
  stat.groupByValue = stat.groupByField
  delete stat.groupByField

  // Convert the below numbers into integer because PostgreSQL bigint type is returned as string
  if (stat.lowestRanking) {
    stat.lowestRanking = parseInt(stat.lowestRanking, 10)
  }
  if (stat.ranking) {
    stat.ranking = parseInt(stat.ranking, 10)
  }
  if (stat.count) {
    stat.count = parseInt(stat.count, 10)
  }
  if (typeof stat.avg !== 'undefined') {
    stat.avg = getFloatWithPrecision(stat.avg, avgPrecision)
  } else {
    stat.avg = null
  }

  // can be undefined if field isn't provided
  stat.sum = typeof stat.sum !== 'undefined' ? stat.sum : null
  stat.min = typeof stat.min !== 'undefined' ? stat.min : null
  stat.max = typeof stat.max !== 'undefined' ? stat.max : null

  if (!computeRanking) {
    delete stat.lowestRanking
    delete stat.ranking
  }

  return stat
}

function stop () {
  responder.close()
  responder = null
}

module.exports = {
  start,
  stop
}
