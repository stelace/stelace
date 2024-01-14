# API keys

There are two types of API keys: secret and publishable API keys. The API key you use to authenticate a request also determines whether the request is in live or test environment.

Publishable API keys only identify your platform. Users must authenticate themselves before accessing protected resources.

Secret API keys enable developers or applications to perform any action without being authenticated as a user.

**Secret API keys carry all permissions and should never be stored in public-facing code such as mobile app, Github project or client-side JavaScript.**

## Development

You can generate hard-coded API keys for development:

```sh
yarn seed
```

Or if you're using a Docker container:

```sh
docker-compose run --rm api yarn seed
```

## Production

If you're ready to deploy to production, you **must** generate and use unique API keys:

```sh
yarn seed:prod
```

Or if you're using a Docker container:

```sh
docker-compose run --rm api yarn seed:prod
```

When rotating keys, make sure you [delete previous API keys](https://docs.api.stelace.com/#d3a642aa-b0c0-40dd-bd80-a804d1be5bb6) after proper migration.
