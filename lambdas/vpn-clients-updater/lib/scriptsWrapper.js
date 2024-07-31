
const { exec } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '../scripts/main.sh');

const runCommand = async (command, args = []) => {
  return new Promise((resolve, reject) => {
    const envVars = `EASYRSA_PATH=${process.env.EASYRSA_PATH} EASYRSA_PKI_DIR=${process.env.EASYRSA_PKI_DIR}`;
    const cmd = `${envVars} ${scriptPath} ${command} ${args.join(' ')}`;
    
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(`exec error: ${error}`);
        return;
      }
      if (stderr) {
        reject(`stderr: ${stderr}`);
        return;
      }

      resolve(stdout);
    });
  });
};

module.exports = {
  createClient: (clientName, clientEmail, defaultCredentialsDurationDays) => runCommand('create-client', [clientName, clientEmail, defaultCredentialsDurationDays]),
  isValidClient: (clientName) => runCommand('is-valid-client', [clientName]),
  isRevokedClient: (clientName) => runCommand('is-revoked-client', [clientName]),
  listValidClients: () => runCommand('list-valid-clients', []),
  listRevokedClients: () => runCommand('list-revoked-clients', []),
  revokeClient: (clientName) => runCommand('revoke-client', [clientName]),
};