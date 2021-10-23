#!/bin/bash

# Generate SSL certificate to test SSL connections to PostgreSQL
# OpenSSL cheatsheet: https://www.freecodecamp.org/news/openssl-command-cheatsheet-b441be1e8c4a

# Inspired blog post:
# https://itnext.io/postgresql-docker-image-with-ssl-certificate-signed-by-a-custom-certificate-authority-ca-3df41b5b53

# As explained in the blog post, generating a self-signed certificate isn't sufficient.
# The generated certificate has also to be signed by another certificate (custom Certificate Authority).
# Otherwise Node.js will throw the error 'DEPTH_ZERO_SELF_SIGNED_CERT'.

BASEDIR=$(pwd)/$(dirname "$0")

# Generate key for rootCA certificate
openssl genrsa -des3 -passout pass:abcd -out ${BASEDIR}/rootCA.pass.key 2048
openssl rsa -passin pass:abcd -in ${BASEDIR}/rootCA.pass.key -out ${BASEDIR}/rootCA.key
rm ${BASEDIR}/rootCA.pass.key

# Create self-signed root CA certificate
openssl req -x509 -new -nodes -key ${BASEDIR}/rootCA.key -sha256 -days 36500 -out ${BASEDIR}/rootCA.crt -subj /CN=stelace-ca

# Generate key for server certificate
openssl genrsa -des3 -passout pass:abcd -out ${BASEDIR}/server.pass.key 2048
openssl rsa -passin pass:abcd -in ${BASEDIR}/server.pass.key -out ${BASEDIR}/server.key
rm ${BASEDIR}/server.pass.key

# Create a certificate request for the server. Use a config file to include multiple domains
# (localhost and postgresql for CircleCI)
openssl req -new -key ${BASEDIR}/server.key -out ${BASEDIR}/server.csr -config ${BASEDIR}/openssl.conf

# USe the CA certificate and key to create a signed version of the server certificate
openssl x509 -req -sha256 -days 36500 -in ${BASEDIR}/server.csr -CA ${BASEDIR}/rootCA.crt -CAkey ${BASEDIR}/rootCA.key -CAcreateserial -out ${BASEDIR}/server.crt -extensions req_ext -extfile ${BASEDIR}/openssl.conf

rm ${BASEDIR}/server.csr
rm ${BASEDIR}/rootCA.srl
