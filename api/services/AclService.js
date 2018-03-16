/* global StelaceConfigService */

module.exports = {

    getListPermissions,
    getBasicRoles,
    refresh,

    isAllowed,
    isAllowedByRole,
    isAllowedByPlan,

    getAllowedPermissions,
    getUserPermissions,
    getApiKeyPermissions,
    getPlanPermissions,

};

const { Acl } = require('virgen-acl');
const Promise = require('bluebird');
const _ = require('lodash');

const basicRoles = [
    'admin',
    'support',
    'developer',
    'contentManager',
    'seller',
    'user',
];

const permissions = [
    { resource: 'dashboard', actions: ['view'] },
    { resource: 'generalStats', actions: ['view'] },
    { resource: 'advancedStats', actions: ['view'] },
    { resource: 'userList', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'listingList', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'transactionList', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'translation', actions: ['view', 'edit'] },
    { resource: 'adminEditor', actions: ['view'] },
    { resource: 'editor', actions: ['view'] },
    { resource: 'settings', actions: ['view', 'edit'] },
    { resource: 'roles', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'listingCategory', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'listingType', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'api', actions: ['view'] },
    { resource: 'apiKey', actions: ['view', 'create', 'remove'] },
    { resource: 'apiCore', actions: ['view', 'edit'] },
    { resource: 'apiExtended', actions: ['view', 'edit'] },
    { resource: 'webhook', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'customDomain', actions: ['view', 'edit'] },
    { resource: 'customCode', actions: ['view', 'edit'] },
    { resource: 'customCss', actions: ['view', 'edit'] },
    { resource: 'customJs', actions: ['view', 'edit'] },

    { resource: 'listing', actions: ['view', 'create'] },
];

let planPermissions;
let acl;

async function getDefaultAcl() {
    const acl = new Acl();

    Promise.promisifyAll(acl);

    // ROLES
    acl.addRole('admin');
    acl.addRole('staff');
    acl.addRole('support', 'staff');
    acl.addRole('developer', 'staff');
    acl.addRole('contentManager', 'staff');

    acl.addRole('user');
    acl.addRole('seller', 'user');


    // RESOURCES
    acl.addResource('dashboard');
    acl.addResource('generalStats');
    acl.addResource('advancedStats');
    acl.addResource('userList');
    acl.addResource('listingList');
    acl.addResource('transactionList');
    acl.addResource('translation');
    acl.addResource('adminEditor');
    acl.addResource('editor');
    acl.addResource('settings');
    acl.addResource('listingCategory');
    acl.addResource('listingType');
    acl.addResource('api');
    acl.addResource('apiKey');
    acl.addResource('apiCore');
    acl.addResource('apiExtended');
    acl.addResource('webhook');
    acl.addResource('customDomain');
    acl.addResource('customCode');
    acl.addResource('customCss', 'customCode');
    acl.addResource('customJs', 'customCode');

    acl.addResource('listing');

    // PERMISSIONS
    acl.deny();
    acl.allow('admin');
    acl.allow('staff', 'dashboard');

    acl.allow('support', 'userList');
    acl.allow('support', 'listingList');
    acl.allow('support', 'transactionList');

    acl.allow('developer', 'userList', ['view']);
    acl.allow('developer', 'listingList', ['view']);
    acl.allow('developer', 'transactionList', ['view']);
    acl.allow('developer', 'listingCategory');
    acl.allow('developer', 'listingType');
    acl.allow('developer', 'settings');
    acl.allow('developer', 'api');
    acl.allow('developer', 'apiCore');
    acl.allow('developer', 'apiExtended');
    acl.allow('developer', 'webhook');
    acl.allow('developer', 'customDomain');
    acl.allow('developer', 'customCode');

    acl.allow('contentManager', 'editor');
    acl.allow('contentManager', 'translation');
    acl.allow('contentManager', 'customCode');

    acl.allow(null, 'listing', 'view');
    acl.allow('seller', 'listing', 'create');

    return acl;
}

function refresh() {
    planPermissions = null;
    acl = null;
}

async function getAcl({ refresh = false } = {}) {
    if (acl && !refresh) return acl;

    const newAcl = getDefaultAcl();
    await overrideAcl(acl);

    acl = newAcl;

    return acl;
}

async function overrideAcl(/* acl */) {
    // TODO
}

function getListPermissions() {
    return permissions;
}

function getBasicRoles() {
    return basicRoles;
}

function getPermissionKey(resource, action) {
    return `${resource}_${action}`;
}

async function getAllowedPermissions(roles) {
    const permissions = getListPermissions();

    const allowedPermissions = {};

    await Promise.each(permissions, async (permission) => {
        await Promise.each(permission.actions, async (action) => {
            const allowed = await isAllowed(roles, permission.resource, action);
            const key = getPermissionKey(permission.resource, action);
            allowedPermissions[key] = allowed;
        });
    });

    return allowedPermissions;
}

async function getUserPermissions(user) {
    const permissions = await getAllowedPermissions(user.roles);
    return permissions;
}

async function getApiKeyPermissions() {
    const permissions = await getAllowedPermissions('admin');
    return permissions;
}

async function _getPlanPermissions(planPermissions) {
    const permissions = getListPermissions();

    const allowedPermissions = {};

    const setAllPermissionActions = (permission, allowed) => {
        permission.actions.forEach(action => {
            const key = getPermissionKey(permission.resource, action);
            allowedPermissions[key] = allowed;
        });
    };

    // no plans, allow all permissions
    if (!planPermissions) {
        permissions.forEach(permission => {
            setAllPermissionActions(permission, true);
        });
    } else {
        const indexedPlanPermissions = _.indexBy(planPermissions, 'resource');

        permissions.forEach(permission => {
            const planPermission = indexedPlanPermissions[permission.resource];

            // set plan restrictions
            if (planPermission) {
                if (planPermission.actions === true) {
                    setAllPermissionActions(permission, true);
                } else if (planPermission.actions === false) {
                    setAllPermissionActions(permission, false);
                } else {
                    const indexedPlanActions = _.indexBy(planPermission.actions);

                    permission.actions.forEach(action => {
                        const planAction = indexedPlanActions[action];
                        const key = getPermissionKey(permission.resource, action);
                        allowedPermissions[key] = !!planAction;
                    });
                }
            // if plan permissions not found, set to false
            } else {
                setAllPermissionActions(permission, false);
            }
        });
    }

    return allowedPermissions;
}

async function getPlanPermissions({ refresh = false } = {}) {
    if (planPermissions && !refresh) return planPermissions;

    const plan = await StelaceConfigService.getPlan();

    const permissions = await _getPlanPermissions(plan ? plan.permissions : null);
    planPermissions = permissions;
    return planPermissions;
}

async function isAllowed(roles, resource, action) {
    const [
        allowedByRole,
        allowedByPlan,
    ] = await Promise.all([
        isAllowedByRole(roles, resource, action),
        isAllowedByPlan(resource, action),
    ]);

    return allowedByRole && allowedByPlan;
}

async function isAllowedByRole(roles, resource, action) {
    const acl = await getAcl();

    const allowed = await acl.queryAsync(roles, resource, action);
    return allowed;
}

async function isAllowedByPlan(resource, action) {
    const planPermissions = await getPlanPermissions();

    const key = getPermissionKey(resource, action);
    return planPermissions[key];
}
