const scriptsWrapper = require('./scriptsWrapper');

exports.createClient = async function (clientName, clientEmail) {
    try {
        const createClientResult = await scriptsWrapper.createClient(clientName, clientEmail);
        const isValidClientResult = await scriptsWrapper.isValidClient(clientName);

        return {
            createResult: createClientResult,
            validityCheckResult: isValidClientResult
        };
    } catch (err) {
        console.error('createClient::Error while creating client credentials:', err);
        throw err;
    }
};

exports.revokeClient = async function (clientName) {
    try {
        const revokeClientResult = await scriptsWrapper.revokeClient(clientName);
        const isRevokedClientResult = await scriptsWrapper.isRevokedClient(clientName);

        return {
            revokeResult: revokeClientResult,
            revokedCheckResult: isRevokedClientResult
        };
    } catch (err) {
        console.error('Error while revoking client credentials:', err);
        throw err;
    }
};
