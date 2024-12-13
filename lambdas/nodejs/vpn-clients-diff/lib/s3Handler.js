const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const responseHandler = require('./responseHandler.js');
const fs   = require('fs');
const path = require('path');
const logger = require('./winstonLogger.js');

function getS3Client (region) {
    return new S3Client({ forcePathStyle: true, region: region });
}

async function downloadVPNClientsFile(bucketRegion, bucketName, fileKey) {
    const s3Client = getS3Client(bucketRegion);

    // Download clients file from S3
    const getObjectCommandInput = {
        Bucket: bucketName,
        Key: fileKey
    };
    logger.info(`downloadVPNClientsFile::Start VPN Clients file download`);
    const getObjectCommandResponse = await s3Client.send(new GetObjectCommand(getObjectCommandInput));
    logger.info(`downloadVPNClientsFile::End VPN Clients file download`);

    return await getObjectCommandResponse.Body.transformToString('utf-8');
}

async function downloadEasyRSAConfig (bucketRegion, bucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder) {
    let s3Client = null;
    
    try {
        s3Client = getS3Client(bucketRegion);
    } catch (error) {
        return { message: `${responseHandler.ERROR_MESSAGES.S3_CLIENT_ERROR()}::${error.message}`, error: error };
    }

    // Create tmp folder to store easyrsa contents
    if (!fs.existsSync(easyRSALocalTmpFolder)) {
        fs.mkdirSync(easyRSALocalTmpFolder, { recursive: true });
    }

    // Download pki-dir
    const normalizedPkiDir = easyRsaPkiDir.endsWith('/') ? easyRsaPkiDir : `${easyRsaPkiDir}/`;

    // List all objects in the specified easyrsa folder
    let isTruncated = true;
    let continuationToken = null;
    let pkiDirFullPath = `${easyRsaBucketPath}/${normalizedPkiDir}`
    let listObjectsV2CommandInput = {
        Bucket: bucketName,
        Prefix: pkiDirFullPath,
        MaxKeys: 1,  // Check for at least one object
        ContinuationToken: continuationToken
    }
    logger.info(`downloadEasyRSAConfig::Start EasyRSA configuration download`);
    while (isTruncated) {
        
        let easyRsaData = await s3Client.send(new ListObjectsV2Command(listObjectsV2CommandInput))
      
        if (!continuationToken) {
            if (easyRsaData.Contents && easyRsaData.Contents.length > 0) {
                console.log(`downloadEasyRSAConfig::Pki directory DIR "${pkiDirFullPath}" exists in the bucket "${bucketName}"`);
            } else {
                console.log(`downloadEasyRSAConfig::Pki directory DIR "${pkiDirFullPath}" does not exist in the bucket "${bucketName}"`);
                throw Error(responseHandler.ERROR_MESSAGES.S3_CONTENT_NOT_FOUND(pkiDirFullPath));
            }
        }
        
        for (const obj of easyRsaData.Contents) {
            
            const key = obj.Key;
            const relativePath = key.slice(normalizedPkiDir.length); // Remove folder prefix
            const localPkiDirPath = path.join(easyRSALocalTmpFolder, relativePath);

            if (key.endsWith('/')) {
                // key is a folder without any content, skip but create local dir
                if (!fs.existsSync(localPkiDirPath)) {
                    fs.mkdirSync(localPkiDirPath, { recursive: true });
                }
                continue;
            } else {
                const localFileDir = path.dirname(localPkiDirPath);
                if (!fs.existsSync(localFileDir)) {
                    fs.mkdirSync(localFileDir, { recursive: true });
                }
            }                

            logger.log(`downloadEasyRSAConfig::Downloading: ${key} to ${localPkiDirPath}`);
            let getCurrentObjectParams = { Bucket: bucketName, Key: key };
            let getCurrentObjectCommand = new GetObjectCommand(getCurrentObjectParams);
            let response = await s3Client.send(getCurrentObjectCommand);

            // Write the object to a local file
            let fileStream = fs.createWriteStream(localPkiDirPath);
            response.Body.on('data', (chunk) => fileStream.write(chunk));
            response.Body.on('end', () => fileStream.end());
            response.Body.on('error', (err) => {
                logger.error(`downloadEasyRSAConfig::Error writing file: ${localPkiDirPath}`, err);
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
        listObjectsV2CommandInput.ContinuationToken = continuationToken;
    }

    logger.info(`downloadEasyRSAConfig::End EasyRSA configuration downloaded in folder: ${easyRSALocalTmpFolder}`);
}

module.exports = {
    getS3Client,
    downloadVPNClientsFile,
    downloadEasyRSAConfig
}