(function () {
    var defaultState = {};

    function features(state, action) {
        if (typeof state === 'undefined') {
            state = defaultState;
        }

        var obj = {};
        switch (action.type) {
            case 'ENABLE_FEATURE':
                obj[action.name] = true;
                return _.assign({}, state, obj);
            case 'DISABLE_FEATURE':
                obj[action.name] = false;
                return _.assign({}, state, obj);
            case 'TOGGLE_FEATURE':
                obj[action.name] = !obj[action.name];
                return _.assign({}, state, obj);
            case 'SET_FEATURES':
                return _.assign({}, state, action.features);

            default:
                return state;
        }
    }

    window.reducers = window.reducers || {};
    window.reducers.features = features;
})();
