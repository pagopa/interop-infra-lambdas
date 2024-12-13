const scriptsWrapper = require('./scriptsWrapper');
const logger         = require('./winstonLogger.js');

exports.createClient = async function (clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays) {
    try {
        const createClientResult = await scriptsWrapper.createClient(clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays);
        const isValidClientResult = await scriptsWrapper.isValidClient(clientName, easyRsaPath, easyRsaPkiDir);

        return {
            createResult: createClientResult,
            validityCheckResult: isValidClientResult
        };
    } catch (error) {
        logger.error(`createClient::Error while creating client credentials`, error);
        throw error;
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
    } catch (error) {
        logger.error(`Error while revoking client credentials`, error);
        throw error;
    }
};
