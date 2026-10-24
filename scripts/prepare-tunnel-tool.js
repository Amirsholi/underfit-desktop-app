const fs = require('fs');
const path = require('path');
const https = require('https');

const destinationDirectory = path.join(__dirname, '..', 'release', 'tools');
const destination = path.join(destinationDirectory, 'cloudflared.exe');
const downloadUrl = process.env.UNDERFIT_CLOUDFLARED_URL
  || 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function download(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'UnderFit-Build' } }, response => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location &&
        redirectsLeft > 0
      ) {
        response.resume();
        resolve(download(new URL(response.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Cloudflared respondió HTTP ${response.statusCode}.`));
        return;
      }
      const temporary = `${destination}.download`;
      fs.mkdirSync(destinationDirectory, { recursive: true });
      const file = fs.createWriteStream(temporary);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        const header = Buffer.alloc(2);
        const descriptor = fs.openSync(temporary, 'r');
        fs.readSync(descriptor, header, 0, 2, 0);
        fs.closeSync(descriptor);
        const size = fs.statSync(temporary).size;
        if (header.toString('ascii') !== 'MZ' || size < 1024 * 1024) {
          fs.rmSync(temporary, { force: true });
          reject(new Error('La descarga de cloudflared no es un ejecutable Windows válido.'));
          return;
        }
        fs.renameSync(temporary, destination);
        resolve();
      });
      file.on('error', error => {
        fs.rmSync(temporary, { force: true });
        reject(error);
      });
    }).on('error', reject);
  });
}

download(downloadUrl)
  .then(() => console.log(`Cloudflared preparado para el instalador: ${destination}`))
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
