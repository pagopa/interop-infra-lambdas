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

san_option=""
if [[ -n "$CLIENT_EMAIL" ]]; then
    san_option='--subject-alt-name="email:$CLIENT_EMAIL"'
fi

EASYRSA_BATCH=0
if [[ $EASYRSA_BATCH_MODE -eq 1 ]]; then
    EASYRSA_BATCH=1
fi

set +e
# Generate a new client certificate
EASYRSA_BATCH=$EASYRSA_BATCH $EASYRSA_PATH/easyrsa $san_option --pki-dir=$EASYRSA_PKI_DIR build-client-full $CLIENT_NAME nopass &> $EASYRSA_PKI_DIR/tmp.txt
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