
const { EC2Client, ImportClientVpnClientCertificateRevocationListCommand, ExportClientVpnClientConfigurationCommand, DescribeClientVpnEndpointsCommand } = require('@aws-sdk/client-ec2');
const fs = require('fs');

exports.getClientVpnName = async function (vpnClientRegion, vpnEndpointId) {
    const ec2Client = getEC2Client(vpnClientRegion);

    const describeEndpointCommand = new DescribeClientVpnEndpointsCommand({ClientVpnEndpointIds:[vpnEndpointId] });
    const describedEp = await ec2Client.send(describeEndpointCommand);

    let foundEp = describedEp.ClientVpnEndpoints;
    if (foundEp && foundEp.length) {
        foundEp = foundEp.find(ep => ep.ClientVpnEndpointId == vpnEndpointId);

        if (foundEp) {
            const tags = foundEp.Tags;
            if (tags && tags.length) {
                const nameTag = tags.find(t => t.Key == 'Name');
                if (nameTag) {
                    return nameTag.Value;
                }
            }
        }
    }

    return null;
}

exports.getClientVpnConfiguration = async function (vpnClientRegion, vpnEndpointId, clientName) {
    const ec2Client = getEC2Client(vpnClientRegion);
    
    const exportConfigurationCommand = new ExportClientVpnClientConfigurationCommand({ ClientVpnEndpointId: vpnEndpointId });
    const data = await ec2Client.send(exportConfigurationCommand);
    
    const sb = [];
    sb.push(`${data.ClientConfiguration}`);
    sb.push(`\n\rcert <path_to_your_crt>/${clientName}.crt`);
    sb.push(`\nkey <path_to_your_key>/${clientName}.key`);

    return sb.join('');
}

exports.updateVpnEndpointCRL = async function (vpnEndpointRegion, vpnEndpointId, crlFilePath, crlFileName) {
    try {
        const ec2Client = getEC2Client(vpnEndpointRegion);
        const importCRLCommand = new ImportClientVpnClientCertificateRevocationListCommand({
            ClientVpnEndpointId: vpnEndpointId,
            CertificateRevocationList: fs.readFileSync(`${crlFilePath}/${crlFileName}`)
        });
        
        return await ec2Client.send(importCRLCommand);

    } catch (err) {
        console.error(`Error while importing updated CRL on VPN Endpoint ${vpnEndpointId}`, err);
        throw err;
    }
};


const getEC2Client = (region) => new EC2Client({ region });
