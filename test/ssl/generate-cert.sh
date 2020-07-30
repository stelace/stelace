#!/bin/bash

# Generate SSL certificate to test SSL connections to PostgreSQL
# Inspired by https://gist.github.com/mrw34/c97bb03ea1054afb551886ffc8b63c3b

# If certificates need to be generated again, please remove extra information if present:
# Above -----BEGIN CERTIFICATE----- for server.crt
# Above -----BEGIN RSA PRIVATE KEY----- for server.key

BASEDIR=$(pwd)/$(dirname "$0")

echo $BASEDIR

openssl req -new -text -passout pass:abcd -subj /CN=localhost -out ${BASEDIR}/server.req -keyout ${BASEDIR}/privkey.pem
openssl rsa -in ${BASEDIR}/privkey.pem -passin pass:abcd -out ${BASEDIR}/server.key

# Certificate expires in 100 years
openssl req -x509 -in ${BASEDIR}/server.req -text -key ${BASEDIR}/server.key -days 36500 -out ${BASEDIR}/server.crt

rm ${BASEDIR}/server.req
rm ${BASEDIR}/privkey.pem
