const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const wrapper = require("./lib/scriptsWrapper.js");

const ERROR_MESSAGES = {
    S3_CLIENT_ERROR: () => `Error creating S3 client`,
    S3_DOWNLOAD_ERROR: () => `Error downloading S3 file`,
    S3_PARSING_ERROR: () => `Error parsing S3 file`,
    S3_PROCESSING_ERROR: () => `Error reading JSON file`
}

const getS3Client = (region) => {
    return new S3Client({ forcePathStyle: true, region: region });
}

exports.handler = async function () {
    const {
        VPN_CLIENTS_BUCKET_NAME: vpnClientsBucketName,
        VPN_CLIENTS_KEY_NAME: vpnClientsKeyName,
        VPN_CLIENTS_BUCKET_REGION: s3Region
    } = process.env;
    
    let parsedClients;
    let s3fileContent;
    let s3Client;

    try {
        s3Client = getS3Client(s3Region);
    } catch (error) {
        return createErrorResponse(ERROR_MESSAGES.S3_CLIENT_ERROR, error);
    }

    try {
        // Download clients file from S3
        const getObjectCommandInput = {
            Bucket: vpnClientsBucketName,
            Key: vpnClientsKeyName
        };
        const getObjectCommandResponse = await s3Client.send(new GetObjectCommand(getObjectCommandInput));

        s3fileContent = await getObjectCommandResponse.Body.transformToString('utf-8');
    } catch (error) {
        return createErrorResponse(ERROR_MESSAGES.S3_DOWNLOAD_ERROR, error);
    }
    
    try {
        parsedClients = JSON.parse(s3fileContent);
    } catch (error) {
        return createErrorResponse(ERROR_MESSAGES.S3_PARSING_ERROR, error);
    }

    try {
        let validUsers = [];
        let result = await wrapper.listValidClients();
        
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
        
        return createSuccessResponse(lambdaOutput);

    } catch (error) {
        return createErrorResponse(ERROR_MESSAGES.S3_PROCESSING_ERROR, error);
    }
};

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
        body: result
    };
}
