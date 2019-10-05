require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const nodemailer = require('nodemailer')
const _ = require('lodash')

const {
  testTools: { lifecycle, auth }
} = require('../../serverTooling')

const { before, beforeEach, after } = lifecycle
const { getAccessTokenHeaders } = auth

const { minifyHtml } = require('../util/content')

test.before(async t => {
  await before({ name: 'email' })(t)
  await beforeEach()(t)

  await setEmailConfig(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

async function setEmailConfig (t, config = {}) {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'config:edit:all',
    ]
  })

  const configPayload = _.merge({}, {
    stelace: {
      email: {
        port: 465,
        host: 'smtp.example.com',
        secure: false,
        ignoreTLS: false,
        requireTLS: false,
        auth: {
          user: 'hello@example.com',
          pass: 'password'
        },
        defaults: {
          from: 'hello@example.com',
          cc: null,
          bcc: null,
          replyTo: null
        }
      }
    }
  }, config)

  await request(t.context.serverUrl)
    .patch('/config/private')
    .set(authorizationHeaders)
    .send(configPayload)
    .expect(200)
}

// serial needed because config is updated
test.serial('sends email for real and check that information is correct', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  let account
  try {
    account = await nodemailer.createTestAccount()
  } catch (err) {
    // error probably due to external service or network so we just skip the test
    t.pass()
    return
  }

  await setEmailConfig(t, {
    stelace: {
      email: {
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass
        },
        defaults: {
          from: account.user,
          cc: 'user1@example.com, "User2" <user2@example.com>',
          bcc: [
            {
              name: 'User3',
              address: 'user3@example.com'
            },
            'user4@example.com, "User5" <user5@example.com>'
          ]
        }
      }
    }
  })

  const payload = {
    html: '<div>Hello world!</div>',
    text: 'Hello world',
    to: 'Example user <test@example.com>',
    subject: 'Test subject',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext, nodemailerInfo } } = await request(t.context.serverUrl)
    .post('/emails/send?_forceSend=true')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(payload.html, emailContext.html)
  t.is(payload.text, emailContext.text)
  t.is(payload.to, emailContext.to)
  t.is(payload.subject, emailContext.subject)
  t.is(payload.replyTo, emailContext.replyTo)

  t.is(nodemailerInfo.envelope.from, account.user)
  t.true(nodemailerInfo.response.toLowerCase().includes('accepted'))

  // no way to easily distinguish to, cc, bcc from Nodemailer info
  const recipients = [
    'test@example.com',
    'user1@example.com',
    'user2@example.com',
    'user3@example.com',
    'user4@example.com',
    'user5@example.com'
  ]

  t.deepEqual(nodemailerInfo.accepted, nodemailerInfo.envelope.to)
  t.is(_.difference(nodemailerInfo.envelope.to, recipients).length, 0)

  // check that default values are overridden
  const newFrom = 'super@mail.com'
  const { body: { nodemailerInfo: nodemailerInfo2 } } = await request(t.context.serverUrl)
    .post('/emails/send?_forceSend=true')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { from: newFrom }))
    .expect(200)

  t.is(nodemailerInfo2.envelope.from, newFrom)
  t.true(nodemailerInfo2.response.toLowerCase().includes('accepted'))

  t.deepEqual(nodemailerInfo2.accepted, nodemailerInfo2.envelope.to)
  t.is(_.difference(nodemailerInfo2.envelope.to, recipients).length, 0)

  // reset email config for other tests
  await setEmailConfig(t)
})

test('sends an email', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const payload = {
    html: '<div>Hello world!</div>',
    text: 'Hello world',
    to: 'Example user <test@example.com>',
    subject: 'Test subject',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(payload.html, emailContext.html)
  t.is(payload.text, emailContext.text)
  t.is(payload.to, emailContext.to)
  t.is(payload.subject, emailContext.subject)
  t.is(payload.replyTo, emailContext.replyTo)
})

