
const { exec } = require('child_process');
const path     = require('path');
const logger     = require('./winstonLogger.js');
const scriptPath = path.join(__dirname, '../scripts/main.sh');

const runCommand = async (command, args = []) => {
  return new Promise((resolve, reject) => {
    //const envVars = `EASYRSA_PATH=${process.env.EASYRSA_PATH} EASYRSA_PKI_DIR=${process.env.EASYRSA_PKI_DIR}`;
    //const cmd = `${envVars} ${scriptPath} ${command} ${args.join(' ')}`;
    const cmd = `${scriptPath} ${command} ${args.join(' ')}`;
    logger.log(`Execute command: ${cmd}`);

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
  createClient: (clientName, clientEmail, easyRsaPath, easyRsaPkiDir, defaultCredentialsDurationDays) => runCommand('create-client', [clientName, clientEmail, easyRsaPath, easyRsaPkiDir, defaultCredentialsDurationDays]),
  isValidClient: (clientName, easyRsaPath, easyRsaPkiDir) => runCommand('is-valid-client', [clientName, easyRsaPath, easyRsaPkiDir]),
  isRevokedClient: (clientName, easyRsaPath, easyRsaPkiDir) => runCommand('is-revoked-client', [clientName, easyRsaPath, easyRsaPkiDir]),
  listValidClients: (easyRsaPath, easyRsaPkiDir) => runCommand('list-valid-clients', [easyRsaPath, easyRsaPkiDir]),
  listRevokedClients: (easyRsaPath, easyRsaPkiDir) => runCommand('list-revoked-clients', [easyRsaPath, easyRsaPkiDir]),
  revokeClient: (clientName, easyRsaPath, easyRsaPkiDir) => runCommand('revoke-client', [clientName, easyRsaPath, easyRsaPkiDir])
};