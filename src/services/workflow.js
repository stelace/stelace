const createError = require('http-errors')
const http = require('http')
const Uuid = require('uuid')
const bluebird = require('bluebird')
const _ = require('lodash')
const request = require('superagent')
const apm = require('elastic-apm-node')

const { getLocalInstanceKey } = require('../auth')
const { logError } = require('../../server/logger')
const { getModels, getModelInfo } = require('../models')

const { isValidObjectId } = require('../util/validation')

const { getObjectId } = require('stelace-util-keys')

const { apiVersions, applyObjectChanges } = require('../versions')

const { performListQuery } = require('../util/listQueryBuilder')

// Stelace Workflows: reuse sandbox for performance
const { VM } = require('vm2')

const debug = require('debug')('stelace:api')
let apiBase

let localInstanceKey

let responder
let eventSubscriber
let configRequester

function start ({ communication, serverPort }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Workflow Responder',
    key: 'workflow'
  })

  eventSubscriber = getSubscriber({
    name: 'Workflow subscriber for events',
    key: 'event',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'eventCreated'
    ]
  })

  configRequester = getRequester({
    name: 'Workflow service > Config requester',
    key: 'config'
  })

  apiBase = `http://localhost:${serverPort}`

  localInstanceKey = getLocalInstanceKey()

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Workflow } = await getModels({ platformId, env })

    const queryBuilder = Workflow.query()

    const workflows = await performListQuery({
      queryBuilder,
      paginationActive: false,
      orderConfig: {
        orderBy: 'createdDate',
        order: 'desc'
      }
    })

    return Workflow.exposeAll(workflows, { req })
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Workflow, WorkflowLog } = await getModels({ platformId, env })

    const workflowId = req.workflowId
    const populateLogs = !_.isUndefined(req.logs)

    const workflow = await Workflow.query().findById(workflowId)
    if (!workflow) throw createError(404)

    if (populateLogs) {
      const queryBuilder = WorkflowLog.query().where({ workflowId: workflow.id })
      const actionCountQueryBuilder = queryBuilder.clone()
        .where(qb => {
          return qb
            .where(qb2 => {
              return qb2
                .whereIn('type', ['action'])

                // DEPRECATED: old step object properties
                .whereJsonNotSupersetOf('step', { stopped: true })
                .whereJsonNotSupersetOf('step', { skipped: true })
                .whereJsonNotSupersetOf('step', { error: true, handleErrors: false })
                // DEPRECATED:END
            })
            .orWhere(qb2 => {
              return qb2
                .where('type', 'runError')
                .whereJsonSupersetOf('step', { handleErrors: true })
            })
        })
      const startedACountQueryBuilder = queryBuilder.clone().whereNotIn('type', ['notification', 'preRunError'])
      const notificationCountQueryBuilder = queryBuilder.clone().whereIn('type', ['notification'])

      const [
        workflowLogs,
        [{ count: nbActionsCompleted }],
        [{ count: nbActions }],
        [{ count: notificationCount }]
      ] = await Promise.all([
        queryBuilder.orderBy('createdDate', 'desc').limit(100),
        actionCountQueryBuilder.count(),
        startedACountQueryBuilder.count(),
        notificationCountQueryBuilder.count()
      ])

      workflow.stats.nbActionsCompleted = nbActionsCompleted
      workflow.stats.nbActions = nbActions
      workflow.stats.nbWorkflowNotifications = notificationCount
      workflow.logs = workflowLogs
    }

    return Workflow.expose(workflow, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Event,
      Workflow
    } = await getModels({ platformId, env })

    const {
      name,
      description,
      context,
      notifyUrl,
      event,
      run,
      computed,
      apiVersion,
      active,
      metadata,
      platformData
    } = req

    if (event) {
      const isAllowedEvent = Event.isAllowedEvent(event)

      if (!isAllowedEvent) throw createError(422, `Invalid ${event} event`)
    }
    if (apiVersion && !apiVersions.includes(apiVersion)) {
      // Safeguard as it is already handled during Joi validation
      throw createError(400, 'Invalid API version', {
        public: { allowedVersions: apiVersions }
      })
    }

    const latestApiVersion = apiVersions[0]

    const workflow = await Workflow.query().insert({
      id: await getObjectId({ prefix: Workflow.idPrefix, platformId, env }),
      name,
      description,
      context,
      notifyUrl,
      event,
      run,
      computed,
      // Falling back to current platform version (req._platformVersion)
      apiVersion: apiVersion || req._platformVersion || latestApiVersion,
      active,
      metadata,
      platformData
    })

    return Workflow.expose(workflow, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Event,
      Workflow
    } = await getModels({ platformId, env })

    const {
      workflowId,
      name,
      description,
      context,
      notifyUrl,
      event,
      run,
      computed,
      apiVersion,
      active,
      metadata,
      platformData
    } = req

    let workflow = await Workflow.query().findById(workflowId)
    if (!workflow) {
      throw createError(404)
    }

    if (event) {
      const isAllowedEvent = Event.isAllowedEvent(event)

      if (!isAllowedEvent) throw createError(422, `Invalid ${event} event`)
    }
    if (apiVersion && !apiVersions.includes(apiVersion)) {
      throw createError(422, 'Invalid API version', {
        public: {
          allowedVersions: apiVersions
        }
      })
    }

    const updateAttrs = {
      name,
      description,
      context,
      notifyUrl,
      event,
      run,
      computed,
      apiVersion,
      active
    }

    if (metadata) {
      updateAttrs.metadata = Workflow.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Workflow.rawJsonbMerge('platformData', platformData)
    }

    workflow = await Workflow.query().patchAndFetchById(workflowId, updateAttrs)

    return Workflow.expose(workflow, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Workflow } = await getModels({ platformId, env })

    const {
      workflowId
    } = req

    const workflow = await Workflow.query().findById(workflowId)
    if (!workflow) {
      return { id: workflowId }
    }

    await Workflow.query().deleteById(workflowId)

    return { id: workflowId }
  })

  // EVENTS

  eventSubscriber.on('eventCreated', async ({ event, platformId, env } = {}) => {
    // APM transaction needs to be created for customRequester
    // Note: APM transactions cannot be nested
    const prepareWorkflowsTransaction = apm.startTransaction('Prepare Workflows', 'workflow')
    apm.setUserContext({ id: platformId })
    apm.addLabels({ platformId, env, eventType: event.type })

    /*
    Objects to be shared across ALL workflows for this single event
    Remember that these can be mutated/overwritten by each of them
    */
    let runId
    let workflowsCtx = {} // shared and same for all current event’s workflows
    let vm

    try {
      const {
        Event,
        Workflow,
        WorkflowLog
      } = await getModels({ platformId, env })
      const exposedEvent = Event.expose(event, { namespaces: ['*'] })
      const envVariables = {}

      const latestVersion = apiVersions[0]
      const fromVersion = event.apiVersion

      const workflows = await Workflow.query()
        .where({
          active: true,
          event: event.type
        })

      const workflowApiVersions = workflows.map(workflow => workflow.apiVersion || latestVersion)

      if (workflows.length) {
        workflowsCtx = await bluebird.reduce(workflowApiVersions, async (ctx, apiVersion) => {
          const versionedEvent = await Event.getVersionedEvent(exposedEvent, apiVersion)
          ctx[apiVersion] = Object.assign({}, versionedEvent)

          // current custom events have no object type
          if (versionedEvent.objectType) {
            ctx[apiVersion][versionedEvent.objectType] = ctx[apiVersion].object
          }

          return ctx
        }, {})
      }

      if (workflows.length && !_.isEmpty(event.relatedObjectsIds)) {
        const {
          objectsTypes,
          objectsPromises: relatedObjectsPromises
        } = await fetchRelatedObjects({
          relatedObjectsObject: event.relatedObjectsIds,
          platformId,
          env
        })

        // related objects fetches happen concurrently
        const relatedObjects = await bluebird.props(relatedObjectsPromises)

        // apply versioning for each related object by workflow api version
        await bluebird.map(workflowApiVersions, async (apiVersion) => {
          const versionedObjects = await bluebird.reduce(Object.keys(objectsTypes), async (versioned, type) => {
            const objectType = objectsTypes[type]
            const object = relatedObjects[type]
            let versionedObject

            if (object) {
              versionedObject = await applyObjectChanges({
                fromVersion,
                toVersion: apiVersion,
                target: objectType,
                params: {
                  result: _.cloneDeep(object) // to avoid mutating the same object during transformation
                }
              })
              versionedObject = versionedObject.result
            }

            versioned[type] = object ? versionedObject : null
            return versioned
          }, {})

          Object.assign(workflowsCtx[apiVersion], versionedObjects)
        })
      }

      const workflowsHaveEnvVariables = workflows.some(w => !_.isEmpty(w.context))
      if (workflowsHaveEnvVariables) {
        const { stelace: systemConfig } = await configRequester.send({
          type: '_getConfig',
          platformId,
          env,
          access: 'private'
        })

        if (systemConfig.workflow) {
          const { contexts } = systemConfig.workflow
          workflows.forEach(w => {
            if (_.isEmpty(w.context)) return
            envVariables[w.id] = w.context.reduce((env, c) => Object.assign(env, contexts[c]), {})
          })
        }
      }

      if (workflows.length) {
        vm = new VM({
          timeout: 1000,
          sandbox: {
            computed: {},
            body: {},
            ctx: workflowsCtx,
            endpointUri: '',
            lastResponses: [],
            responses: {},
            statusCode: null,
            env: {} // envVariables selectively populated for each workflow
          }
        })

        // Expose all lodash methods, version 4.7.x
        // Users must be informed before any major or minor version updates
        // but (security) patch updates should be applied on an ongoing basis.
        vm.freeze(_, '_')

        // Expose Intl with all loaded locales
        vm.freeze(global.Intl, 'Intl')
      }

      let currentWorkflowId

      prepareWorkflowsTransaction.end()

      let apmSpans = {}

      // use mapSeries to save some logging and debugging headaches
      // Otherwise runId and currentWorkflowId can be overwritten by concurrent workflows
      await bluebird.mapSeries(workflows, async workflow => {
        if (_.isEmpty(workflow.run)) return

        const singleWorkflowTransaction = apm.startTransaction('Execute Workflow', 'workflow')
        singleWorkflowTransaction.action = workflow.name
        apm.setUserContext({ id: platformId })
        apm.addLabels({ env, platformId, eventType: event.type })
        apm.setCustomContext({ workflowId: workflow.id })

        apmSpans.fetchStats = apm.startSpan('Update nbTimesRun')

        runId = Uuid.v4()
        currentWorkflowId = workflow.id

        const initialComputedScript = _getComputedValuesScript(workflow.computed, { reset: true })
        const lastResponses = [] // array of responses
        const responses = {} // step name -> response

        const knex = Workflow.knex()
        await Workflow.query().where('id', currentWorkflowId).patch({
          stats: knex.raw(
            // Playground http://www.sqlfiddle.com/#!17/1f4566/8
            'jsonb_set(stats, \'{nbTimesRun}\', (COALESCE(stats->>\'nbTimesRun\',\'0\')::int + 1)::text::jsonb)'
          )
        })

        apmSpans.fetchStats && apmSpans.fetchStats.end()

        apmSpans.allRuns = apm.startSpan('Workflow run steps')

        try {
          // Execute each workflow run step serially
          await bluebird.reduce(workflow.run, async (previousStepLog, workflowStep, i) => {
            const runApmSpan = apm.startSpan(`Run step ${i}`)

            const handledErr = i > 0 && workflow.run[i - 1].handleErrors

            const isPreviousStepStopped = previousStepLog.type === 'stopped'
            const hasPreviousStepError = ['preRunError', 'runError'].includes(previousStepLog.type)

            if (isPreviousStepStopped) return previousStepLog
            if (hasPreviousStepError && !handledErr) return previousStepLog

            // update computed object in each step
            const currentStepComputedScript = _getComputedValuesScript(workflowStep.computed)
            const computedScript = `${i === 0 ? initialComputedScript : ''};${currentStepComputedScript}`

            const prepareWorkflowSpan = apm.startSpan('Prepare workflow step')

            const {
              passFilter,
              skipStep,
              endpointUri,
              endpointPayload,
              endpointHeaders,
              prepareWorkflowError
            } = prepareWorkflowStep({
              workflow,
              workflowStep,
              previousStepLog,
              envVariables,
              computedScript,
              lastResponses,
              responses
            })

            prepareWorkflowSpan && prepareWorkflowSpan.end()

            try {
              if (prepareWorkflowError) {
                return WorkflowLog.query().insert({
                  id: await getObjectId({ prefix: WorkflowLog.idPrefix, platformId, env }),
                  workflowId: currentWorkflowId,
                  eventId: event.id,
                  runId,
                  type: 'preRunError',
                  statusCode: prepareWorkflowError.statusCode || null,
                  step: _getWorkflowLogStep({ error: true }),
                  metadata: _.omit(prepareWorkflowError, 'statusCode')
                })
              }

              if (passFilter && !skipStep) {
                debug(`endpointUri: ${endpointUri}\n`)
                debug(`endpointPayload: ${JSON.stringify(endpointPayload, null, 2)}\n`)
                debug(`endpointHeaders: ${JSON.stringify(endpointHeaders, null, 2)}\n`)

                return executeWorkflowStep({
                  workflow,
                  workflowStep,
                  endpointUri,
                  endpointPayload,
                  endpointHeaders,
                  lastResponses,
                  responses,
                  WorkflowLog
                })
              } else {
                debug(`passFilter: ${passFilter}\nskipStep: ${skipStep}`)
              }

              let type
              if (!passFilter) type = 'stopped'
              else if (skipStep) type = 'skipped'

              return WorkflowLog.query().insert({
                id: await getObjectId({ prefix: WorkflowLog.idPrefix, platformId, env }),
                workflowId: currentWorkflowId,
                eventId: event.id,
                runId,
                type,
                step: _getWorkflowLogStep({ workflowStep }),
                metadata: _getWorkflowLogMetadata({ workflowStep, endpointUri, endpointHeaders, event })
              })
            } finally {
              runApmSpan && runApmSpan.end()
            }
          }, { // init reduce’s memo to some value to start running steps
            type: 'success'
          }).then(lastLog => {
            if (workflow.notifyUrl) {
              return notifyAfterCompleted({
                workflow,
                lastLog,
                event,
                exposedEvent,
                WorkflowLog,
                runId,
                platformId,
                env
              })
            }
          })
        } catch (err) {
          apm.captureError(err)

          logError(err.response ? err.response.body : err, {
            platformId,
            env,
            custom: {
              workflowId: currentWorkflowId.id,
              eventId: event.id,
              runId
            },
            message: 'Fail to execute stelace workflow'
          })
        } finally {
          if (apmSpans.allRuns) apmSpans.allRuns.end()
          apmSpans = {} // clean for garbage collection
          singleWorkflowTransaction.end()
        }
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { eventId: event.id },
        message: `Fail to handle ${event.type} event in workflow service`
      })
    }

    async function fetchRelatedObjects ({
      relatedObjectsObject = {},
      platformId,
      env
    }) {
      const Models = await getModels({ platformId, env })

      // map property to object type for versioning
      // (key: value) => (owner: 'user')
      const objectsTypes = {}

      const objectsPromises = {}

      for (const objectId in relatedObjectsObject) {
        const objectType = objectId.replace(/Id$/, '')

        // we need the model type below for related resources versioning
        const modelType = ((type) => {
          // cf. Event relatedObjectsWhitelist
          if (/^assetType/.test(type)) return 'assetType'
          else if (/^category/.test(type)) return 'category'
          else if (/^asset/.test(type)) return 'asset'
          else if (/^owner|^taker|^user/.test(type)) return 'user'
          else if (/^transaction/.test(type)) return 'transaction'
        })(objectType)

        objectsTypes[objectType] = modelType

        const { Model } = getModelInfo({ objectType: modelType, Models })

        if (Model) {
          const id = relatedObjectsObject[objectId]
          const { idPrefix } = getModelInfo({ objectId: id })

          // the model ID can be a non-UUID
          // because we allow external IDs for object user
          // so the PostgreSQL query will fail
          // in this case, set the object to `null`
          const isValidRelatedObjectId = isValidObjectId({
            id,
            prefix: idPrefix || Model.idPrefix,
            platformId,
            env
          })
          if (isValidRelatedObjectId) {
            objectsPromises[objectType] = Model.query()
              .findById(id)
              .execute()
          } else {
            objectsPromises[objectType] = Promise.resolve(null)
          }
        } else {
          const error = new Error(`Unknown event related object ${objectId} that can’t be mapped to a Model`)

          logError(error, {
            platformId,
            env,
            custom: {
              relatedObjectsIds: relatedObjectsObject,
              eventId: event.id
            },
            message: error.message
          })
        }
      }

      return {
        objectsTypes,
        objectsPromises
      }
    }

    /**
     * Prepares single workflow step, handles vm errors.
     * @param {Object} params
     * @param {Object} params.workflow
     * @param {Object} params.workflowStep
     * @param {Object} params.previousStepLog - useful for custom error handling
     * @param {Object} params.envVariables
     * @param {Object} params.computedScript
     * @param {Array} params.lastResponses
     * @param {Object} params.responses - keys are step names mapping to response objects,
     *   making use and maintenance much easier than with `lastResponses` array.
     * @return {Object}
     */
    function prepareWorkflowStep ({
      workflow,
      workflowStep,
      previousStepLog,
      envVariables,
      computedScript,
      lastResponses,
      responses
    }) {
      let error, prepareWorkflowError
      let passFilter, skipStep

      let endpointUri, endpointHeaders, endpointPayload

      // ensure clean payload object
      vm.run(`apiVersion = "${workflow.apiVersion}"; body = {};`)

      // Payload can have nested object and array values we need to reproduce in evaluated script
      const payloadScript = _populateScriptObjectValues(workflowStep.endpointPayload)

      const headersScript = _.reduce(workflowStep.endpointHeaders || {}, (script, v, k) => {
        const headerName = k.toLowerCase()
        // header values are expected to be (template) strings without extra quotes
        return `${script};headers['${headerName}'] = \`${v}\``
      }, 'var headers = {}')

      const now = new Date()
      debug('\nstart running vm (0ms)\n')

      vm.run(`lastResponses = ${
        JSON.stringify(lastResponses)
      };ctx[apiVersion].lastResponses = lastResponses`)
      vm.run(`responses = ${JSON.stringify(responses)};ctx[apiVersion].responses = responses`)

      vm.run(`statusCode = ${previousStepLog.statusCode}`)

      // TODO: push syntax errors in try/catch statements below in an array
      // Instead of logging only the last one

      // Run once for each workflow
      if (envVariables[workflow.id]) {
        const envVariablesScript = _getEnvironmentVariablesScript(envVariables[workflow.id])
        try {
          // Debugging with keys only for security reasons even if this should not be used
          // in production environment
          debug(`envVariables:\n ${
            Object.keys(envVariables[workflow.id]).join('\n')
          }\n`)
          vm.run(envVariablesScript)
        } catch (err) {
          error = _transformVmError({
            err,
            when: 'in computed properties',
            script: process.env.NODE_ENV !== 'test' ? '[REDACTED]' : envVariablesScript
          })
        }
      }

      // Exposing these as globals.
      // We save keys to reset to undefined once we’re done with this workflow (step).
      const ctxKeys = vm.run(
        `Object.keys(ctx[apiVersion]).filter(k => !['${
          // already globals
          ['apiVersion', 'computed', 'lastResponses', 'responses'].join("', '")
        }'].includes(k))`
      )
      vm.run(`${ctxKeys.map(k => `var ${k} = ctx[apiVersion].${k};`).join('')}`)

      try {
        debug(`\ncomputedScript ${computedScript}\n`)
        vm.run(computedScript)
      } catch (err) {
        error = _transformVmError({
          err,
          when: 'in computed properties',
          script: computedScript
        })
      }
      try {
        const stop = workflowStep.stop && Boolean(vm.run(workflowStep.stop))
        passFilter = !stop && (!workflowStep.filter || Boolean(vm.run(workflowStep.filter)))
        skipStep = workflowStep.skip && Boolean(vm.run(workflowStep.skip))
      } catch (err) {
        error = _transformVmError({
          err,
          when: 'in filters',
          script: {
            filter: workflowStep.filter,
            stop: workflowStep.stop,
            skip: workflowStep.skip
          }
        })
      }

      // Scripts must not evaluated as filters can be used to avoid reference errors
      if (!passFilter || skipStep) return errorOrResult()

      try {
        debug(`\npayloadScript ${payloadScript}\n`)
        vm.run(payloadScript)
      } catch (err) {
        error = _transformVmError({
          err,
          when: 'when building endpoint payload',
          script: payloadScript
        })
      }
      try { vm.run(headersScript) } catch (err) {
        error = _transformVmError({
          err,
          when: 'when building endpoint headers',
          script: headersScript
        })
      }
      try {
        vm.run(`endpointUri = \`${workflowStep.endpointUri}\``)
      } catch (err) {
        error = _transformVmError({
          err,
          when: 'when building endpoint URL',
          script: workflowStep.endpointUri
        })
      }

      /* eslint-disable prefer-const */
      endpointUri = vm.run('endpointUri')
      endpointPayload = vm.run('body')
      endpointHeaders = vm.run('headers')
      /* eslint-enable prefer-const */

      debug(`vm apiVersion: ${vm.run('apiVersion')}\n\n`)
      // debug(`vm lastResponses: ${JSON.stringify(vm.run('lastResponses'), null, 2)}\n\n`)
      debug(`vm ctx: ${JSON.stringify(vm.run('ctx[apiVersion]'), null, 2)}\n\n`)
      debug(`vm computed: ${JSON.stringify(vm.run('computed'), null, 2)}\n\n`)

      return errorOrResult()

      function errorOrResult () {
        // Deleting globals for next runs
        vm.run(`${ctxKeys.map(k => `${k} = undefined;`).join('')}`)
        debug(`\n\nstop running vm (+${new Date() - now}ms)\n\n`)

        if (error) {
          logError(error, {
            platformId,
            env,
            custom: {
              workflowId: workflow.id,
              run: workflowStep,
              runId,
              eventId: event.id,
              objectId: event.objectId
            },
            message: 'Fail to prepare Stelace Workflow'
          })

          const log = _getWorkflowLogMetadata({
            workflowStep,
            endpointUri,
            endpointHeaders,
            endpointPayload,
            event
          })

          prepareWorkflowError = _updatedLogWithErrorDetails({ log, err: error })
        }

        return {
          passFilter,
          skipStep,
          endpointUri,
          endpointPayload,
          endpointHeaders,
          prepareWorkflowError
        }
      }
    }

    /**
     * Executes single workflow step, handles errors and logging
     * @param {Object} params
     * @param {Object} params.workflow
     * @param {Object} params.workflowStep
     * @param {String} params.endpointUri
     * @param {Object} params.endpointPayload
     * @param {Object} params.endpointHeaders
     * @param {Array} params.lastResponses
     * @param {Object} params.WorkflowLog - Model
     * @return {Promise} workflow log
     */
    async function executeWorkflowStep ({
      workflow,
      workflowStep,
      endpointUri,
      endpointPayload,
      endpointHeaders,
      lastResponses,
      responses,
      WorkflowLog
    }) {
      const method = workflowStep.endpointMethod.toLowerCase()

      const isInternalApiEndpoint = endpointUri.startsWith('/')
      const stelaceHeaders = isInternalApiEndpoint ? {
        // WARNING: internal values must not be exposed
        'x-platform-id': platformId,
        'x-stelace-env': env,
        'x-stelace-workflow-key': localInstanceKey,
        'x-stelace-version': workflow.apiVersion
        // 'x-stelace-workflows': '' // TODO: sequence of workflows to avoid infinite loops
      } : {
        'x-webhook-source': 'stelace'
      }

      const headers = Object.assign({}, endpointHeaders, stelaceHeaders)

      const log = _getWorkflowLogMetadata({
        workflowStep,
        endpointUri,
        endpointHeaders,
        endpointPayload,
        event
      })
      const endpointUrl = isInternalApiEndpoint ? `${apiBase}${endpointUri}` : endpointUri
      let isError

      return request[method](endpointUrl)
        .send(endpointPayload) // superagent converts this to query string when using GET method
        .set(headers)
        .timeout({
          // Should be enough for Stelace batch call endpoint with 100 objects (currently maximum)
          response: 15000, // For concurrency of 4 in batch service it takes (100/4) * 400ms = 10000ms
          deadline: 30000 // Twice as much in case of slow response download
          // but we need reasonable value as well to prevent huge file download / infinite buffering
        })
        .catch(err => {
          isError = true
          _updatedLogWithErrorDetails({ log, err })

          if (err.status) return err.response // let user handle HTTP error if they want to

          // If there is no status it’s probably related to unhandled Workflow code error,
          // or it’s a Stelace error.
          logError(err.response ? err.response.body : err, {
            platformId,
            env,
            custom: {
              workflowId: workflow.id,
              run: workflowStep,
              runId,
              eventId: event.id,
              objectId: event.objectId
            },
            message: 'Fail to execute Stelace Workflow'
          })

          return {} // no response body to save below
        })
        // ensuring length consistency when response is missing due to error
        // but some steps can still be skipped and not included in responses/lastResponses
        .then(async (res) => {
          const body = res.body || null
          lastResponses.unshift(body)

          const stepName = workflowStep.name
          if (stepName) responses[stepName] = body

          const workflowLog = await WorkflowLog.query().insert({
            id: await getObjectId({ prefix: WorkflowLog.idPrefix, platformId, env }),
            workflowId: workflow.id,
            eventId: event.id,
            runId,
            type: isError ? 'runError' : 'action',
            statusCode: log.statusCode || res.statusCode,
            step: _getWorkflowLogStep({ workflowStep }),
            metadata: _.omit(log, 'statusCode')
          })

          return workflowLog
        })
    }
  })
}

