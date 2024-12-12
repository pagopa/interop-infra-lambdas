const scriptsWrapper = require('./scriptsWrapper');
const CustomLogger   = require('./logger.js');

const logger = new CustomLogger(process.env.LOG_LEVEL || "info");

exports.createClient = async function (clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays) {
    try {
        const createClientResult = await scriptsWrapper.createClient(clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays);
        const isValidClientResult = await scriptsWrapper.isValidClient(clientName, easyRsaPath, easyRsaPkiDir);

        return {
            createResult: createClientResult,
            validityCheckResult: isValidClientResult
        };
    } catch (err) {
        logger.error(`createClient::Error while creating client credentials::${JSON.stringify(err)}`);
        throw err;
    }
};

exports.revokeClient = async function (clientName, easyRsaPath, easyRsaPkiDir) {
    try {
        const revokeClientResult = await scriptsWrapper.revokeClient(clientName, easyRsaPath, easyRsaPkiDir);
        const isRevokedClientResult = await scriptsWrapper.isRevokedClient(clientName, easyRsaPath, easyRsaPkiDir);

        return {
            revokeResult: revokeClientResult,
            revokedCheckResult: isRevokedClientResult
        };
    } catch (err) {
        logger.error(`Error while revoking client credentials::${JSON.stringify(err)}`);
        throw err;
    }
};
