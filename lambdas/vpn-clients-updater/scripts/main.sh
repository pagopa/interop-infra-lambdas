#!/bin/bash
SCRIPTS_PATH=$(dirname $0)

case $1 in
  create-client)
    CLIENT_NAME=$2
    CLIENT_EMAIL=$3
    
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR CLIENT_NAME="$CLIENT_NAME" CLIENT_EMAIL="$CLIENT_EMAIL" EASYRSA_BATCH_MODE=1 $SCRIPTS_PATH/create_client.sh

    exit 0
    ;;
  is-valid-client)
    CLIENT_NAME=$2
    
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR CLIENT_NAME=$CLIENT_NAME $SCRIPTS_PATH/is_valid_client.sh

    exit 0
    ;;
  is-revoked-client)
    CLIENT_NAME=$2
    
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR CLIENT_NAME=$CLIENT_NAME $SCRIPTS_PATH/is_revoked_client.sh

    exit 0
    ;;
  list-valid-clients)
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR $SCRIPTS_PATH/list_valid.sh

    exit 0
    ;;
  list-revoked-clients)
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR $SCRIPTS_PATH/list_revoked.sh
    
    exit 0
    ;;
  revoke-client)
    CLIENT_NAME=$2
    
    EASYRSA_PATH=$EASYRSA_PATH EASYRSA_PKI_DIR=$EASYRSA_PKI_DIR CLIENT_NAME=$CLIENT_NAME EASYRSA_BATCH_MODE=1 $SCRIPTS_PATH/revoke_client.sh

    exit 0
    ;;
  *)
    echo "Usage: $0 {init|gen-req|sign-req} [args]"
    exit 1
esac