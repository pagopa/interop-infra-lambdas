#!/bin/bash
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


set +e
## Verifica se un certificato esiste
$EASYRSA_PATH/easyrsa --pki-dir=$EASYRSA_PKI_DIR show-cert $CLIENT_NAME &> $EASYRSA_PKI_DIR/tmp.txt
RESULT=$?
set -e

if [ $RESULT -ne 1 ]; then
  echo "Client $CLIENT_NAME seems not to have been revoked" >&2
  cat $EASYRSA_PKI_DIR/tmp.txt >> $EASYRSA_PKI_DIR/err.txt
  cat $EASYRSA_PKI_DIR/tmp.txt >&2
  rm $EASYRSA_PKI_DIR/tmp.txt

  exit 1
fi

rm $EASYRSA_PKI_DIR/tmp.txt

echo "Client $CLIENT_NAME certificate has been revoked"
exit 0