test('sends an email to multiple addresses', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const payload = {
    html: '<div>Hello world!</div>',
    text: 'Hello world',
    to: [
      {
        name: 'User',
        address: 'user@example.com'
      },
      'user2@example.com, "User3" <user3@example.com>'
    ],
    subject: 'Test subject',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(payload.html, emailContext.html)
  t.is(payload.text, emailContext.text)
  t.deepEqual(payload.to, emailContext.to)
  t.is(payload.subject, emailContext.subject)
  t.is(payload.replyTo, emailContext.replyTo)
})

// DEPRECATED
test('sends an email with deprecated `toEmail` and `toName`', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const payload = {
    html: '<div>Hello world!</div>',
    text: 'Hello world',
    toEmail: 'test@example.com',
    toName: 'Example user',
    subject: 'Test subject',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(payload.html, emailContext.html)
  t.is(payload.text, emailContext.text)
  t.is(`"${payload.toName}" <${payload.toEmail}>`, emailContext.to)
  t.is(payload.subject, emailContext.subject)
  t.is(payload.replyTo, emailContext.replyTo)
})
// DEPRECATED:END

test('sends an email with plain text only', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const text = `Hello world,
This is a test.`

  const payload = {
    text,
    to: 'Example user <test@example.com>'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(payload.text, text)
  t.is(payload.to, emailContext.to)
})

test('email HTML is minified', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const html = `
    <div>
      <strong>Hello    </strong>  <span> world! ></span>
    </div>
  `
  const minifiedHtml = minifyHtml(html)

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send({
      html,
      to: 'test@example.com'
    })
    .expect(200)

  t.true(html !== emailContext.html)
  t.is(emailContext.html, minifiedHtml)
})

test('text is generated automatically from HTML if not provided', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const html = `
    <div class="headerContainer">
      <span>Hello world!</span>
    </div>
    <div class="bodyContainer">
      <p>Beautiful platform</p>
    </div>
  `
  const customText = 'Yeah'
  const generatedText = 'Hello world!\nBeautiful platform'

  const { body: { emailContext: emailContext1 } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send({
      html,
      text: customText,
      to: 'test@example.com'
    })
    .expect(200)

  t.is(emailContext1.text, customText)

  const { body: { emailContext: emailContext2 } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send({
      html,
      to: 'test@example.com'
    })
    .expect(200)

  t.is(emailContext2.text, generatedText)
})

test('sends an email with headers', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  const headers1 = {
    'x-test-key1': 'key1',
    'x-test-key2': JSON.stringify({ key2: true }),
    'x-test-key3': 'key3'
  }
  const headers2 = {
    'x-test-key1': [
      'key1-1',
      'key1-2',
      'key1-3'
    ],
    'x-test-key2': JSON.stringify({ key2: true }),
    'x-test-key3': 'key3'
  }
  const headers3 = {
    'x-processed': 'a really long header or value with non-ascii characters 👮',
    'x-unprocessed': {
      prepared: true,
      value: 'a really long header or value with non-ascii characters 👮'
    }
  }

  const payload = {
    html: '<div>Hello world!</div>',
    text: 'Hello world',
    to: 'Example user <test@example.com>',
    subject: 'Test subject',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext: emailContext1 } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { headers: headers1 }))
    .expect(200)

  t.deepEqual(headers1, emailContext1.headers)

  const { body: { emailContext: emailContext2 } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { headers: headers2 }))
    .expect(200)

  t.deepEqual(headers2, emailContext2.headers)

  const { body: { emailContext: emailContext3 } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { headers: headers3 }))
    .expect(200)

  t.deepEqual(headers3, emailContext3.headers)
})

test('sends an email without html or text (enabling custom provider templates)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['email:send:all']
  })

  // Mandrill example
  // https://mandrill.zendesk.com/hc/en-us/articles/205582117-How-to-Use-SMTP-Headers-to-Customize-Your-Messages#use-stored-templates
  const headers = {
    'X-MC-Template': 'customTemplate',
    'X-MC-MergeVars': JSON.stringify({ var1: 'global value 1' })
  }

  const payload = {
    to: 'Example user <test@example.com>',
    subject: 'Test subject',
    replyTo: 'support@company.com',
    headers
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.deepEqual(payload.headers, emailContext.headers)
})

