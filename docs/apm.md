# ElasticSearch APM

ElasticSearch APM is a monitoring tool sitting between logs and metrics.
Here’s an [article](https://www.elastic.co/blog/monitoring-applications-with-elasticsearch-and-elastic-apm) explaining what APM (Application Performance Monitoring) is.

## Local APM server setup

The easiest way to do run a local APM server is to launch a configured docker-compose file.

We adapted the project [EAK](https://github.com/yidinghan/eak) and changed ports to prevent conflicts with Stelace server.

Launch the EAK stack:

```sh
yarn docker:apm up -d
# npm run docker:apm -- up -d
```

Go to `localhost:5601` to visualize Kibana and get to APM page.

You can run the installation checks after starting Stelace server.

### Specify environment variables

You just have to set this in your .env file:

```
ELASTIC_APM_SERVER_URL=http://localhost:8200
```

And you can enjoy monitoring!

### Tips

To stop the stack:
`yarn docker:apm stop`

To remove the stack:
`yarn docker:apm down`

## Known issues

Some spans don’t show up in APM view, probably due to inner transactions attached to Côte Responders that are used to keep some continuity despite low-level network calls (not HTTP, which would be automatically tracked by APM).

You can still filter with `transaction.id: abc…` KQL in [Discover view](http://localhost:5601/app/kibana#/discover) to see all these spans.