/**
 * Calls workflow notifyUrl remote address once done or after errors handling
 * @private
 * @param {Object} params
 * @param {Object} params.workflow
 * @param {Object} params.lastLog - last workflow step log
 * @param {Object} params.event
 * @param {Object} params.exposedEvent
 * @param {Object} params.WorkflowLog - Model
 * @param {String} params.runId
 * @param {String} params.platformId
 * @param {String} params.env
 * @return {Object} created workflowLog
 */
async function notifyAfterCompleted ({
  workflow,
  lastLog,
  event,
  exposedEvent,
  WorkflowLog,
  runId,
  platformId,
  env
}) {
  const payload = {
    event: exposedEvent,

    // needs to pass `type` as skipped, stopped and error information isn't in step object anymore
    type: lastLog.type,

    lastStep: lastLog.step,
    workflowId: workflow.id,
    workflowName: workflow.name,
    runId
  }

  const logDetails = _getWorkflowLogMetadata({
    event,
    notify: {
      url: workflow.notifyUrl,
      payload,
    }
  })
  let statusCode

  return request.post(workflow.notifyUrl)
    .timeout({
      deadline: 10000 // ensures we’re not getting stuck here
    })
    .send(payload)
    .set({
      'x-webhook-source': 'stelace'
    })
    .then(res => {
      statusCode = res.statusCode
    })
    .catch(err => {
      logError(err.response ? err.response.body : err, {
        platformId,
        env,
        custom: {
          workflowId: workflow.id,
          eventId: event.id,
          objectId: event.objectId
        },
        message: 'Fail to notify workflow'
      })

      return _updatedLogWithErrorDetails({ log: logDetails, err })
    })
    .then(async () => {
      const workflowLog = await WorkflowLog.query().insert({
        id: await getObjectId({ prefix: WorkflowLog.idPrefix, platformId, env }),
        workflowId: workflow.id,
        eventId: event.id,
        runId,
        type: 'notification', // isError ? 'notificationError' : 'notification'
        statusCode: logDetails.statusCode || statusCode,
        step: _getWorkflowLogStep({ name: 'workflowWebhook' }),
        metadata: _.omit(logDetails, 'statusCode')
      })

      return workflowLog
    })
}

