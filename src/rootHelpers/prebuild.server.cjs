const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const tar = require('tar');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

function generateSecureRandomNumber() {
  const buffer = crypto.randomBytes(4);
  let number = buffer.readUInt32BE(0);
  number = number % 1000000;
  return number.toString().padStart(6, '0');
}

async function fetchHPP(env) {
  const randomNumber = generateSecureRandomNumber();
  let url;

  switch (env) {
    case 'dev':
      url = 'https://www.akakce.dev/include/aa/styles/_pcss.v9.asp?minifyrequest=0&mobilephpp&' + randomNumber;
      break;
    case 'test':
      url = 'https://www.bakakce.com/styles/mobilephpp.css?' + randomNumber;
      break;
    case 'prod':
      url = 'https://st.akakce.com/styles/mobilephpp.css?' + randomNumber;
      break;
    default:
      url = 'https://st.akakce.com/styles/mobilephpp.css';
  }

  const response = await fetch(url);
  return await response.text();
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < parts1.length; ++i) {
    if (parts2.length === i) {
      return 1;
    }

    if (parts1[i] !== parts2[i]) {
      return parts1[i] > parts2[i] ? 1 : -1;
    }
  }

  return parts1.length < parts2.length ? -1 : 0;
}

async function getLatestLibraryVersion(env) {
  let versionPrefix;
  switch (env) {
    case 'dev':
      versionPrefix = '0.0';
      break;
    case 'test':
      versionPrefix = '1.0';
      break;
    case 'prod':
      versionPrefix = '2.0';
      break;
    default:
      throw new Error('Unknown environment');
  }

  const data = await fetch(
    `https://nexus.bakakce.com/service/rest/v1/search?repository=npm&name=fe_lib_uikit_web&version=${versionPrefix}.*`
  ).then((response) => response.json());

  const versions = data.items.map((item) => item.version);
  const latestVersion = versions.sort((a, b) => compareVersions(a, b)).pop();
  return latestVersion;
}

function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close(resolve);
          });
        } else {
          file.close();
          fs.unlink(outputPath, () => {});
          reject(`Response status was ${response.statusCode}`);
        }
      })
      .on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err.message);
      });
  });
}

async function extractTgz(sourcePath, targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  fs.mkdirSync(targetDir, { recursive: true });

  await streamPipeline(fs.createReadStream(sourcePath), zlib.createGunzip(), tar.extract({ cwd: targetDir }));

  fs.unlinkSync(sourcePath);
}

async function main() {
  const env = process.env.SELF__RUNNING_ENV || 'prod';
  try {
    const hppString = await fetchHPP(env);
    const stringToWrite = 'export const mobilep = String.raw`/*HPCSS*/' + hppString + '/*/HPCSS*/`;';

    fs.writeFile('src/constants/hpp.ts', stringToWrite, function (err) {
      if (err) return console.error(err);
      console.log('mobilehpp css file fetched and created successfully.');
    });
  } catch (error) {
    console.error('Failed to update the mobilehpp css file:', error);
    process.exit(1);
  }
  try {
    const latestVersion = await getLatestLibraryVersion(env);
    console.log('latest uikit version: ', latestVersion);
    const libraryUrl = `https://nexus.bakakce.com/repository/npm/fe_lib_uikit_web/-/fe_lib_uikit_web-${latestVersion}.tgz`;
    const tempFilePath = 'library.tgz';
    const targetDir = 'src/uikit/';

    await downloadFile(libraryUrl, tempFilePath);
    await extractTgz(tempFilePath, targetDir);
    console.log('uikit updated successfully.');
  } catch (error) {
    console.error('Failed to update the uikit:', error);
    process.exit(1);
  }
}

main();
