#!/bin/bash
set -euo pipefail

if [[ ! -s $EASYRSA_PKI_DIR/index.txt ]]; then
    exit 0
fi

## Elenca i certificati revocati
revoked_users=$(cat $EASYRSA_PKI_DIR/index.txt | awk -F" " '$1 == "R" { print $6 }')

echo $revoked_users