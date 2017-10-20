(function () {
  var ConfigActions = {
      setConfig: setConfig,
  };

  function setConfig(config) {
      return {
          type: 'SET_CONFIG',
          config: config
      };
  }

  window.actions = window.actions || {};
  window.actions.ConfigActions = ConfigActions;
})();
