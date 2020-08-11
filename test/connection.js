const fs = require('fs')
const path = require('path')

let pgSSLServerCertificate
let pgSSLCACertificate

function getPgSSLServerCertificate () {
  if (pgSSLServerCertificate) return pgSSLServerCertificate

  pgSSLServerCertificate = fs.readFileSync(path.join(__dirname, 'ssl/server.crt'), 'utf8')
  return pgSSLServerCertificate
}

function getPgSSLCACertificate () {
  if (pgSSLCACertificate) return pgSSLCACertificate

  pgSSLCACertificate = fs.readFileSync(path.join(__dirname, 'ssl/rootCA.crt'), 'utf8')
  return pgSSLCACertificate
}

function getPostgresqlConnection ({
  platformId,
  env,

  ssl,
  sslcert,
  sslkey,
  sslca,
}) {
  return {
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: process.env.POSTGRES_PORT,
    schema: `s${platformId}_${env}`,

    ssl,
    sslcert,
    sslkey,
    sslca,
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
  getPgSSLServerCertificate,
  getPgSSLCACertificate,

  getPostgresqlConnection,
  getElasticsearchConnection,
  getAuthenticationSettings,
}
