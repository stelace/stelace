# Client SSL configuration to PostgreSQL/TimescaleDB

SSL connection may be required by database providers, or you may want to allow only secure connections for your self-hosted PostgreSQL.

Let’s see how to configure the client connection.

You will find PostgreSQL SSL environment variables `POSTGRES_SSL_*` into the environment file `.env`.

If you want to make SSL required, set `POSTGRES_SSL` at 'true'.
If certificate, private key or certificate authority must be provided to establish the database connection, please fill respectively `POSTGRES_SSL_CERT`, `POSTGRES_SSL_KEY` and/or `POSTGRES_SSL_CA`.
It's recommended to set one-line value, so replace any newlines by newline character (`\n` in Unix).

# SSL installation for PostgreSQL/TimescaleDB server

In case you want to self-host PostgreSQL with SSL, here's a small walkthrough.

1. Certificates creation

You can get your certificates from a SSL provider (recommended), or you can create your self-signed certificates.

In the latter case, please follow the [official instructions](https://www.postgresql.org/docs/current/ssl-tcp.html) (section *Creating Certificates*).

2. Server SSL configuration

To make PostgreSQL aware of the certificates, you need to update [`postgresql.conf`]((https://www.postgresql.org/docs/current/config-setting.html)) to point the certificates location (usually located at `${PGDATA}/postgresql.conf`) and activate SSL.

```
ssl = on
# Fill only files you have
ssl_ca_file = /absolute/path/to/ca-file
ssl_cert_file = /absolute/path/to/cert-file
ssl_key_file = /absolute/path/to/key-file
```

SSL is configured but PostgreSQL will continue accepting non-SSL connections. You can reject them by updating [`pg_hba.conf`](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) (usually located at `${PGDATA}/postgresql.conf`).

Replace existing type 'host' with 'hostssl' and their method 'trust' with 'cert'.

Please note the type 'local' cannot be associated with the method 'cert' (non-SSL local connections can still be accepted).

Now you need to restart your PostgreSQL server and you're all set!
