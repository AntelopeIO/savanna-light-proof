import fs from 'fs';
import path from 'path';
import stripJsonComments from 'strip-json-comments';

import { Serialize }  from 'enf-eosjs';
import { SerialBuffer, createInitialTypes } from 'enf-eosjs/dist/eosjs-serialize.js';

const types = createInitialTypes();

function fileExists(filePath) {
  return fs.promises.access(filePath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
}

async function validateConfig(config){
  return true;
}

async function readJSONCFile(filePath) {
  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      console.log(`Configuration file ${filePath} does not exist.`);
      process.exit(1);
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const jsonContent = JSON.parse(stripJsonComments(fileContent));

    if (!validateConfig(jsonContent)){
      console.error(`Error validating configuration file.`);
      process.exit(1);
    }

    return jsonContent;
  } catch (error) {
    console.error(`Error reading or parsing configuration file ${filePath}:`, error);
    process.exit(1);
  }
}

async function readABIFile(name, filePath) {
  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      console.log(`Configuration file ${filePath} does not exist.`);
      process.exit(1);
    }

    const fileContent = await fs.promises.readFile(filePath, 'utf-8');

    return Serialize.getTypesFromAbi(Serialize.createInitialTypes(), JSON.parse(fileContent)) ;

  } catch (error) {
    console.error(`Error reading or parsing configuration file ${filePath}:`, error);
    process.exit(1);
  }
}

async function loadConfig() {

  global.config = await readJSONCFile(path.join('config.jsonc'));
  global.eosioABI = await readABIFile("eosio", path.join('eosio.abi'));
  global.ibcABI = await readABIFile("ibc", path.join('ibc.abi'));
  
  console.log('Configuration loaded.');
  console.log(global.config);
}

export { loadConfig };
