
exports.buildSendRawEmailCommand = (data, fromAddress, toAddress) => {
    return {
        RawMessage: {
            Data: data
        },
        Source: fromAddress,
        Destinations: [toAddress]
    };
}

exports.buildRawMessageHeader = (fromName, fromAddress, toAddress, subject, boundary, configurationSetName) => {
    return [
        `From: "${fromName}" <${fromAddress}>`,
        `To: ${toAddress}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        `X-SES-CONFIGURATION-SET: ${configurationSetName}`,
        '',
        `--${boundary}`
    ];
}

exports.buildRawMessageAltContent = (textContent, htmlContent, boundary) => {
    return [
        `Content-Type: multipart/alternative; boundary="alt_boundary"`,
        '',
        `--alt_boundary`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        textContent,
        '',
        `--alt_boundary`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        htmlContent,
        '',
        `--alt_boundary--`,
        '',
        `--${boundary}`
    ];
}

exports.buildRawMessageAttachment = (applicationType, attachmentContent, attachmentFileName, boundary, final) => {
    return [
        `Content-Type: application/${applicationType}; name="${attachmentFileName}"`,
        `Content-Disposition: attachment; filename="${attachmentFileName}"`,
        'Content-Transfer-Encoding: base64',
        '',
        attachmentContent.toString('base64'),
        '',
        final? `--${boundary}--` : `--${boundary}`
    ];
}