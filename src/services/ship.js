import { Serialize } from 'enf-eosjs';
import { SerialBuffer, createInitialTypes } from 'enf-eosjs/dist/eosjs-serialize.js';

import { getReceiptDigest} from '../services/utils.js';

import WebSocket from 'ws';

class SHIP {

  constructor(endpoint, blockReceivedHandler) {
    this.requestsQueue = [];
    this.abi = null;
    this.types = null;
    this.blocksQueue = [];
    this.inProcessBlocks = false;
    this.currentArgs = null;
    this.connectionRetries = 0;
    this.maxConnectionRetries = 100;
    this.endpoint = endpoint;
    this.blockReceivedHandler = blockReceivedHandler;
  }

  start(){
    return new Promise((resolve, resject)=>{
      this.ws = new WebSocket(this.endpoint, { perMessageDeflate: false });
      this.ws.on('message', async data =>{
        this.connectionRetries=0;
        if (!this.abi) {
            this.abi = JSON.parse(data);
            this.types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), this.abi);
            resolve();
        }
        else{
          const [type, response] = this.deserialize('result', data);
          await this[type](response);
        }
      });

      this.ws.on('close', code => {
        if (code!==1000) console.error(`Websocket disconnected from ${this.endpoint} with code ${code}`);
        this.abi = null;
        this.types = null;
        this.blocksQueue = [];
        this.inProcessBlocks = false;
        if (code !== 1000) this.reconnect();
      });

      this.ws.on('error', (e) => {console.error(`Websocket error`, e)});

    });
  }

  disconnect() {
    this.ws.close();
  }

  reconnect(){
    if (this.connectionRetries > this.maxConnectionRetries) return console.error(`Exceeded max reconnection attempts of ${this.maxConnectionRetries}`);
    const timeout = Math.pow(2, this.connectionRetries/5) * 1000;
    console.log(`Retrying with delay of ${timeout / 1000}s`);
    setTimeout(() => { this.start(); }, timeout);
    this.connectionRetries++;
  }

  serialize(type, value) {
    const buffer = new Serialize.SerialBuffer({ textEncoder: new TextEncoder, textDecoder: new TextDecoder });
    Serialize.getType(this.types, type).serialize(buffer, value);
    return buffer.asUint8Array();
  }

  deserialize(type, array) {
    const buffer = new Serialize.SerialBuffer({ textEncoder: new TextEncoder, textDecoder: new TextDecoder, array });
    return Serialize.getType(this.types, type).deserialize(buffer, new Serialize.SerializerState({ bytesAsUint8Array: true }));
  }

  send(request) { 
    this.ws.send(this.serialize('request', request)); 
  }

  requestBlock(requestArgs) {
    this.send(['get_blocks_request_v1', requestArgs]);
  }

  async get_blocks_result_v1(response) {

    let traces = []; 

    if (response.traces) {
      traces = this.deserialize("transaction_trace[]",response.traces);
    }

    let finality_data = {};

    if (response.finality_data) {
      
      finality_data = this.deserialize("finality_data",response.finality_data);

      finality_data.action_mroot = finality_data.action_mroot.toLowerCase();
      finality_data.base_digest = finality_data.base_digest.toLowerCase();

    }

    const block = this.deserialize("signed_block", response.block);

    let transactions = [];
    let receipts = [];
    let receiptDigests = [];

    let header = {...block};
    
    delete header.transactions;
    delete header.producer_signature;

    header.previous = header.previous.toLowerCase();
    header.transaction_mroot = header.transaction_mroot.toLowerCase();
    header.action_mroot = header.action_mroot.toLowerCase();

    for (let txRaw of traces) {
      let tx = txRaw[1];
      let action_traces = [];
      for (var t of tx.action_traces){
        let trace = t[1];
        trace.receipt = trace.receipt[1];
        trace.receipt.act_digest = trace.receipt.act_digest.toLowerCase();
        action_traces.push(trace)
      }
      tx.action_traces = action_traces;
      tx.id = tx.id.toLowerCase();
      transactions.push(tx)
    }

    for (let tx of transactions) {
      for (let trace of tx.action_traces) {
        var receipt = trace.receipt;
        var act = trace.act;

        receipt.act_digest = receipt.act_digest.toLowerCase();
        receipt.receipt_digest = getReceiptDigest(receipt, act);

        receipts.push(receipt);
      }
    }

    let sortedReceipts = receipts.sort((a,b)=> a.global_sequence > b.global_sequence? 1 :-1);

    return await this.blockReceivedHandler({
      id:response.this_block.block_id.toLowerCase(),
      block_num:response.this_block.block_num,
      action_receipts: sortedReceipts,
      header,
      producer_signature: block.producer_signature,
      transactions,
      finality_data
    });

  }

} 

export default SHIP;

