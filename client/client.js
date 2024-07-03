import axios from 'axios';
import chalk from 'chalk';

import {Session} from '@wharfkit/session';
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey';

const baseURL = 'http://localhost:3000/api';

async function postProof(proof){

    const chain = {
        id: '20d14b6e421fe21ef1f39061e70f214d5d908b979f379a4feea04294944ddd92',
        url: 'http://127.0.0.1:8888',
    }

    const accountName = 'lightproof'
    const permissionName = 'active'

    const privateKey = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3'

    const walletPlugin = new WalletPluginPrivateKey(privateKey)

    const session = new Session({
        actor: accountName,
        permission: permissionName,
        chain,
        walletPlugin,
    })

    const checkproofAction = {
        account : accountName,
        name : "checkproof",
        authorization: [session.permissionLevel],
        data : {proof:proof}
    }

    console.log("");
    console.log(chalk.magentaBright("--- Proof :"));
    console.log("");
    console.log(chalk.yellow(JSON.stringify(checkproofAction, null, 2)));

    const result = await session.transact({action: checkproofAction}).catch((err)=>console.log(err));

    console.log("");
    console.log(chalk.magentaBright("--- Execution Results :"));
    console.log("");
    console.log(result.response);
    
    if(result.response.transaction_id){

        console.log("");
        console.log(chalk.magentaBright("--- Proof Verification Result : "), chalk.green("Success"));
        console.log("");
    }
           
}

const testStatusEndpoint = async () => {

  console.log("testing status");
  console.log("");

  try {
    const response = await axios.get(`${baseURL}/status`);
    console.log("response : ", response.data);

    console.log("end of satatus test.");
    console.log("");

    await new Promise(r => setTimeout(r, 1000));

    return response.data;

  console.log("");
  } catch (error) {
    console.error('Error testing /status endpoint:', error);
    console.log("");
    process.exit(1);
  }

};

const testProofsEndpoint = async (status) => {

  console.log("testing proofs...");
  console.log("");

  let finality_req = {"type":"finality", "data":{"target_block":status.last_block.final_on_strong_qc_block_num, "qc_block":status.last_block.block_num}};
  let inclusion_req =  {"type":"inclusion", "data":{"target_block":status.last_block.final_on_strong_qc_block_num, "qc_block":status.last_block.block_num}};

  try {
    const response = await axios.post(`${baseURL}/proofs`, finality_req);
    console.log("request : ", finality_req);
    console.log("response : ", response.data);
    console.log("");

    if (response.data.result == "success") postProof(response.data.proof);

  } catch (error) {
    console.log("request : ", finality_req);
    console.error('Error testing /proofs endpoint:', error);
    console.log("");
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1000));

  try {
    const response = await axios.post(`${baseURL}/proofs`, inclusion_req);
    console.log("request : ", inclusion_req);
    console.log("response : ", response.data);
    console.log("");

    if (response.data.result == "success") postProof(response.data.proof);

  } catch (error) {
    console.log("request : ", inclusion_req);
    console.error('Error testing /proofs endpoint:', error);
    console.log("");
    process.exit(1);
  }

  console.log("end of proof test.");

  await new Promise(r => setTimeout(r, 1000));

};

const runTests = async () => {
  let status = await testStatusEndpoint();
  await testProofsEndpoint(status);
};

runTests();