# Migration from PostgreSQL to TimescaleDB

## Reasons

Time-series tables are intended to be very large due to their nature (e.g. events, webhook/workflow logs).

Even with indices optimization and partitioning, PostgreSQL can’t beat TimescaleDB in terms of performance (the latter is optimized for time-series):

https://blog.timescale.com/blog/timescaledb-vs-6a696248104e

The good point is that TimescaleDB is an extension of PostgreSQL so it will benefit from existing tools and the codebase migration won’t be too massive.
Time-series tables will be transformed into Timescale hypertables.

Please find more details on [the TimescaleDB PR](https://github.com/stelace/stelace/pull/349).

## Migration process

Please find the [official documentation](https://docs.timescale.com/latest/getting-started/migrating-data) detailing migration steps.

### From scratch

If you don’t need to keep existing data (e.g. in development environment) or can afford to start from scratch, please execute the following commands after checking your dev branch is up-to-date:

```sh
yarn docker:db:reset
yarn docker:db
```

You’ve just replaced PostgreSQL container with TimescaleDB container.

### Existing data

To migrate data from a PostgreSQL database to a TimescaleDB database, Stelace provides a script (gist URL) you can use.

*Please note this script is suitable if your time-series tables (event, webhookLog, workflowLog) don’t have more than about 1 million rows each. Otherwise, you may need to adapt the script to import/export those tables in CSV format as explained in the [official documentation](https://docs.timescale.com/latest/getting-started/migrating-data). It will be a lot faster than transforming PostgreSQL tables into TimescaleDB hypertables.*

Please copy the file into the root path of this project. Add the following `TIMESCALE_*` environment variables into the file `.env` that will only serve for the migration script (data restoration to new database), while `POSTGRES_*` environment variables will be used for the data dump of the old database:

```sh
# Fill the TimescaleDB credentials
TIMESCALE_HOST=
TIMESCALE_PORT=
TIMESCALE_DB=
TIMESCALE_USER=
TIMESCALE_PASSWORD=
```

Now you can run the following command:

```sh
node migrateTimescaleDB.js
```

The script ensures you won’t overwrite your new TimescaleDB data unless specified otherwise. If you encounter errors mentioning that tables or schema already exists (e.g. by executing the script a second time), then please add the parameter `drop` to the script execution:

```sh
node migrateTimescaleDB.js --drop
```

Your data has been successfully migrated!

There is still a final step to perform: updating database connection.
The current configuration keeps pointing to the old database location. The below command will update it.
Please mind it’s irreversible so please ensure data was correctly migrated before running it.

```sh
node migrateTimescaleDB.js --update
```

You’re almost done. Replace the `POSTGRES_*` environment variables values by `TIMESCALE_*` ones in order to point to the new TimescaleDB database location. Then remove the temporary `TIMESCALE_*` variables from the `.env` file.

Database connections are cached for performance reasons. Stelace API server needs to be restarted to establish connections to new database.

Congratulations! Now you’re ready to use TimescaleDB!
