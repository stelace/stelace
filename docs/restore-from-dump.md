# Restore your Stelace API data to another infrastructure

Prerequisites:
- Get your PostgreSQL database dump. If hosted in SaaS, get in touch with support to have your database exported.
- Fulfill the .env file in the new infrastructure as indicated
- Start your databases and Stelace API server

## Restore PostgreSQL data via dump

```sh
pg_restore -h <host> --port <port> -d <database_name> -U <user> --no-owner --role=<user> <dump_name>.dump
```

This will restore data from test and live environments as long as dump includes them both.

## Configure Redis

- In .env file, set `SYSTEM_KEY` with the value of your choice.

- Create the platform with your Stelace platformId (e.g. platform n°23).
In the following examples, we use `localhost` but you have to specify your API URL.

```
POST http://localhost:4100/store/platforms

// payload
{
  platformId: 23
}

// headers
{
  'x-stelace-system-key': <system_key>
}
```

- Now, let's set the database credentials. The following query is for the test environment.
```
PUT http://localhost:4100/store/platforms/<platform_id>/data/test

// payload
{
  postgresql: {
    host: <postgresql_host>,
    user: <postgresql_user>,
    password: <postgresql_password>,
    database: <postgresql_database_name>,
    port: <postgresql_port>,
    schema: `e${platformId}_${env}` // 'e23_test' here
  },
  elasticsearch: {
    host: <elasticsearch_host>,
    protocol: <elasticsearch_protocol>,
    user: <elasticsearch_user>,
    password: <elasticsearch_password>,
    port: <elasticsearch_port>
  }
}

// headers
{
  'x-stelace-system-key': <system_key>
}
```

Do the same with prod environment:
```
PUT http://localhost:4100/store/platforms/<platform_id>/data/live
...
// PostgreSQL schema: 'e23_live'
```

Now you should be able to perform simple queries like retrieving users with your usual API keys:
```
GET http://localhost:4100/users

// headers
{
  authorization: 'Basic <publishable_api_key>:'
}
```

## Set the Stelace API version

In Stelace API, you were using the API with a specific version. Let's set the same version.

Perform any request to you current Stelace API infrastructure as you did with previous infrastructure. If you’re unsubscribing from Stelace hosted infrastructure, some specific search filters may not be available anymore. Please refer to README.md.

Now let's set it into your new system:

```
PATCH http://localhost:4100/config/system

// payload
{
  stelace: {
    stelaceVersion: <stelace_version>
  }
}

// headers
{
  'x-stelace-system-key': <system_key>,
  'x-platform-id': <platform_id>,
  'x-stelace-env': 'test'
}
```

Set the API version for live environment as well by setting header 'x-stelace-env' to 'live'.

## Synchronizing Elasticsearch

If you perform a search query, you won't get any results because data stored into PostgreSQL hasn't been synchronized with the search engine Elasticsearch.

Let's synchronize the data first (perform the request for test and live environments):
```
POST http://localhost:4100/store/platforms/<platform_id>/elasticsearch/sync
{
  'x-stelace-system-key': <system_key>,
  'x-stelace-env': 'test'
}
```

Do the same for live environment by setting header 'x-stelace-env' to 'live'.

After few moments depending on the number of your assets, you will be able to search assets as you did with Stelace API.

## Synchronizing cache

In Stelace API, some data stored in PostgreSQL like tasks are cached into Redis for quick access.

```
POST http://localhost:4100/store/platforms/<platform_id>/cache/sync
{
  'x-stelace-system-key': <system_key>,
  'x-stelace-env': 'test'
}
```

Do the same for live environment by setting header 'x-stelace-env' to 'live'.
