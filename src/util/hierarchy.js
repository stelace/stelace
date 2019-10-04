const _ = require('lodash')

function isValidHierarchy (elements, { idField = 'id', parentIdField = 'parentId', idFn, parentIdFn } = {}) {
  const checkedIds = {}
  let checkingIds = {}

  const indexedElements = _.keyBy(elements, idField)

  let valid = true

  const validateChain = (id) => {
    checkedIds[id] = true

    Object.keys(checkingIds).forEach(id => {
      checkedIds[id] = true
    })
    checkingIds = {}
  }

  const checkElement = (element) => {
    let id
    let parentId

    if (typeof idFn === 'function') {
      id = idFn(element)
    } else {
      id = element[idField]
    }

    if (typeof parentIdFn === 'function') {
      parentId = parentIdFn(element)
    } else {
      parentId = element[parentIdField]
    }

    // if there is no parent, the chain is valid
    if (typeof parentId === 'undefined' || parentId === null) {
      validateChain(id)
    } else {
      if (checkingIds[parentId]) { // if there is a circular dependency (parent is in the working chain)
        valid = false
      } else if (id === parentId) { // the element references itself as parent
        valid = false
      } else if (checkedIds[parentId]) { // the parent chain has already been validated
        validateChain(id)
      } else {
        checkingIds[id] = true // put in the working chain

        const parentElement = indexedElements[parentId]
        if (!parentElement) {
          valid = false
          return
        }

        checkElement(parentElement)
      }
    }
  }

  elements.forEach(element => {
    if (!valid) return

    checkElement(element)
  })

  return valid
}

module.exports = {
  isValidHierarchy
}
