const _ = require('lodash')
const { getModels, getModelInfo } = require('../models')
const Base = require('../models/Base')

let responder

function start ({ communication }) {
  const {
    getResponder
  } = communication

  responder = getResponder({
    name: 'Namespace Responder',
    key: 'namespace'
  })

  // determine dynamic built-in namespaces like private and protected namespaces
  responder.on('getDynamicNamespaces', async (req) => {
    const { platformId, env } = req

    const {
      readNamespaces = [], // list of read namespaces
      editNamespaces = [], // list of edit namespaces
      listObjects, // use `object` or `listObjects` to get namespaces from one object or a list of objects
      object,
      deltaObject, // used when an update is happening
      currentUserId, // the current user ID
      readActive = true, // if true, compute dynamic read namespaces
      editActive = true // if true, compute dynamic edit namespaces
    } = req

    if (object) {
      const revealedAfterTransaction = await getTransactionNamespacesVisibility({
        platformId,
        env,
        object,
        currentUserId
      })

      const {
        dynamicReadNamespaces,
        dynamicEditNamespaces,
        isValidEditNamespaces
      } = getDynamicNamespacesForObject({
        readNamespaces,
        editNamespaces,
        currentUserId,
        object,
        deltaObject,
        revealedAfterTransaction,
        readActive,
        editActive
      })

      return {
        dynamicReadNamespaces,
        dynamicEditNamespaces,
        isValidEditNamespaces
      }
    } else {
      const hash = {}

      listObjects.forEach(object => {
        const {
          dynamicReadNamespaces
        } = getDynamicNamespacesForObject({
          readNamespaces,
          currentUserId,
          object,
          readActive,
          editActive: false
        })

        hash[object.id] = { dynamicReadNamespaces }
      })

      return hash
    }
  })
}

/**
 * Currently only protected namespace is supported and really dynamic depending on transaction status
 */
async function getTransactionNamespacesVisibility ({ platformId, env, object, currentUserId }) {
  const { Transaction } = await getModels({ platformId, env })
  const userId = getUserIdFromObj(object)

  if (!currentUserId || !userId) return {}

  // Find all transactions between these users to check if they can see namespace protected data
  const transactions = await Transaction.query()
    .where(builder => {
      builder.where('ownerId', userId)
        .orWhere('takerId', userId)
    })
    .where(builder => {
      builder.where('ownerId', currentUserId)
        .orWhere('takerId', currentUserId)
    })

  return transactions.reduce((revealedNamespaces, transaction) => {
    const namespacesConfig = transaction.assetType.namespaces || {}
    const visibilityConfig = namespacesConfig.visibility || {}

    // '_protected' namespace is revealed once transaction reach 'validated' status by default
    if (!visibilityConfig.protected) visibilityConfig.protected = ['validated']

    Object.keys(visibilityConfig).forEach(namespace => {
      const visibilitySteps = visibilityConfig[namespace]
      const reveal = transaction.statusHistory.some(h => visibilitySteps.includes(h.status))
      revealedNamespaces[namespace] = revealedNamespaces[namespace] || reveal
    })

    return revealedNamespaces
  }, {})
}

function getDynamicNamespacesForObject ({
  readNamespaces,
  editNamespaces,
  currentUserId,
  object,
  deltaObject,
  revealedAfterTransaction,
  readActive,
  editActive
}) {
  const result = {}

  if (readActive) {
    const hasReadAccessNamespaceFn = retrieveGetAccessNamespaceFn('read')

    const { dynamicReadNamespaces } = getReadDynamicNamespaceForObject({
      readNamespaces,
      currentUserId,
      object,
      hasAccessNamespaceFn: hasReadAccessNamespaceFn,
      revealedAfterTransaction
    })

    result.dynamicReadNamespaces = dynamicReadNamespaces
  } else {
    result.dynamicReadNamespaces = []
  }

  if (editActive) {
    const hasEditAccessNamespaceFn = retrieveGetAccessNamespaceFn('edit')

    const { dynamicEditNamespaces, isValidEditNamespaces } = getEditDynamicNamespaceForObject({
      editNamespaces,
      currentUserId,
      object,
      deltaObject,
      hasAccessNamespaceFn: hasEditAccessNamespaceFn,
      revealedAfterTransaction
    })

    result.dynamicEditNamespaces = dynamicEditNamespaces
    result.isValidEditNamespaces = isValidEditNamespaces
  } else {
    result.dynamicEditNamespaces = []
    result.isValidEditNamespaces = true
  }

  return result
}

