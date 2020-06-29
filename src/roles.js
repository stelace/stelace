// Default roles

const _ = require('lodash')

const publicPermissions = getPublicPermissions()
const userPermissions = getUserPermissions()

module.exports = {
  dev: {
    name: 'Developer',
    value: 'dev',
    permissions: ['*'],
    readNamespaces: ['*'],
    editNamespaces: ['*'],
    parentId: null,
    customRole: false,
  },
  public: {
    name: 'Public',
    value: 'public',
    permissions: publicPermissions,
    readNamespaces: [],
    editNamespaces: [],
    parentId: null,
    customRole: false,
  },
  user: {
    name: 'User',
    value: 'user',
    permissions: userPermissions,
    readNamespaces: [],
    editNamespaces: [],
    parentId: null,
    customRole: false,
  },
  provider: {
    name: 'Provider',
    value: 'provider',
    permissions: _.union(userPermissions, [
      'asset:list',
      'asset:read',
      'asset:create',
      'asset:edit',
      'asset:remove',

      'availability:list',
      'availability:read',
      'availability:create',
      'availability:edit',
      'availability:remove'
    ]),
    readNamespaces: [],
    editNamespaces: [],
    parentId: null,
    customRole: false,
  },
  organization: {
    name: 'Organization',
    value: 'organization',
    permissions: [],
    readNamespaces: [],
    editNamespaces: [],
    parentId: null,
    customRole: false,
  },
  orgManager: {
    name: 'Organization manager',
    value: 'org-manager',
    permissions: [
      'user:edit:organization'
    ],
    readNamespaces: [],
    editNamespaces: [],
    parentId: null,
    customRole: false
  },
}

function getUserPermissions () {
  return _(publicPermissions)
    .union([
      'assessment:read',
      'assessment:edit',
      'assessment:sign',

      'transaction:list',
      'transaction:read',
      'transaction:create',
      'transaction:edit',
      'transaction:transition',

      'message:list',
      'message:read',
      'message:create',
      'message:edit',
      'message:remove',

      'organization:create',

      'rating:list',
      'rating:read',
      'rating:create',
      'rating:edit',

      'token:check',

      'order:preview',
      'order:list',
      'order:read',
      'order:create',

      'orderLine:read',
      // 'orderLine:create', // For financial reasons, only workflows/dev/secretKey can create those
      // We may need a new 'orderLine:charge' permission to allow positive lines only

      'orderMove:read',

      'savedSearch:list',
      'savedSearch:read',
      'savedSearch:create',
      'savedSearch:edit',
      'savedSearch:remove',

      'user:read',
      'user:edit',
      'user:remove',
      'user:configOrganization'
    ])
    .difference([
      'auth:login',
      'password:reset'
    ])
    .value()
}

