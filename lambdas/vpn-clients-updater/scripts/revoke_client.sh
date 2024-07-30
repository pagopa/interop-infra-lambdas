#!/bin/bash
# EASYRSA_BATCH_MODE=1 EASYRSA_PATH=/Users/manuelm/Documents/repo/PagoPA/ClientVPN/easy-rsa/easyrsa3 EASYRSA_PKI_DIR=/Users/manuelm/Documents/repo/PagoPA/ClientVPN/easyrsa3/pki-dir CLIENT_NAME=manuel.test6 sh revoke_client.sh
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

### Step1. Revoke
EASYRSA_BATCH="${EASYRSA_BATCH_MODE:-0}"

set +e
EASYRSA_BATCH=$EASYRSA_BATCH $EASYRSA_PATH/easyrsa --pki-dir="$EASYRSA_PKI_DIR" revoke $CLIENT_NAME &> $EASYRSA_PKI_DIR/tmp.txt
RESULT=$?
set -e

if [[ $RESULT -ne 0 ]]; then
  echo "Failed to revoke client certificate for $CLIENT_NAME" >&2
  cat $EASYRSA_PKI_DIR/tmp.txt >> $EASYRSA_PKI_DIR/err.txt
  cat $EASYRSA_PKI_DIR/tmp.txt >&2
  rm $EASYRSA_PKI_DIR/tmp.txt

  exit $RESULT
fi
rm $EASYRSA_PKI_DIR/tmp.txt

set +e
### Step 2. Gen CRL
$EASYRSA_PATH/easyrsa --pki-dir="$EASYRSA_PKI_DIR" gen-crl &>$EASYRSA_PKI_DIR/tmp.txt
RESULT=$?
set -e

if [[ $RESULT -ne 0 ]]; then
  echo "Failed to update crl" >&2
  cat $EASYRSA_PKI_DIR/tmp.txt >> $EASYRSA_PKI_DIR/err.txt
  cat $EASYRSA_PKI_DIR/tmp.txt >&2
  rm $EASYRSA_PKI_DIR/tmp.txt

  exit $RESULT
fi

rm $EASYRSA_PKI_DIR/tmp.txt

#CRL_LOCATION=$EASYRSA_PKI_DIR/crl.pem

##openssl crl -text -in $CRL_LOCATION

### Step 3. Update AWS ClientVPN CRL

#CLIENT_VPN_ENDPOINT_ID=???
#CLIENT_VPN_REGION=??
#should we do this in the script?
#aws ec2 import-client-vpn-client-certificate-revocation-list --certificate-revocation-list file://$CRL_LOCATION --client-vpn-endpoint-id $CLIENT_VPN_ENDPOINT_ID --region $CLIENT_VPN_REGION
exit 0