const ERROR_MESSAGES = {
    EASYRSA_DIFF_ERROR: () => ``,
    S3_CLIENT_ERROR: () => `Error creating S3 client`,
    S3_DOWNLOAD_ERROR: () => `Error downloading S3 file`,
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
