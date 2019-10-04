function getPostgresqlConnection ({ platformId, env }) {
  return {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: process.env.POSTGRES_PORT,
    schema: `s${platformId}_${env}`
  }
}

function getElasticsearchConnection () {
  return {
    host: process.env.ELASTIC_SEARCH_HOST,
    protocol: process.env.ELASTIC_SEARCH_PROTOCOL,
    user: process.env.ELASTIC_SEARCH_USER,
    password: process.env.ELASTIC_SEARCH_PASSWORD,
    port: process.env.ELASTIC_SEARCH_PORT
  }
}

function getAuthenticationSettings () {
  return {
    secret: 'secret'
  }
}

module.exports = {
  getPostgresqlConnection,
  getElasticsearchConnection,
  getAuthenticationSettings
}