test('sends an email via a template', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayload = {
    subject: 'Welcome to our platform',
    preview_content: 'Welcome',
    preheader_content: null,
    header_title: 'Let’s check your email',
    content: 'Just one step to activate your account.',
    cta__button_url: 'https://example.com/email-check',
    cta_button__text: 'Check your email',
    footer_content: 'Custom footer',
    legal_notice: 'My legal notice',
    style__color_brand: 'green',
    style__color_calltoaction: 'red'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'welcome',
      fields: entryPayload
    })
    .expect(200)

  const payload = {
    name: 'welcome',
    to: 'Example user <test@example.com>',
    replyTo: 'support@company.com'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.truthy(emailContext.html)
  t.truthy(emailContext.text)
  t.truthy(entryPayload.subject)
  t.is(payload.to, emailContext.to)
  t.is(payload.replyTo, emailContext.replyTo)
})

test('sends an email via a template with ICU content', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayload = {
    subject: 'Welcome {userName}',
    content: 'You are the {userNum, selectordinal, =1 {first} =2 {second} =3 {third} other {#th}} user.'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'registration',
      fields: entryPayload
    })
    .expect(200)

  const payload = {
    name: 'registration',
    to: 'Example user <test@example.com>',
    replyTo: 'support@company.com',
    data: {
      userName: 'Foo',
      userNum: 2
    }
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContext.subject, 'Welcome Foo')
  t.true(emailContext.html.includes('You are the second user.'))
})

test('uses general email content when specific email content is missing', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const commonEntryPayload = {
    subject: 'Bienvenue {userName}',
    content: 'Vous êtes le {userNum, selectordinal, =1 {premier} =2 {second} =3 {troisième} other {#ème}} utilisateur.'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'fr',
      name: 'common',
      fields: commonEntryPayload
    })
    .expect(200)

  const entryPayload = {
    content: 'Vous êtes le meilleur.'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'fr',
      name: 'welcome',
      fields: entryPayload
    })
    .expect(200)

  const payload = {
    name: 'welcome',
    to: 'test@example.com',
    locale: 'fr',
    data: {
      userName: 'Foo',
      userNum: 2
    }
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContext.subject, 'Bienvenue Foo')
  t.true(emailContext.html.includes('Vous êtes le meilleur'))
})

test('data are enriched via platform config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all',
      'config:edit:all'
    ]
  })

  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        instant: {
          serviceName: 'BigCompany'
        }
      }
    })
    .expect(200)

  const commonEntryPayload = {
    subject: 'Welcome on {serviceName}'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'common',
      fields: commonEntryPayload
    })
    .expect(200)

  const payload = {
    name: 'unknownName',
    to: 'test@example.com'
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContext.subject, 'Welcome on BigCompany')
})

test('sends an email via a template with ICU and rich content', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayload = {
    subject: 'Welcome {userName}',
    content: {
      editable: '# Welcome',
      transform: 'markdown',
      transformed: '<h1>Welcome</h1>'
    }
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'registrationMarkdown',
      fields: entryPayload
    })
    .expect(200)

  const payload = {
    name: 'registrationMarkdown',
    to: 'Example user <test@example.com>',
    replyTo: 'support@company.com',
    data: {
      userName: 'Foo'
    }
  }

  const { body: { emailContext } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContext.subject, 'Welcome Foo')
  t.true(emailContext.html.includes('<h1>Welcome</h1>'))
})

test('cannot send an email via a template with invalid transformed value', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayload = {
    subject: 'Welcome {userName}',
    content: {
      editable: 'random editable',
      transform: 'unknown',
      transformed: { // should be a string
        nested: 'random transformed'
      }
    }
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'registrationUnknownTransform',
      fields: entryPayload
    })
    .expect(200)

  const payload = {
    name: 'registrationUnknownTransform',
    to: 'Example user <test@example.com>',
    replyTo: 'support@company.com',
    data: {
      userName: 'Foo'
    }
  }

  const { body: error } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(422)

  t.true(error.message.includes('Invalid transform object'))
})

