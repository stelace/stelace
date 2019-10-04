const _ = require('lodash')

const wildcardState = '*'

function computeTransitionsMeta ({ transitions, initState }) {
  let fromStates = []
  let toStates = []
  let allStates = []

  transitions.forEach(transition => {
    if (transition.from !== wildcardState) {
      fromStates.push(transition.from)
    }

    // no wildcard possible for "to" states
    toStates.push(transition.to)
  })

  fromStates = _.uniqBy(fromStates)
  toStates = _.uniqBy(toStates)
  allStates = _.uniqBy(fromStates.concat(toStates))

  const initStates = _.difference(fromStates, toStates)
  const endStates = _.difference(toStates, fromStates)

  const futureStates = getFutureStates({ transitions, currentState: initState, excludeCurrentState: false })

  return {
    fromStates,
    toStates,
    allStates,
    initStates,
    endStates,
    notUsedStates: _.difference(futureStates, allStates)
  }
}

function getFutureStates ({ transitions, currentState, excludeCurrentState = true } = {}) {
  const indexedFromStates = _.groupBy(transitions, 'from')
  const doneStates = {}
  let futureStates = []

  _computeFutureStates({ state: currentState, doneStates, futureStates, indexedFromStates })

  futureStates = _.uniq(futureStates)

  if (excludeCurrentState) {
    futureStates = _.without(futureStates, currentState)
  }

  return futureStates
}

function _computeFutureStates ({ state, doneStates, futureStates, indexedFromStates }) {
  if (doneStates[state]) return

  doneStates[state] = true
  futureStates.push(state)

  const stateTransitions = indexedFromStates[state]
  if (!stateTransitions || !stateTransitions.length) {
    return
  }

  const tmpFutureStates = stateTransitions.map(t => t.to)

  tmpFutureStates.forEach(futureState => {
    _computeFutureStates({ state: futureState, doneStates, futureStates, indexedFromStates })
  })
}

function getTransition ({ name, transitions, from }) {
  return transitions.find(transition => {
    return transition.name === name &&
      (transition.from === from || transition.from === wildcardState)
  })
}

module.exports = {
  computeTransitionsMeta,
  getFutureStates,
  getTransition
}