function _getWorkflowLogMetadata ({
  workflowStep = { endpointMethod: 'POST' }, // notification type
  event = {},
  endpointUri,
  endpointHeaders,
  endpointPayload,
  notify
}) {
  const details = {
    endpointMethod: (workflowStep.endpointMethod || '').toUpperCase(),
    endpointHeaders: endpointHeaders || workflowStep.endpointHeaders,
    endpointPayload: endpointPayload || workflowStep.endpointPayload,
    endpointUri: endpointUri || workflowStep.endpointUri,
    eventObjectId: event.objectId
  }
  if (!_.isEmpty(notify)) {
    details.notifyUrl = notify.url
    details.notifyPayload = notify.payload
  }

  return details
}

function _getWorkflowLogStep ({ workflowStep = {}, name }) {
  return {
    name: name || workflowStep.name || null,
    handleErrors: workflowStep.handleErrors || false,
  }
}

/**
 * Updates log with error statusCode, statusCodeName and message if available
 * @private
 * @param {Object} params
 * @param {Object} params.log - log to populate
 * @param {Object} params.err - can be a plain error (JS error) or a request object (superagent)
 * @return {Object} updated log
 */
function _updatedLogWithErrorDetails ({ log, err }) {
  const logWhitelist = ['statusCode', 'message', 'script']

  _.defaults(
    log,
    _.pick(err.response ? err.response.body : err, logWhitelist),
    _.pick(err.response, logWhitelist)
  )
  if (log.statusCode) log.statusCodeName = http.STATUS_CODES[log.statusCode]

  return log
}