test('branding is displayed by default', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayloadEn = {
    subject: 'Some subject',
    content: 'Some content'
  }
  const entryPayloadFr = {
    subject: 'Un sujet',
    content: 'Un contenu'
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'branding',
      fields: entryPayloadEn
    })
    .expect(200)

  const payload = {
    name: 'branding',
    to: 'Example user <test@example.com>',
    locale: 'en'
  }

  const { body: { emailContext: emailContextEn } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContextEn.subject, 'Some subject')
  t.true(emailContextEn.html.includes('Stelace'))

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'fr',
      name: 'branding',
      fields: entryPayloadFr
    })
    .expect(200)

  const { body: { emailContext: emailContextFr } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { locale: 'fr' }))
    .expect(200)

  t.is(emailContextFr.subject, 'Un sujet')
  t.true(emailContextFr.html.includes('Stelace'))
})

test('branding can be removed if branding values set to empty', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'email:send:all',
      'entry:create:all'
    ]
  })

  const entryPayloadEn = {
    subject: 'Some subject',
    content: 'Some content',
    branding: ''
  }
  const entryPayloadFr = {
    subject: 'Un sujet',
    content: 'Un contenu',
    branding: ''
  }

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'en',
      name: 'branding2',
      fields: entryPayloadEn
    })
    .expect(200)

  const payload = {
    name: 'branding2',
    to: 'Example user <test@example.com>',
    locale: 'en'
  }

  const { body: { emailContext: emailContextEn } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(emailContextEn.subject, 'Some subject')
  t.false(emailContextEn.html.includes('the platform launcher'))

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'email',
      locale: 'fr',
      name: 'branding2',
      fields: entryPayloadFr
    })
    .expect(200)

  const { body: { emailContext: emailContextFr } } = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set(authorizationHeaders)
    .send(Object.assign({}, payload, { locale: 'fr' }))
    .expect(200)

  t.is(emailContextFr.subject, 'Un sujet')
  t.false(emailContextFr.html.includes('le lanceur de plateformes'))
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to send an email if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/emails/send')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/emails/send')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      html: true,
      text: true,
      from: true,
      to: true,

      // DEPRECATED
      fromName: true,
      toEmail: true,
      toName: true,
      // DEPRECATED:END

      subject: true,
      replyTo: true,
      headers: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"html" must be a string'))
  t.true(error.message.includes('"text" must be a string'))
  t.true(error.message.includes('"from" must be one of [string, object]'))
  t.true(error.message.includes('"to" must be one of [string, object]'))

  // DEPRECATED
  t.true(error.message.includes('"fromName" must be a string'))
  t.true(error.message.includes('"toEmail" must be a string'))
  t.true(error.message.includes('"toName" must be a string'))
  // DEPRECATED:END

  t.true(error.message.includes('"subject" must be a string'))
  t.true(error.message.includes('"replyTo" must be one of [string, object]'))
  t.true(error.message.includes('"headers" must be of type object'))
})

test('fails to send an email with template if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/emails/send-template')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: true,
      data: true,
      locale: true,
      currency: true,
      from: true,
      to: true,

      // DEPRECATED
      fromName: true,
      toEmail: true,
      toName: true,
      // DEPRECATED:END

      replyTo: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" must be a string'))
  t.true(error.message.includes('"data" must be of type object'))
  t.true(error.message.includes('"locale" must be a string'))
  t.true(error.message.includes('"currency" must be a string'))
  t.true(error.message.includes('"from" must be one of [string, object]'))
  t.true(error.message.includes('"to" must be one of [string, object]'))

  // DEPRECATED
  t.true(error.message.includes('"fromName" must be a string'))
  t.true(error.message.includes('"toEmail" must be a string'))
  t.true(error.message.includes('"toName" must be a string'))
  // DEPRECATED:END

  t.true(error.message.includes('"replyTo" must be one of [string, object]'))
})
