(function () {
  var defaultState = {};

  function config(state, action) {
      if (typeof state === 'undefined') {
          state = defaultState;
      }

      switch (action.type) {
          case 'SET_CONFIG':
              return _.assign({}, state, action.config);

          default:
              return state;
      }
  }

  window.reducers = window.reducers || {};
  window.reducers.config = config;
})();