function getReadDynamicNamespaceForObject ({
  readNamespaces,
  currentUserId,
  object,
  hasAccessNamespaceFn,
  revealedAfterTransaction
}) {
  if (readNamespaces.includes('*')) {
    return { dynamicReadNamespaces: readNamespaces }
  }

  const dataNamespaces = Base.getDataNamespaces(object)
  const objectType = getModelInfo({ objectId: object.id }).objectType
  const userId = getUserIdFromObj(object)

  // add the private namespace even if it's not present in data or platformData
  // because it is used for username visibility
  if (objectType === 'user' && !dataNamespaces.includes('private')) {
    dataNamespaces.push('private')
  }

  const addedReadNamespaces = []

  const missingNamespaces = _.difference(dataNamespaces, readNamespaces)

  missingNamespaces.forEach(namespace => {
    const hasAccess = hasAccessNamespaceFn(namespace, {
      userId,
      currentUserId,
      revealedAfterTransaction
    })
    if (hasAccess) addedReadNamespaces.push(namespace)
  })

  return {
    dynamicReadNamespaces: _.uniq(readNamespaces.concat(addedReadNamespaces))
  }
}

function getEditDynamicNamespaceForObject ({
  editNamespaces,
  currentUserId,
  object,
  deltaObject,
  hasAccessNamespaceFn,
  revealedAfterTransaction
}) {
  if (editNamespaces.includes('*')) {
    return {
      dynamicEditNamespaces: editNamespaces,
      isValidEditNamespaces: true
    }
  }

  const dataNamespaces = Base.getDataNamespaces(deltaObject || object)
  const userId = getUserIdFromObj(object)

  const addedEditNamespaces = []

  const missingNamespaces = _.difference(dataNamespaces, editNamespaces)

  missingNamespaces.forEach(namespace => {
    const hasAccess = hasAccessNamespaceFn(namespace, {
      userId,
      currentUserId,
      revealedAfterTransaction
    })
    if (hasAccess) addedEditNamespaces.push(namespace)
  })

  const differenceNamespaces = _.difference(missingNamespaces, addedEditNamespaces)

  return {
    dynamicEditNamespaces: _.uniq(editNamespaces.concat(addedEditNamespaces)),
    isValidEditNamespaces: !differenceNamespaces.length
  }
}

function retrieveGetAccessNamespaceFn (actionType) {
  if (actionType === 'edit') return getEditAccessNamespaces
  else return getReadAccessNamespaces
}

function getReadAccessNamespaces (namespace, { userId, currentUserId, revealedAfterTransaction }) {
  const isSelf = userId === currentUserId
  if (namespace === 'private') return isSelf
  else if (namespace === 'protected') return isSelf || _.get(revealedAfterTransaction, 'protected')
  else return false
}

function getEditAccessNamespaces (namespace, { userId, currentUserId }) {
  const isSelf = userId === currentUserId
  return (namespace === 'private' || namespace === 'protected') && isSelf
}

function getUserIdFromObj (object) {
  const { objectType: type } = getModelInfo({ objectId: object.id })
  let userId = ''

  if (type === 'user') userId = object.id
  else if (type === 'asset') userId = object.ownerId

  return userId
}

function stop () {
  responder.close()
  responder = null
}

module.exports = {
  start,
  stop
}
