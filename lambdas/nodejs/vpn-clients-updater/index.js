const easyRsaHandler   = require('./lib/easyRsaHandler.js');
const sesHandler       = require('./lib/sesHandler.js');
const vpnClientHandler = require('./lib/vpnClientHandler.js');
const s3Handler        = require('./lib/s3Handler.js');
const responseHandler  = require('./lib/responseHandler.js');
const path             = require('path');
const ACTIONS = {
    CREATE: 'CREATE',
    REVOKE: 'REVOKE',
    MAIL: 'MAIL'
    //VPNCONFIG: 'VPNCONFIG'
}

exports.handler = async function (event) {
    let { action, clientName, clientEmail, defaultCredentialsDurationDays } = event;
    
    if (!isValidAction(action)) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.INVALID_ACTION(action));
    }

    if (!clientName) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.NULL_CLIENT_NAME(clientName));
    }

    const {
        EASYRSA_BUCKET_NAME: easyRsaBucketName,
        EASYRSA_BUCKET_REGION: easyRsaBucketRegion,
        EASYRSA_PATH: easyRsaBucketPath,
        EASYRSA_PKI_DIR: easyRsaPkiDir
    } = process.env;    

    try {
        let actionResult;
        const easyRSALocalTmpFolder = "/tmp"
        const easyRSABinPath = process.env.EASYRSA_BIN_PATH //Check Dockerfile
        let localPkiDirPath = null;

        switch (action) {
            // case ACTIONS.VPNCONFIG:
            //     if (!clientEmail) {
            //         return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
            //     }
            //     actionResult = await handleVpnConfig(clientName, clientEmail);
            //     break;
            
            case ACTIONS.MAIL: {
                if (!clientEmail) {
                    return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
                }

                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir)

                actionResult = await sendClientCredentials(clientName, clientEmail, easyRSABinPath, localPkiDirPath);
                console.log(`Client credentials dispatch procedure successfully completed`);
                break;
            }
            case ACTIONS.CREATE: {
                if (!clientEmail) {
                    return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
                }
                
                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir);
                
                let createClientResult = await easyRsaHandler.createClient(clientName, clientEmail, easyRSABinPath, localPkiDirPath, defaultCredentialsDurationDays);
                
                await s3Handler.uploadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);

                let sendResult = await sendClientCredentials(clientName, clientEmail, localPkiDirPath);

                actionResult = {
                    ...createClientResult, 
                    sendClientCredentialsResult: sendResult 
                }
                console.log(`Client create procedure successfully completed`);
                break;
            }
            case ACTIONS.REVOKE: {
                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);    
            
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir);
                actionResult = await handleRevokeClient(clientName, easyRSABinPath, localPkiDirPath);

                await s3Handler.uploadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                console.log(`Client revoke procedure successfully completed`);
                break;
            }
            default:
                return responseHandler.createErrorResponse(`Error evaluating action ${action}`);
        }

        return responseHandler.createSuccessResponse(actionResult);
    } catch (error) {
        console.error(`${action} action error:`, error);
        return responseHandler.createErrorResponse(`${action} action error`, error.message);
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


const handleRevokeClient = async (clientName, easyRsaPath, easyRsaPkiDir) => {
    const actionResult = await easyRsaHandler.revokeClient(clientName, easyRsaPath, easyRsaPkiDir);
    const {
        VPN_ENDPOINT_REGION: vpnEpRegion,
        VPN_ENDPOINT_ID: vpnEpId
    } = process.env;
    const crlFilePath = easyRsaPkiDir
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

async function sendClientCredentials(clientName, clientEmail, easyRsaPkiDir) {
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
        { clientName: clientName },
        { easyRsaPkiDir: easyRsaPkiDir});

    return results;
}

const isValidAction = (action) => {
    return action && Object.keys(ACTIONS).includes(action);
}
