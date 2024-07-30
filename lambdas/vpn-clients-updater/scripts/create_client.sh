#!/bin/bash
#EASYRSA_PATH=/Users/manuelm/Documents/repo/PagoPA/ClientVPN/easy-rsa/easyrsa3 EASYRSA_PKI_DIR=/Users/manuelm/Documents/repo/PagoPA/ClientVPN/easyrsa3/pki-dir CLIENT_NAME=manuel.test6 EASYRSA_BATCH_MODE=1 CLIENT_EMAIL=prova@prova.com sh create_client.sh
set -euo pipefail

# Check EASYRSA_PATH is defined
if [ -z "$EASYRSA_PATH" ]; then
  echo "EASYRSA_PATH must be defined" >&2
  exit 1
fi
# Check EASYRSA_PKI_DIR is defined
if [ -z "$EASYRSA_PKI_DIR" ]; then
  echo "EASYRSA_PKI_DIR must be defined" >&2
  exit 1
fi

# Check if the client name is passed as an argument
if [ -z "$CLIENT_NAME" ]; then
  echo "CLIENT_NAME must be specified" >&2
  exit 1
fi

san_option=''

SAN_EMAIL="${CLIENT_EMAIL:-}"
if [[ -z "$SAN_EMAIL" ]]; then
    san_option=''
else
    san_option=('--subject-alt-name='email:$SAN_EMAIL'')
fi

CERT_EXPIRE_DAYS="${EASYRSA_CERT_EXPIRE:-730}"
EASYRSA_BATCH="${EASYRSA_BATCH_MODE:-0}"

set +e
# Generate a new client certificate
EASYRSA_BATCH=$EASYRSA_BATCH EASYRSA_CERT_EXPIRE=$CERT_EXPIRE_DAYS $EASYRSA_PATH/easyrsa $san_option --pki-dir=$EASYRSA_PKI_DIR build-client-full $CLIENT_NAME nopass &> $EASYRSA_PKI_DIR/tmp.txt
RESULT=$?
set -e

if [ $RESULT -ne 0 ]; then
  echo "Failed to build client certificate for $CLIENT_NAME" >&2
  cat $EASYRSA_PKI_DIR/tmp.txt >> $EASYRSA_PKI_DIR/err.txt
  cat $EASYRSA_PKI_DIR/tmp.txt >&2
  rm $EASYRSA_PKI_DIR/tmp.txt

  exit $RESULT
fi

rm $EASYRSA_PKI_DIR/tmp.txt

exit 0