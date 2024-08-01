const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

exports.downloadTemplateFromS3 = async function (bucketRegion, bucketName, key) {
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

const getS3Client = (region) => new S3Client({ region: region });
