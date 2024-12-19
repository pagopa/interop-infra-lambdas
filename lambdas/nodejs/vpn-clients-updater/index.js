const easyRsaHandler   = require('./lib/easyRsaHandler.js');
const sesHandler       = require('./lib/sesHandler.js');
const vpnClientHandler = require('./lib/vpnClientHandler.js');
const s3Handler        = require('./lib/s3Handler.js');
const responseHandler  = require('./lib/responseHandler.js');
const logger           = require('./lib/winstonLogger.js');
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
                logger.info('[ACTIONS.MAIL][Start] EasyRSA config download');
                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                logger.info('[ACTIONS.MAIL][End] EasyRSA config download');
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir)
                
                logger.info('[ACTIONS.MAIL][Start] Send client credentials');
                actionResult = await sendClientCredentials(clientName, clientEmail, easyRSABinPath, localPkiDirPath);
                logger.info('[ACTIONS.MAIL][End] Send client credentials');

                logger.info(`[ACTIONS.MAIL] Client credentials dispatch procedure successfully completed. Result:${JSON.stringify(actionResult)}`);
                break;
            }
            case ACTIONS.CREATE: {
                if (!clientEmail) {
                    return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.NULL_CLIENT_EMAIL(clientEmail));
                }
                
                logger.info(`[ACTIONS.CREATE][Start] EasyRSA config download`);
                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                logger.info(`[ACTIONS.CREATE][End] EasyRSA config download`);
                
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir);
                
                logger.info(`[ACTIONS.CREATE][Start] EasyRSA client creation`);
                let createClientResult = await easyRsaHandler.createClient(clientName, clientEmail, easyRSABinPath, localPkiDirPath, defaultCredentialsDurationDays);
                logger.info(`[ACTIONS.CREATE][End] EasyRSA client creation`);
                
                logger.info(`[ACTIONS.CREATE][Start] EasyRSA configuration upload`);
                await s3Handler.uploadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                logger.info(`[ACTIONS.CREATE][End] EasyRSA configuration upload`);
                
                logger.info(`[ACTIONS.CREATE][Start] Send client credentials`);
                let sendResult = await sendClientCredentials(clientName, clientEmail, localPkiDirPath);
                logger.info(`[ACTIONS.CREATE][End] Send client credentials`);

                actionResult = {
                    ...createClientResult, 
                    sendClientCredentialsResult: sendResult 
                }
                logger.info(`[ACTIONS.CREATE]Client create procedure successfully completed`);
                break;
            }
            case ACTIONS.REVOKE: {
                logger.info(`[ACTIONS.REVOKE][Start] Download EasyRSA config for client ${clientName}`);
                await s3Handler.downloadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);    
                logger.info(`[ACTIONS.REVOKE][End] Download EasyRSA config for client ${clientName}`);
            
                localPkiDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir);

                // Revoke certificate through easyrsa
                logger.info(`[ACTIONS.REVOKE][Start] Revoke client ${clientName}`);
                const revokeResult = await easyRsaHandler.revokeClient(clientName, easyRSABinPath, localPkiDirPath);
                logger.info(`[ACTIONS.REVOKE][End] Revoke client ${clientName}`);
                
                // Update remote crl.pem file on vpn endpoint
                const {
                    VPN_ENDPOINT_REGION: vpnEpRegion,
                    VPN_ENDPOINT_ID: vpnEpId
                } = process.env;
                const crlFilePath = localPkiDirPath;
                const crlFileName = "crl.pem";
            
                logger.info(`[ACTIONS.REVOKE][Start] Update VPN Endpoint CRL for client ${clientName}`);
                const crlUpdateResult = await vpnClientHandler.updateVpnEndpointCRL(vpnEpRegion, vpnEpId, crlFilePath, crlFileName);
                if (!crlUpdateResult) {
                    logger.error(`[ACTIONS.REVOKE][End] Update VPN Endpoint CRL procedure got empty result`);
                    throw new Error(`VPN Endpoint CRL import procedure failed ${JSON.stringify(actionResult)}`);
                }
                logger.info(`[ACTIONS.REVOKE][End] Update VPN Endpoint CRL for client ${clientName}`);

                logger.info(`[ACTIONS.REVOKE][Start] Upload EasyRSA config for client ${clientName}`);
                await s3Handler.uploadEasyRSAConfig(easyRsaBucketRegion, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder);
                logger.info(`[ACTIONS.REVOKE][End] Upload EasyRSA config for client ${clientName}`);

                actionResult = { 
                    ...revokeResult, 
                    crlUpdateResult 
                }

                logger.info(`[ACTIONS.REVOKE] Client revoke procedure successfully completed`);
                break;
            }
            default:
                return responseHandler.createErrorResponse(`[ACTIONS.DEFAULT] Invalid action ${action}`);
        }

        logger.info(`Lambda execution completed with output: ${JSON.stringify(actionResult)}`)
        return responseHandler.createSuccessResponse(actionResult);
    } catch (error) {
        logger.error(`${action} action error:`, error);
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
