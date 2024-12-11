const wrapper         = require("./lib/scriptsWrapper.js");
const s3Handler       = require("./lib/s3Handler.js");
const responseHandler = require("./lib/responseHandler.js");

exports.handler = async function () {
    const {
        VPN_CLIENTS_BUCKET_NAME: vpnClientsBucketName,
        VPN_CLIENTS_KEY_NAME: vpnClientsKeyName,
        VPN_CLIENTS_BUCKET_REGION: s3Region,
        EASYRSA_BUCKET_NAME: easyRsaBucketName,
        EASYRSA_PATH: easyRsaBucketPath,
        EASYRSA_PKI_DIR: easyRsaPkiDir
    } = process.env;
    
    let parsedClients;
    let s3fileContent;

    try {
        s3fileContent = await s3Handler.downloadVPNClientsFile(s3Region, vpnClientsBucketName, vpnClientsKeyName);
    } catch (error) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.S3_DOWNLOAD_ERROR(), error);
    }
    
    try {
        parsedClients = JSON.parse(s3fileContent);
    } catch (error) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.S3_PARSING_ERROR(), error);
    }

    const easyRSALocalTmpFolder = "/tmp"
    try {
        await s3Handler.downloadEasyRSAConfig(s3Region, easyRsaBucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder)
    } catch (error) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.S3_DOWNLOAD_ERROR(), error);
    }
    
    try {
        let validUsers = [];
        let result = await wrapper.listValidClients(easyRSALocalTmpFolder, easyRsaPkiDir);
        
        if (result) {
            validUsers = result.replaceAll('\n','').replaceAll('\t','');
            if (validUsers) {
                validUsers = validUsers.split(' ').map(valid => valid.replace("/CN=", ""));
            } else {
                validUsers = [];
            }
        }

        //  if some valid user is not in input json data it means the certificate has been revoked
        //  if some input json user is not in valid users it means the certificate should be created
        const inputClientIds = parsedClients['clients'].map(user => user.client_name);
        
        // Compute clients to revoke
        const clientsTorevoke = validUsers.filter(existingClient => !inputClientIds.includes(existingClient));
        const revoke = clientsTorevoke.map(ctr => {
            return {
                "client_name": ctr 
            }
        });
        
        // Compute clients to create
        const create = [];
        for (let inputUser of parsedClients['clients']) {
            const foundValidUser = validUsers.find(client => client == inputUser.client_name);
            if (!foundValidUser) {
                create.push({...inputUser});
            }
        }

        console.log(`Clients diff procedure successfully completed (# clients to create: ${create.length}, # clients to revoke ${revoke.length})`);

        const lambdaOutput = {
            clients: {
                create: create,
                revoke: revoke
            }
        };
        
        return responseHandler.createSuccessResponse(lambdaOutput);

    } catch (error) {
        return responseHandler.createErrorResponse(responseHandler.ERROR_MESSAGES.EASYRSA_DIFF_ERROR(), error);
    }
};
