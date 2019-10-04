require('dotenv').config()

const test = require('ava')

const Base = require('../../../src/models/Base')

class CustomModel extends Base {
  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'name',
        'description',
        'metadata',
        'platformData'
      ]
    }

    return accessFields[access]
  }
}

test('merges the custom metadata object', (t) => {
  const element = {
    metadata: {
      color: 'blue',
      nbViews: 10,
      nestedObj: {
        a: true,
        anotherArray: [1, 2]
      },
      features: ['a', 'b']
    }
  }
  const newMetadata = {
    color: 'red',
    features: ['c'],
    nestedObj: {
      anotherArray: []
    }
  }

  t.deepEqual(Base.getCustomData(element, { metadata: newMetadata }), {
    color: 'red',
    nbViews: 10,
    nestedObj: {
      a: true,
      anotherArray: []
    },
    features: ['c']
  })
})

test('replaces the custom metadata object', (t) => {
  const element = {
    metadata: {
      color: 'blue',
      nbViews: 10,
      nestedObj: {
        a: true,
        anotherArray: [1, 2]
      },
      features: ['a', 'b']
    }
  }
  const newMetadata = {
    color: 'red',
    features: ['c'],
    nestedObj: {
      anotherArray: []
    },
    __replace__: true
  }

  t.deepEqual(Base.getCustomData(element, { metadata: newMetadata }), {
    color: 'red',
    features: ['c'],
    nestedObj: {
      anotherArray: []
    }
  })
})

test('checks that custom newData is correctly merged', (t) => {
  const element = {
    data: {
      a: 1
    },
    metadata: {
      b: 2
    },
    platformData: {
      c: 3
    }
  }
  const newData = {
    d: 4
  }

  t.deepEqual(Base.getCustomData(element, { newData, field: 'data' }), {
    a: 1,
    d: 4
  })
})

test('expose only authorized fields', (t) => {
  const element = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    createdDate: '2018-01-01T00:00:00.000Z',
    updatedDate: '2018-01-01T00:00:00.000Z',
    name: 'example',
    description: 'test',
    metadata: {},
    platformData: {}
  }

  t.deepEqual(CustomModel.expose(element), {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    createdDate: '2018-01-01T00:00:00.000Z',
    updatedDate: '2018-01-01T00:00:00.000Z',
    name: 'example',
    description: 'test',
    metadata: {},
    platformData: {}
  })

  const element2 = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    createdDate: '2018-01-01T00:00:00.000Z',
    updatedDate: '2018-01-01T00:00:00.000Z',
    name: 'example',
    description: 'test',
    color: 'blue',
    secret: '123',
    metadata: {},
    platformData: {}
  }

  t.deepEqual(CustomModel.expose(element2), {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    createdDate: '2018-01-01T00:00:00.000Z',
    updatedDate: '2018-01-01T00:00:00.000Z',
    name: 'example',
    description: 'test',
    metadata: {},
    platformData: {}
  })
})

test('hide namespaces by default', (t) => {
  const element = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _private: {
        test: true
      },
      _namespace: {
        number: 123
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _private: {
        test: false
      },
      _namespace: {
        number: 123
      }
    }
  }
  const expected = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      }
    }
  }

  t.deepEqual(CustomModel.expose(element), expected)
})

test('show allowed namespaces', (t) => {
  const element = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _private: {
        test: true
      },
      _namespace: {
        number: 123
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _private: {
        test: false
      },
      _namespace: {
        number: 456
      }
    }
  }
  const expected1 = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _private: {
        test: true
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _private: {
        test: false
      }
    }
  }
  const expected2 = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _namespace: {
        number: 123
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _namespace: {
        number: 456
      }
    }
  }

  t.deepEqual(CustomModel.expose(element, { namespaces: ['private'] }), expected1)
  t.deepEqual(CustomModel.expose(element, { namespaces: ['namespace', 'test'] }), expected2)
  t.deepEqual(CustomModel.expose(element, { namespaces: ['*'] }), element)
})

test('get data namespaces', (t) => {
  const element = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _private: {
        test: true
      },
      _namespace: {
        number: 123
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _private: {
        test: false
      },
      _namespace: {
        number: 456
      },
      _custom: {}
    }
  }

  t.deepEqual(Base.getDataNamespaces(element), ['private', 'namespace', 'custom'])
})

test('check data namespaces', (t) => {
  const element = {
    id: '9be26bc4-3259-4fc3-97e2-c749958e7c4f',
    name: 'example',
    metadata: {
      color: 'blue',
      nested: {
        dummy: true
      },
      _private: {
        test: true
      },
      _namespace: {
        number: 123
      }
    },
    platformData: {
      color: 'red',
      nested: {
        dummy: false
      },
      _private: {
        test: false
      },
      _namespace: {
        number: 456
      },
      _custom: {}
    }
  }

  t.true(Base.checkDataNamespaces(element, ['private', 'namespace', 'custom']))
  t.false(Base.checkDataNamespaces(element, ['private', 'namespace']))
  t.true(Base.checkDataNamespaces(element, ['*']))
})
