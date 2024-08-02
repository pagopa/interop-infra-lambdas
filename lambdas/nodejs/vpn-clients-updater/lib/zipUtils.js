const { Buffer } = require('buffer');
const archiver = require('archiver');
const path = require('path');

exports.createZip = function (files) {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip');
        const buffers = [];
    
        archive.on('data', data => buffers.push(data));
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', err => reject(err));
    
        files.forEach(file => {
            archive.file(file, { name: path.basename(file) });
        });
    
        archive.finalize();
    });   
}