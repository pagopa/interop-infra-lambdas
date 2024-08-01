const easyRsaHandler = require('./lib/easyRsaHandler.js');
const sesHandler = require('./lib/sesHandler.js');
const vpnClientHandler = require('./lib/vpnClientHandler.js');

const ACTIONS = {
    CREATE: 'CREATE',
    REVOKE: 'REVOKE',
    MAIL: 'MAIL'
    //VPNCONFIG: 'VPNCONFIG'
}

const ERROR_MESSAGES = {
    INVALID_ACTION: (action) => `Action must be defined, allowed: ${Object.keys(ACTIONS)}, found: ${action}`,
    NULL_CLIENT_NAME: (clientName) => `clientName cannot be null, found ${clientName}`,
    NULL_CLIENT_EMAIL: (clientEmail) => `clientEmail cannot be null, found ${clientEmail}`
}

exports.handler = async function (event) {
    const { action, clientName, clientEmail, defaultCredentialsDurationDays } = event;

    if (!isValidAction(action)) {
        return createErrorResponse(ERROR_MESSAGES.INVALID_ACTION(action));
    }

    if (!clientName) {
        return createErrorResponse(ERROR_MESSAGES.NULL_CLIENT_NAME(clientName));
    }
    
    try {
        let actionResult;
        
        switch (action) {
            // case ACTIONS.VPNCONFIG:
            //     if (!clientEmail) {
            //         return createErrorResponse(ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
            //     }
            //     actionResult = await handleVpnConfig(clientName, clientEmail);
            //     break;

            case ACTIONS.MAIL:
                if (!clientEmail) {
                    return createErrorResponse(ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
                }
                actionResult = await sendClientCredentials(clientName, clientEmail);
                console.log(`Client credentials dispatch procedure successfully completed`);
                break;

            case ACTIONS.CREATE:
                if (!clientEmail) {
                    return createErrorResponse(ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
                }
                actionResult = await handleCreateClient(clientName, clientEmail, defaultCredentialsDurationDays);
                console.log(`Client create procedure successfully completed`);
                break;

            case ACTIONS.REVOKE:
                actionResult = await handleRevokeClient(clientName);
                console.log(`Client revoke procedure successfully completed`);
                break;

            default:
                return createErrorResponse(`Error evaluating action ${action}`);
        }

        return createSuccessResponse(actionResult);
    } catch (error) {
        console.error(`${action} action error:`, error);
        return createErrorResponse(`${action} action error`, error.message);
    }
}

// const handleVpnConfig = async (clientName, clientEmail) => {
//     const {
//         VPN_ENDPOINT_ID: vpnClientEndpointId,
//         VPN_ENDPOINT_REGION: vpnEpRegion,
//         VPN_SES_CONFIGURATION_SET_NAME: configurationSetName,
//         VPN_SES_SENDER: vpnSesSender
//     } = process.env;

//     return sesHandler.sendVPNClientConfiguration(
//         { sesRegion: vpnEpRegion, sesConfigurationSetName: configurationSetName },
//         { vpnClientRegion: vpnEpRegion, vpnEndpointId: vpnClientEndpointId },
//         { fromAddress: vpnSesSender, toAddress: clientEmail },
//         { clientName }
//     );
// };

const handleCreateClient = async (clientName, clientEmail, defaultCredentialsDurationDays) => {
    const createClientResult = await easyRsaHandler.createClient(clientName, clientEmail, defaultCredentialsDurationDays);
    const sendResult = await sendClientCredentials(clientName, clientEmail);

    return { 
        ...createClientResult, 
        sendClientCredentialsResult: sendResult 
    };
};

const handleRevokeClient = async (clientName) => {
    const actionResult = await easyRsaHandler.revokeClient(clientName);
    const {
        VPN_ENDPOINT_REGION: vpnEpRegion,
        VPN_ENDPOINT_ID: vpnEpId,
        EASYRSA_PKI_DIR: crlFilePath
    } = process.env;
    const crlFileName = "crl.pem";

    const crlUpdateResult = await vpnClientHandler.updateVpnEndpointCRL(vpnEpRegion, vpnEpId, crlFilePath, crlFileName);
    if (!crlUpdateResult) {
        throw new Error(`VPN Endpoint CRL import procedure failed ${JSON.stringify(actionResult)}`);
    }

    return { 
        ...actionResult, 
        crlUpdateResult 
    };
};

async function sendClientCredentials(clientName, clientEmail) {
    const {
        VPN_ENDPOINT_REGION: vpnEpRegion,
        VPN_ENDPOINT_ID: vpnClientEndpointId,
        VPN_SES_SENDER: vpnSesSender,
        VPN_SES_SENDER_NAME: vpnSesSenderName,
        VPN_SES_CONFIGURATION_SET_NAME: sesConfigurationSetName,
        VPN_SEND_MAIL_TEMPLATE_BUCKET_NAME: mailTemplateBucketName,
        VPN_SEND_MAIL_TEMPLATE_KEY_NAME: mailTemplateBucketKey,
        VPN_SEND_MAIL_TEMPLATE_BUCKET_REGION: mailTemplateBucketRegion,
        VPN_SEND_MAIL_SUBJECT: clientCredentialsMailSubject
    } = process.env;

    const results = {
        sendClientCredentials: null
    };
    
    results['sendClientCredentials'] = await sesHandler.sendClientCredentials(
        { sesRegion: vpnEpRegion, sesConfigurationSetName: sesConfigurationSetName }, 
        { vpnClientRegion: vpnEpRegion, vpnEndpointId: vpnClientEndpointId }, 
        { mailTemplateBucketName: mailTemplateBucketName, mailTemplateBucketKey: mailTemplateBucketKey, mailTemplateBucketRegion: mailTemplateBucketRegion },
        { fromName: vpnSesSenderName, fromAddress: vpnSesSender, toAddress: clientEmail, subject: clientCredentialsMailSubject }, 
        { clientName: clientName });

    return results;
}

const isValidAction = (action) => {
    return action && Object.keys(ACTIONS).includes(action);
}

const createErrorResponse = (message, error = null) => {
    console.error(message);

    return {
        statusCode: 500,
        body: JSON.stringify({
            message,
            error
        })
    };
}

const createSuccessResponse = (result) => {
    return {
        statusCode: 200,
        body: JSON.stringify(result)
    };
}