const Base = require('./Base')

const _ = require('lodash')
const { raw, transaction } = require('objection')
const bluebird = require('bluebird')
const createError = require('http-errors')

const {
  getAvailabilityPeriodGraph,
  getInternalAvailabilityPeriods
} = require('../util/availability')
const {
  shouldAffectAvailability,
  isStatusBlockingAvailability
} = require('../util/transaction')

class InternalAvailability extends Base {
  static get tableName () {
    return 'internalAvailability'
  }

  async $beforeInsert () {}
  async $beforeUpdate () {}

  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'integer'
        },
        assetId: {
          type: 'string'
        },
        transactionId: {
          type: 'string'
        },
        assetTypeId: {
          type: 'string'
        },
        transactionStatus: {
          type: 'string'
        },
        unavailable: {
          type: 'boolean',
          default: false
        },
        datesRange: {
          type: 'string'
        },
        startDate: {
          type: 'date'
        },
        endDate: {
          type: 'date'
        },
        quantity: {
          type: 'integer'
        }
      }
    }
  }

  static async syncInternalAvailability ({ assetsIds, platformId, env }) {
    const { getModels } = require('./index') // avoid circular dependency

    const {
      Transaction,
      InternalAvailability,
      Asset,
      Availability,
      AssetType
    } = await getModels({ platformId, env })

    const [
      assets,
      assetTypes,
      allAssetAvailabilities,
      allTransactions
    ] = await Promise.all([
      Asset.query().whereIn('id', assetsIds),
      AssetType.query(),
      Availability.query().whereIn('assetId', assetsIds),
      Transaction.query().whereIn('assetId', assetsIds)
    ])

    const indexedAssetTypes = _.keyBy(assetTypes, 'id')
    const indexedAssetAvailabilities = _.groupBy(allAssetAvailabilities, 'assetId')
    const indexedTransactions = _.groupBy(allTransactions, 'assetId')

    await bluebird.map(assets, async (asset) => {
      const assetType = indexedAssetTypes[asset.assetTypeId]
      if (!assetType) {
        throw createError(`Unfound asset type (ID ${asset.assetTypeId})`, { assetTypeId: asset.assetTypeId })
      }

      const availabilities = indexedAssetAvailabilities[asset.id] || []

      const availabilityGraph = getAvailabilityPeriodGraph({
        availabilities,
        defaultQuantity: asset.quantity
      })

      let transactions = indexedTransactions[asset.id] || []
      transactions = transactions.filter(transaction => shouldAffectAvailability(transaction, { checkStatus: false }))

      const transactionsById = _.keyBy(transactions, 'id')

      const {
        chunkAvailabilities,
        chunkTransactions
      } = getInternalAvailabilityPeriods(availabilityGraph, transactions)

      const knex = InternalAvailability.knex()

      await transaction(knex, async (trx) => {
        // delete existing internal availabilities first to have a clean workspace
        await InternalAvailability.query(trx).delete().where({ assetId: asset.id })

        // add computed chunk availability periods to speed up availability query
        await bluebird.map(chunkAvailabilities, async (chunkAvailability) => {
          const { startDate, endDate, quantity } = chunkAvailability

          const dbStartDate = startDate || '-infinity'
          const dbEndDate = endDate || 'infinity'

          await InternalAvailability.query(trx).insert({
            assetId: asset.id,
            datesRange: raw('tstzrange(?, ?)', [dbStartDate, dbEndDate]),
            startDate: dbStartDate,
            endDate: dbEndDate,
            quantity
          })
        }, { concurrency: 5 })

        // add computed chunk transactions to speed up availability query
        await bluebird.map(chunkTransactions, async (chunkTransaction) => {
          const { id, status, startDate, endDate, quantity, assetTypeId } = chunkTransaction

          const dbStartDate = startDate || '-infinity'
          const dbEndDate = endDate || 'infinity'

          const transaction = transactionsById[id]

          await InternalAvailability.query(trx).insert({
            assetId: asset.id,
            transactionId: id,
            transactionStatus: status,
            assetTypeId,
            unavailable: isStatusBlockingAvailability(transaction, status),
            datesRange: raw('tstzrange(?, ?)', [dbStartDate, dbEndDate]),
            startDate: dbStartDate,
            endDate: dbEndDate,
            quantity: -quantity // used quantity so it's negative
          }, { concurrency: 5 })
        })
      })
    }, { concurrency: 10 })
  }

  static async syncInternalAvailabilityTransaction ({ transactionIds, platformId, env }) {
    const { getModels } = require('./index') // avoid circular dependency

    const { Transaction, InternalAvailability } = await getModels({ platformId, env })

    const transactions = await Transaction.query().whereIn('id', transactionIds)

    await bluebird.each(transactions, async (transaction) => {
      const shouldAffect = shouldAffectAvailability(transaction, { checkStatus: false })
      if (!shouldAffect) return

      await InternalAvailability.query()
        .patch({
          transactionStatus: transaction.status,
          unavailable: isStatusBlockingAvailability(transaction, transaction.status)
        })
        .where({ transactionId: transaction.id })
    })
  }

  static async removeInternalAvailability ({ assetsIds, platformId, env }) {
    const { getModels } = require('./index') // avoid circular dependency

    const { InternalAvailability } = await getModels({ platformId, env })

    await InternalAvailability.query().delete().whereIn('assetId', assetsIds)
  }
}

module.exports = InternalAvailability
