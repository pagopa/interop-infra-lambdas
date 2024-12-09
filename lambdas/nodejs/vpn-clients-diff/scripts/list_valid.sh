#!/bin/bash
set -euo pipefail

if [[ ! -s $EASYRSA_PATH/$EASYRSA_PKI_DIR/index.txt ]]; then
    exit 0
fi
## Elenca i certificati validi
valid_users=$(cat $EASYRSA_PATH/$EASYRSA_PKI_DIR/index.txt | awk -F" " '$1 == "V" { print $5 }')

echo $valid_users

