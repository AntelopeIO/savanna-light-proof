import {DB} from './db.js'
import SHIP from './ship.js'
import {Block} from '../structs/block.js'
import {FinalizerPolicy, createOrUpdateFinalizerPolicy} from '../structs/finalizerPolicy.js';

import axios from 'axios';

const GET_INFO_API_ENDPOINT = '/v1/chain/get_info';
const GET_BLOCK_API_ENDPOINT = '/v1/chain/get_block';

async function synchronize(){

  global.db = new DB();
  
  global.ship = new SHIP(global.config.ship_endpoint, onSHIPBlockReceived);
  global.shipRequests = [];

  await global.ship.start();

  catchUp();

}

async function getInfo(){
  return new Promise((resolve,reject) =>{

    const url = global.config.api_endpoint + GET_INFO_API_ENDPOINT;

    axios.post(url, {})
      .then(async (response) => {
        //console.log("Last Irreversible Block is ", response.data.last_irreversible_block_num);
        resolve(response.data);
      })
      .catch(error => {
        console.log("Uncaught exception : ", error);
        process.exit(1);
        reject();
      });

  });
}

async function catchUp(){

  let chainInfo = await getInfo();

  if (chainInfo.last_irreversible_block_num > global.db.getNextBlockNum() + 1){ global.syncing = true; }
  else { global.syncing = false; }

  global.lastClaimedLIB = chainInfo.last_irreversible_block_num;
  
  fetchBlock();

}

function onSHIPBlockReceived(block){
  const request = global.shipRequests.shift();
  if (request) { request.resolve(block); }
  else {
    console.log("Internal error");
    process.exit(1);
  }
}

async function fetchSHIPBlock(blockNum){
  return new Promise((resolve, reject)=>{

    const args = {
      start_block_num: blockNum,
      end_block_num: blockNum+1,
      max_messages_in_flight: 50,
      have_positions: [],
      irreversible_only: true,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: false,
      fetch_finality_data: true
    };

    const request = { resolve, reject };

    global.shipRequests.push(request);
    global.ship.requestBlock(args);

  });

}

function printAPIBlockReceivedInfo(blockNum, category){

  let message = "Received block : " + blockNum + " ";

  if (category == "savanna_genesis") message+=" (Savanna Genesis Block) ";
  else if (category == "savanna_transition") message+=" (Savanna Transition Block) ";
  else if (category == "savanna_block") message+=" (Savanna Block) ";
  else if (category == "legacy_block") message+=" (Legacy Block) ";

  console.log(message);

}

async function fetchAPIBlock(block_num){
  return new Promise((resolve,reject)=>{

    const url = global.config.api_endpoint + GET_BLOCK_API_ENDPOINT;
    const body = { block_num_or_id: block_num  };

    axios.post(url, body)
      .then(async (response) => {

        let isSavannaGenesis = false;
        let isTransitionBlock = false;
        let isLegacyBlock = false;

        if (!response.data.instant_finality_extension) isLegacyBlock = true;
        else if (global.db.savanna_activated == false && response.data.instant_finality_extension){
           isSavannaGenesis = true;
           isTransitionBlock = true;
           global.db.savanna_activated = true;
           global.db.savanna_transition = true;
        }
        else if (global.db.savanna_activated == true){
          isSavannaGenesis = false;
          if (global.db.savanna_transition == true && response.data.qc_extension) {
            isTransitionBlock = false;
            global.db.savanna_transition = false;
          }
          isTransitionBlock = global.db.savanna_transition;
        }

        let category = isSavannaGenesis ? "savanna_genesis" : isTransitionBlock ? "savanna_transition" : isLegacyBlock ? "legacy_block" : "savanna_block";

        printAPIBlockReceivedInfo(response.data.block_num, category);

        resolve(response.data);

      })
      .catch(error => {
        if (error.response?.data?.error?.name == "unknown_block_exception"){
          if (global.syncing == true){
            global.syncing = false;
            console.log("Caught up with chain head.");
          }
          resolve();

        }
        else {
          console.log("Uncaught exception : ", error);
          process.exit(1);
        }
      });

  });
}

function updateFinalizerPolicies(apiData){

  let policy = createOrUpdateFinalizerPolicy(apiData.instant_finality_extension.new_finalizer_policy_diff, global.db.last_pending_finalizer_policy);

  global.db.finalizer_policies.push({"pending_block_num": apiData.block_num, "policy":policy, "status":"pending"});
  global.db.last_pending_finalizer_policy = policy;
  global.db.last_pending_finalizer_policy_digest = policy.digest();
  console.log("New pending finalizer policy : ", global.db.last_pending_finalizer_policy_digest );
  console.log(policy);

}

function processResults(apiData, shipData){
        
    if (apiData.instant_finality_extension){

      if (apiData.instant_finality_extension.new_finalizer_policy_diff) updateFinalizerPolicies(apiData);

      if (!global.db.last_pending_finalizer_policy){
        console.log("internal error");
        process.exit(1);
      }

      let block = new Block(  
        shipData.finality_data.base_digest,
        apiData.block_num,
        apiData.timestamp,
        apiData.previous,
        shipData.finality_data.action_mroot,
        shipData.finality_data.major_version,
        shipData.finality_data.minor_version,
        shipData.finality_data.active_finalizer_policy_generation,
        shipData.finality_data.final_on_strong_qc_block_num,
        apiData.instant_finality_extension?.qc_claim.block_num,
        apiData.instant_finality_extension?.qc_claim.is_strong_qc,
        global.db.last_pending_finalizer_policy.digest(),
        shipData.action_receipts,
        apiData.qc_extension ? apiData.qc_extension : null
      );

      global.db.processBlock(block);

    }
    else global.db.processBlock({block_num:apiData.block_num});
    
}

async function fetchBlock(){

  const block_num = global.db.getNextBlockNum();

  const tasks = [
      { fn: fetchAPIBlock, args: [block_num] },
      { fn: fetchSHIPBlock, args: [block_num] }
  ];

  Promise.all(
    tasks.map(task => task.fn(...task.args))
  ).then(results=>{

    let apiData = results[0];
    let shipData = results[1];

    processResults(apiData, shipData);

    //setTimeout(fetchBlock, 0);

    if (apiData.block_num == global.lastClaimedLIB) catchUp();
    else fetchBlock();

  }).catch(err=>{
    console.log("internal error");
    process.exit(1);
  });

}

export { synchronize };



