const { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand} = require('@aws-sdk/client-s3');
const responseHandler = require('./responseHandler.js')
const fs    = require('fs');
const path  = require('path');

function getS3Client (region) {
    return new S3Client({ forcePathStyle: true, region: region });
}

async function downloadTemplateFromS3 (bucketRegion, bucketName, key) {
    const params = { Bucket: bucketName, Key: key };

    try {
        const s3Client = getS3Client(bucketRegion);
        const command = new GetObjectCommand(params);
        const response = await s3Client.send(command);

        return await response.Body.transformToString('utf-8');
    } catch (error) {
        console.error('Error downloading template from S3:', error);
        throw error;
    }
};

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
    let listObjectsV2CommandInput = {
        Bucket: bucketName,
        Prefix: `${easyRsaBucketPath}/${normalizedPkiDir}`,
        MaxKeys: 1,  // Check for at least one object
        ContinuationToken: continuationToken
    }
    
    while (isTruncated) {
        
        let easyRsaData = await s3Client.send(new ListObjectsV2Command(listObjectsV2CommandInput))
        
        isTruncated = easyRsaData.IsTruncated;
        continuationToken = easyRsaData.NextContinuationToken;
        listObjectsV2CommandInput.ContinuationToken = continuationToken;
        
        if (!continuationToken) {
            if (easyRsaData.Contents && easyRsaData.Contents.length > 0) {
                console.log(`Pki directory DIR "${normalizedPkiDir}" exists in the bucket "${bucketName}"`);
            } else {
                console.log(`Pki directory DIR "${normalizedPkiDir}" does not exist in the bucket "${bucketName}"`);
                return { message: responseHandler.ERROR_MESSAGES.S3_CONTENT_NOT_FOUND(normalizedPkiDir) };
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

            console.log(`Downloading: ${key} to ${localPkiDirPath}`);
            let getCurrentObjectParams = { Bucket: bucketName, Key: key };
            let getCurrentObjectCommand = new GetObjectCommand(getCurrentObjectParams);
            let response = await s3Client.send(getCurrentObjectCommand);

            // Write the object to a local file
            let fileStream = fs.createWriteStream(localPkiDirPath);
            response.Body.on('data', (chunk) => fileStream.write(chunk));
            response.Body.on('end', () => fileStream.end());
            response.Body.on('error', (err) => {
                console.error(`Error writing file: ${localPkiDirPath}`, err);
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
}

async function uploadEasyRSAConfig (bucketRegion, bucketName, easyRsaBucketPath, easyRsaPkiDir, easyRSALocalTmpFolder) {
    let s3Client = null;

    try {
        s3Client = getS3Client(bucketRegion);
    } catch (error) {
        return { message: `${responseHandler.ERROR_MESSAGES.S3_CLIENT_ERROR()}::${error.message}`, error: error };
    }

    const normalizedPkiDir = easyRsaPkiDir.endsWith('/') ? easyRsaPkiDir : `${easyRsaPkiDir}/`;
    const normalizedBucketPath = easyRsaBucketPath.endsWith('/') ? easyRsaBucketPath : `${easyRsaBucketPath}/`;
    const localDirPath = path.join(easyRSALocalTmpFolder, easyRsaPkiDir); //example: /tmp/pki-dev

    // Check if the local directory exists
    if (!fs.existsSync(localDirPath)) {
        console.error(`EasyRsa local directory does not exist: ${localDirPath}`);
        return { message: `${responseHandler.ERROR_MESSAGES.LOCAL_CONTENT_NOT_FOUND(localDirPath)}`};
    }

    // Recursively read all files and folders in the local directory
    const walkDir = (dir) => {
        let filePaths = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                filePaths = filePaths.concat(walkDir(fullPath)); // Recurse into subdirectory
            } else {
                if (fullPath.indexOf('ca.crt') < 0 && fullPath.indexOf('ca.key') < 0) {
                    filePaths.push(fullPath); // Add file path
                }
            }
        }
        return filePaths;
    };

    const filesToUpload = walkDir(localDirPath);

    // Upload to S3
    for (const filePath of filesToUpload) {
        const relativePath = path.relative(localDirPath, filePath); // Get the relative path from the base directory
        const s3Key = path.join(normalizedBucketPath, normalizedPkiDir, relativePath).replace(/\\/g, '/'); // Normalize to S3 key format

        try {
            console.log(`Uploading: ${filePath} to ${bucketName}/${s3Key}`);
            const fileContent = fs.readFileSync(filePath);
            const putObjectCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
                Body: fileContent,
            });
            await s3Client.send(putObjectCommand);
        } catch (error) {
            console.error(`Error uploading file: ${filePath} to ${bucketName}/${s3Key}`, error);
            return { code: "UPLOAD_ERROR", filePath, error };
        }
    }

    console.log(`EasyRSA configuration uploaded to S3 bucket: ${bucketName}, path: ${normalizedBucketPath}${normalizedPkiDir}`);
    return { code: "UPLOAD_SUCCESS", message: "Upload completed successfully" };
}

module.exports = {
    getS3Client,
    downloadTemplateFromS3,
    downloadEasyRSAConfig,
    uploadEasyRSAConfig
}