function getPublicPermissions () {
  return [
    // 'apiKey:list:all',
    // 'apiKey:read',
    // 'apiKey:read:all',
    // 'apiKey:create:all',
    // 'apiKey:edit',
    // 'apiKey:edit:all',
    // 'apiKey:remove',
    // 'apiKey:remove:all',

    // 'assessment:list',
    // 'assessment:list:all',
    // 'assessment:read',
    // 'assessment:read:all',
    // 'assessment:create',
    // 'assessment:create:all',
    // 'assessment:edit',
    // 'assessment:edit:all',
    // 'assessment:sign',
    // 'assessment:sign:all',
    // 'assessment:config',
    // 'assessment:config:all',
    // 'assessment:remove',
    // 'assessment:remove:all',

    // 'asset:list',
    'asset:list:all', // granting this is consistent with granting `search:list:all`
    // 'asset:read',
    'asset:read:all',
    // 'asset:create',
    // 'asset:create:all',
    // 'asset:edit',
    // 'asset:edit:all',
    // 'asset:remove',
    // 'asset:remove:all',

    'assetType:list:all',
    'assetType:read:all',
    // 'assetType:create:all',
    // 'assetType:edit:all',
    // 'assetType:remove:all',

    'auth:login',
    // 'auth:impersonate'

    // 'availability:list',
    'availability:list:all',
    // 'availability:read',
    'availability:read:all',
    // 'availability:create',
    // 'availability:create:all',
    // 'availability:edit',
    // 'availability:edit:all',
    // 'availability:remove',
    // 'availability:remove:all',

    // 'transaction:list',
    // 'transaction:list:all',
    // 'transaction:read',
    // 'transaction:read:all',
    // 'transaction:create',
    // 'transaction:create:all',
    'transaction:preview:all',
    // 'transaction:edit',
    // 'transaction:edit:all',
    // 'transaction:config:all',
    // 'transaction:transition',
    // 'transaction:transition:all',

    'category:list:all',
    'category:read:all',
    // 'category:create:all',
    // 'category:edit:all',
    // 'category:remove:all',

    'config:read',
    // 'config:edit',

    'customAttribute:list:all',
    'customAttribute:read:all',
    // 'customAttribute:create:all',
    // 'customAttribute:edit:all',
    // 'customAttribute:remove:all',

    // 'document:stats:all',
    // 'document:list:all',
    // 'document:read:all',
    // 'document:create:all',
    // 'document:edit:all',
    // 'document:remove:all',

    'entry:list:all',
    'entry:read:all',
    // 'entry:create:all',
    // 'entry:edit:all',
    // 'entry:remove:all',

    // 'event:list:all',
    // 'event:read:all',
    'event:create:all', // can be useful for website tracking

    // 'platformData:edit:all',

    // 'message:list',
    // 'message:list:all',
    // 'message:read',
    // 'message:read:all',
    // 'message:create',
    // 'message:create:all',
    // 'message:edit',
    // 'message:edit:all',
    // 'message:remove',
    // 'message:remove:all',

    // 'organization:create',
    // 'organization:create:all',

    'password:reset',

    'rating:stats:all',
    // 'rating:list',
    'rating:list:all',
    // 'rating:read',
    'rating:read:all',
    // 'rating:create',
    // 'rating:create:all',
    // 'rating:edit',
    // 'rating:edit:all',
    // 'rating:remove',
    // 'rating:remove:all',

    'role:list:all',
    'role:read:all',
    // 'role:create:all',
    // 'role:edit:all',
    // 'role:remove:all',

    'search:list:all', // public search by default

    'signal:create',
    // 'signal:create:all',

    // 'token:check',

    // 'order:preview',
    // 'order:preview:all',
    // 'order:list',
    // 'order:list:all',
    // 'order:read',
    // 'order:read:all',
    // 'order:create',
    // 'order:create:all',
    // 'order:edit',
    // 'order:edit:all',

    // 'orderLine:read',
    // 'orderLine:read:all',
    // 'orderLine:create',
    // 'orderLine:create:all',
    // 'orderLine:edit',
    // 'orderLine:edit:all',

    // 'orderMove:read',
    // 'orderMove:read:all',
    // 'orderMove:create',
    // 'orderMove:create:all',
    // 'orderMove:edit',
    // 'orderMove:edit:all',

    // 'user:list',
    'user:list:all',
    // 'user:read',
    'user:read:all',
    'user:create'
    // 'user:create:all',
    // 'user:edit',
    // 'user:edit:all',
    // 'user:edit:organization',
    // 'user:remove',
    // 'user:remove:all',
    // 'user:config:all',
    // 'user:configOrganization'
    // 'user:configOrganization:all',

    // 'task:list:all',
    // 'task:read:all',
    // 'task:create:all',
    // 'task:edit:all',
    // 'task:remove:all',

    // 'webhook:list:all',
    // 'webhook:read:all',
    // 'webhook:create:all',
    // 'webhook:edit:all',
    // 'webhook:remove:all',

    // 'workflow:list:all',
    // 'workflow:read:all',
    // 'workflow:create:all',
    // 'workflow:edit:all',
    // 'workflow:remove:all'
  ]
}
