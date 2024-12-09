const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const wrapper = require("./lib/scriptsWrapper.js");
const fs = require('fs');
const path = require('path');

const ERROR_MESSAGES = {
    S3_CLIENT_ERROR: () => `Error creating S3 client`,
    S3_DOWNLOAD_ERROR: () => `Error downloading S3 file`,
    S3_PARSING_ERROR: () => `Error parsing S3 file`,
    S3_PROCESSING_ERROR: () => `Error reading JSON file`,
    S3_CONTENT_NOT_FOUND: (expectedContent) => `Error downloading ${expectedContent} from S3 bucket`
}

const getS3Client = (region) => {
    return new S3Client({ forcePathStyle: true, region: region });
}

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

    const easyRSALocalTmpFolder = "/tmp"
    try {
        // Create tmp folder to store easyrsa contents
        if (!fs.existsSync(easyRSALocalTmpFolder)) {
            fs.mkdirSync(easyRSALocalTmpFolder, { recursive: true });
        }

        // Download pki-dir
        const normalizedPkiDir = easyRsaPkiDir.endsWith('/') ? easyRsaPkiDir : `${easyRsaPkiDir}/`;

        // List all objects in the specified easyrsa folder
        let isTruncated = true;
        let continuationToken = null;
        
        while (isTruncated) {
            const listObjectsV2CommandInput = {
                Bucket: easyRsaBucketName,
                Prefix: `${easyRsaBucketPath}/${normalizedPkiDir}`,
                MaxKeys: 1,  // Check for at least one object
                ContinuationToken: continuationToken
            }
           const easyRsaData = await s3Client.send(new ListObjectsV2Command(listObjectsV2CommandInput))
            
            isTruncated = easyRsaData.IsTruncated;
            continuationToken = easyRsaData.NextContinuationToken;
            
            if (easyRsaData.Contents && easyRsaData.Contents.length > 0) {
                console.log(`Pki directory DIR "${normalizedPkiDir}" exists in the bucket "${easyRsaBucketName}"`);
            } else {
                console.log(`Pki directory DIR "${normalizedPkiDir}" does not exist in the bucket "${easyRsaBucketName}"`);
                return createErrorResponse(ERROR_MESSAGES.S3_CONTENT_NOT_FOUND(normalizedPkiDir));
            }
            
            for (const obj of easyRsaData.Contents) {
                

                const key = obj.Key;
                const relativePath = key.slice(normalizedPkiDir.length); // Remove folder prefix
                const localFilePath = path.join(easyRSALocalTmpFolder, relativePath);

                if (key.endsWith('/')) {
                    // key is a folder without any content, skip but create local dir
                    console.log(`Skipping download directory: ${key}`);
                    if (!fs.existsSync(localFilePath)) {
                        fs.mkdirSync(localFilePath, { recursive: true });
                    }
                    continue;
                } else {
                    const localFileDir = path.dirname(localFilePath);
                    console.log("localFileDir: ",localFileDir)
                    if (!fs.existsSync(localFileDir)) {
                        fs.mkdirSync(localFileDir, { recursive: true });
                    }
                }                

                console.log(`Downloading: ${key} to ${localFilePath}`);
                let getCurrentObjectParams = { Bucket: easyRsaBucketName, Key: key };
                let getCurrentObjectCommand = new GetObjectCommand(getCurrentObjectParams);
                let response = await s3Client.send(getCurrentObjectCommand);

                // Write the object to a local file
                let fileStream = fs.createWriteStream(localFilePath);
                response.Body.on('data', (chunk) => fileStream.write(chunk));
                response.Body.on('end', () => fileStream.end());
                response.Body.on('error', (err) => {
                    console.error(`Error writing file: ${localFilePath}`, err);
                    throw err;
                });

                // Ensure the stream finishes before continuing
                await new Promise((resolve, reject) => {
                    fileStream.on('finish', resolve);
                    fileStream.on('error', reject);
                });
            }

            // Check if there are more objects to fetch
            isTruncated = easyRsaData.IsTruncated;
            continuationToken = easyRsaData.NextContinuationToken;
        }

        console.log(`EasyRSA configuration downloaded to: ${easyRSALocalTmpFolder}`);
    } catch (error) {
        console.log(error)
        return createErrorResponse(ERROR_MESSAGES.S3_DOWNLOAD_ERROR, error);
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