function _transformVmError ({ err, when, script }) {
  let newError
  if (err.statusCode === 422) {
    newError = err // keep own precise error message
  } else if (err.message.includes('timed out')) {
    newError = createError(422, `Script execution timed out ${when}`, { script })
  } else if (err.name.includes('Error')) {
    newError = createError(err.statusCode || 422, `${err.name} ${when}: ${err.message}`, { script })
  } else {
    newError = _.defaults(err, { statusCode: 500 })
  }

  return newError
}

function _getComputedValuesScript (computedObject, { reset } = {}) {
  const script = reset ? 'computed = {}; ctx[apiVersion].computed = computed;' : ''

  return _populateScriptObjectValues(computedObject, '', { objectName: 'computed', script })
}

/**
 * Payload or computed objects can have nested object
 * and array values we need to reproduce in evaluated script.
 */
function _populateScriptObjectValues (object, path = '', { objectName = 'body', script = '' } = {}) {
  _.forEach(object, (value, key) => {
    const fullPath = `${path}[${
      Number.isFinite(key) ? key : `'${key}'` // array index must remain a number
    }]`

    if (Array.isArray(value)) {
      script += `${objectName}${fullPath} = [];`
      value.forEach((val, i) => {
        const accessor = `${fullPath}[${i}]`
        if (Array.isArray(val)) {
          script += `${objectName}${accessor} = [];`
          script = _populateScriptObjectValues(val, accessor, { objectName, script })
        } else if (_.isObjectLike(val)) { // we know it’s not an array
          script += `${objectName}${accessor} = {};`
          script = _populateScriptObjectValues(val, accessor, { objectName, script })
        } else {
          script += `${objectName}${fullPath}.push(${val});`
        }
      })
    } else if (_.isObjectLike(value)) { // we know it’s not an array
      script += `${objectName}${fullPath} = {};`
      script = _populateScriptObjectValues(value, fullPath, { objectName, script })
    } else {
      script += `${objectName}${fullPath} = ${value};`
    }
  })
  return script
}

function _getEnvironmentVariablesScript (envVariables) {
  return _.reduce(envVariables, (script, v, k) => {
    if ([v, k].some(s => typeof s !== 'string')) return script
    // any double quotes in variable name or content must be escaped
    return `${script} env["${k.replace(/"/g, '\\"')}"] = "${v.replace(/"/g, '\\"')}";`
  }, 'env = {};')
}

function stop () {
  responder.close()
  responder = null

  eventSubscriber.close()
  eventSubscriber = null

  configRequester.close()
  configRequester = null
}

module.exports = {
  start,
  stop
}
