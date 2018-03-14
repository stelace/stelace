module.exports = {

    getListPermissions,

    isAllowed,
    getAllowedPermissions,
    getUserPermissions,
    getPlanPermissions,

};

const { Acl } = require('virgen-acl');
const Promise = require('bluebird');

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
    { resource: 'listingCategory', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'listingType', actions: ['view', 'create', 'edit', 'remove'] },
    { resource: 'api', actions: ['view', 'edit'] },
    { resource: 'webhook', actions: ['view', 'edit'] },
    { resource: 'customCode', actions: ['view', 'edit'] },
    { resource: 'customCss', actions: ['view', 'edit'] },
    { resource: 'customJs', actions: ['view', 'edit'] },

    { resource: 'listing', actions: ['view', 'create'] },
];

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
    acl.addResource('webhook');
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

    acl.allow('developer', 'userList', 'view');
    acl.allow('developer', 'listingList', 'view');
    acl.allow('developer', 'transactionList', 'view');
    acl.allow('developer', 'listingCategory');
    acl.allow('developer', 'listingType');
    acl.allow('developer', 'settings');
    acl.allow('developer', 'api');
    acl.allow('developer', 'webhook');
    acl.allow('developer', 'customCode');

    acl.allow('contentManager', 'editor');
    acl.allow('contentManager', 'translation');
    acl.allow('contentManager', 'customCode');

    acl.allow('seller', 'listing', 'create');

    return acl;
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

async function getAllowedPermissions(roles) {
    const permissions = getListPermissions();

    const allowedPermissions = {};

    await Promise.each(permissions, async (permission) => {
        await Promise.each(permission.actions, async (action) => {
            const allowed = await isAllowed(roles, permission.resource, action);
            const key = permission.resource + '_' + action;
            allowedPermissions[key] = allowed;
        });
    });

    return allowedPermissions;
}

async function getUserPermissions(user) {
    const permissions = await getAllowedPermissions(user.roles);
    return permissions;
}

async function getPlanPermissions() {

}

async function isAllowed(roles, resource, action) {
    const acl = await getAcl();

    const allowed = await acl.queryAsync(roles, resource, action);
    return allowed;
}
