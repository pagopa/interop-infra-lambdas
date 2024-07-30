
const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
const zipUtils = require('./zipUtils.js');
const s3Utils = require('./s3Handler.js');
const sesUtils = require('./sesUtils.js');
const vpnClientUtils = require('./vpnClientHandler.js');

/*
 Supported mime types: https://docs.aws.amazon.com/ses/latest/dg/mime-types.html -> no cer, crt
 Send raw email: https://docs.aws.amazon.com/ses/latest/dg/send-email-raw.html
 Code examples: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_ses_code_examples.html
 */
exports.sendClientCredentials = async function (
  { sesRegion, sesConfigurationSetName },
  { vpnClientRegion, vpnEndpointId },
  { mailTemplateBucketName, mailTemplateBucketKey, mailTemplateBucketRegion },
  { fromName, fromAddress, toAddress, subject }, 
  { clientName }) 
{
    try {        
        
        // Setup raw email header and content
        subject = subject || "PagoPA VPN Credentials";
        const boundary = "----=_Part_0_123456789.1234567890123456789";
        const bodyText = "Hello,\nPlease find the attached credentials zip file.\nBest regards.";
        const template = await s3Utils.downloadTemplateFromS3(mailTemplateBucketRegion, mailTemplateBucketName, mailTemplateBucketKey);
        const replacements = { name: clientName }; //TODO rivedere template ed aggiornare eventuali replacement
        const bodyHtml = replacePlaceholders(template, replacements);
        
        const rawMessage = await buildClientCredentialsEmailMessage(
            { fromName: fromName, fromAddress: fromAddress, toAddress: toAddress }, 
            { subject: subject, bodyText: bodyText, bodyHtml: bodyHtml },
            { vpnClientRegion: vpnClientRegion , vpnEndpointId: vpnEndpointId },
            boundary, sesConfigurationSetName, clientName);
        
        const result = await sendRawEmail(sesRegion, fromAddress, toAddress, rawMessage);
        
        console.log('VPN Client credentials sent successfully');
        // console.log(JSON.stringify(rawMessage))
        return result;

    } catch (err) {
        console.error(`Error while sending client ${clientName} certificate through AWS SES`, err);
        throw err;
    }
}


const getSESClient = (region) => new SESClient({ region });

const buildClientCredentialsEmailMessage = async (
    { fromName, fromAddress, toAddress }, 
    { subject, bodyText, bodyHtml }, 
    { vpnClientRegion, vpnEndpointId },
    boundary, sesConfigurationSetName, clientName) => 
{
    // Build credentials zip attachment
    const { credentialsAttachmentName, credentialsAttachmentContent } = await buildCredentialsAttachment(clientName);

    // Build vpn config file attachment
    const { vpnConfigAttachmentName, vpnConfigAttachmentContent } = await buildVpnConfigAttachment(vpnClientRegion, vpnEndpointId, clientName);
     return [
       ...sesUtils.buildRawMessageHeader(fromName, fromAddress, toAddress, subject, boundary, sesConfigurationSetName),
       ...sesUtils.buildRawMessageAltContent(bodyText, bodyHtml, boundary),
       ...sesUtils.buildRawMessageAttachment('zip', credentialsAttachmentContent, credentialsAttachmentName, boundary),
       ...sesUtils.buildRawMessageAttachment('x-openvpn-profile', vpnConfigAttachmentContent, vpnConfigAttachmentName, boundary, true)
     ].join('\r\n');
};


const sendRawEmail = async (sesRegion, fromAddress, toAddress, rawMessage) => {
    const sesClient = getSESClient(sesRegion);

    const command = new SendRawEmailCommand(sesUtils.buildSendRawEmailCommand(rawMessage, fromAddress, toAddress));
    return await sesClient.send(command);
}

const replacePlaceholders = (template, replacements) => {
    return template.replace(/{{(\w+)}}/g, (_, key) => replacements[key] || '');
}

const buildCredentialsAttachment = async (clientName) => {
    const easyrsaPkiDir = process.env.EASYRSA_PKI_DIR;
    const files = [ `${easyrsaPkiDir}/issued/${clientName}.crt`, `${easyrsaPkiDir}/private/${clientName}.key` ];
    const zipName = 'credentials.zip';
    const zipBuffer = await zipUtils.createZip(files);
    
    return {
        credentialsAttachmentName: zipName,
        credentialsAttachmentContent:  zipBuffer
    }
}

const buildVpnConfigAttachment = async (vpnClientRegion, vpnEndpointId, clientName) => {
    let vpnFileName = await vpnClientUtils.getClientVpnName(vpnClientRegion, vpnEndpointId);
    if (!vpnFileName) {
        vpnFileName = 'vpn-config';
    }
    const vpnClientConfig = await vpnClientUtils.getClientVpnConfiguration(vpnClientRegion, vpnEndpointId, clientName);
    
    return {
        vpnConfigAttachmentName: `${vpnFileName}.ovpn`,
        vpnConfigAttachmentContent: Buffer.from(vpnClientConfig, 'utf-8')
    }
}