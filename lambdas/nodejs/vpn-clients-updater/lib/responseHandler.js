
const ERROR_MESSAGES = {
    INVALID_ACTION: (action) => `Action must be defined, allowed: ${Object.keys(ACTIONS)}, found: ${action}`,
    NULL_CLIENT_NAME: (clientName) => `clientName cannot be null, found ${clientName}`,
    NULL_CLIENT_EMAIL: (clientEmail) => `clientEmail cannot be null, found ${clientEmail}`,
    LOCAL_CONTENT_NOT_FOUND: (expectedContent) => `${expectedContent} not found on local filesystem`,
    S3_CLIENT_ERROR: () => `Error creating S3 client`,
    S3_DOWNLOAD_ERROR: () => `Error downloading S3 file`,
    S3_UPLOAD_ERROR: () => `Error uploading S3 file`,
    S3_PARSING_ERROR: () => `Error parsing S3 file`,
    S3_PROCESSING_ERROR: () => `Error reading JSON file`,
    S3_CONTENT_NOT_FOUND: (expectedContent) => `Error downloading ${expectedContent} from S3 bucket`
}

const createErrorResponse = (message, error = null) => {
    return {
        statusCode: 500,
        body: JSON.stringify({
            message,
            error
        })
    };
}

const createSuccessResponse = (body) => {
    return {
        statusCode: 200,
        body: body
    };
}

module.exports = {
    ERROR_MESSAGES,
    createSuccessResponse,
    createErrorResponse
}
