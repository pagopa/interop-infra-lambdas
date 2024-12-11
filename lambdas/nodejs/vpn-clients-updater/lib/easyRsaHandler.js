const scriptsWrapper = require('./scriptsWrapper');

exports.createClient = async function (clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays) {
    try {
        const createClientResult = await scriptsWrapper.createClient(clientName, clientEmail, easyRsaPath, easyRsaPkiDir, credentialsDurationDays);
        const isValidClientResult = await scriptsWrapper.isValidClient(clientName, easyRsaPath, easyRsaPkiDir);

        return {
            createResult: createClientResult,
            validityCheckResult: isValidClientResult
        };
    } catch (err) {
        console.error('createClient::Error while creating client credentials:', err);
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
        console.error('Error while revoking client credentials:', err);
        throw err;
    }
};
