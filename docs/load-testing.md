# Load testing

To know if the API can handle a high number of requests, we need to perform some load testing.

[Siege](https://github.com/JoeDog/siege) is the perfect tool for that.

## Installation

First, download the latest source code:

```
wget http://download.joedog.org/siege/siege-latest.tar.gz
tar -xf siege-latest.tar.gz
cd siege-<version>
```

Let's install:

```
./configure
make
sudo make install
```

## Launch your first load test

Launch your API server first and execute the following command:

`siege http://127.0.0.1:4100/assets`

Ctrl+C to exit

Siege will perform requests to the specified URL indefinitely.

If you need to perform requests only for a given duration:

`timeout 10s siege http://127.0.0.1:4100/assets`

### Include API key

`siege http://127.0.0.1:4100/assets -H "x-api-key:pubk_..."`
