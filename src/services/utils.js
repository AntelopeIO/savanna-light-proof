import { Serialize } from 'enf-eosjs';
import { SerialBuffer, createInitialTypes } from 'enf-eosjs/dist/eosjs-serialize.js';
import {MerkleTree} from '../structs/merkleTree.js';

import crypto from 'crypto';

const types = createInitialTypes();

const eosjsTypes = {
  bool: types.get("bool"), 
  name: types.get("name"), 
  bytes: types.get("bytes"), 
  uint8: types.get("uint8"), 
  uint16: types.get("uint16"), 
  uint32: types.get("uint32"), 
  uint64: types.get("uint64"), 
  time_point: types.get("time_point"), 
  varuint32: types.get("varuint32"), 
  checksum256: types.get("checksum256"),
  string: types.get("string")
}
const { bool, name, uint8, uint16, uint32, uint64, time_point, varuint32, checksum256, bytes, string  } = eosjsTypes;

function hexStringToNumbers(hexString) {
  // Remove any leading '0x' or '0X'
  hexString = hexString.replace(/^0x/i, '');
  
  // Ensure the string has an even number of characters
  if (hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  
  // Split the string into pairs of characters
  var pairs = hexString.match(/.{1,2}/g);
  
  // Convert each pair to a number and return as an array
  return pairs.map(function(pair) {
    return parseInt(pair, 16);
  });
}

function blsPubKeyToHex(key) {

    var key = key.replace("PUB_BLS_", "");

    // Convert base64Url to regular base64
    const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
    // Decode base64
    const binaryStr = atob(base64);
    // Convert binary to hex
    let hex = '';
    for (let i = 0; i < binaryStr.length - 4; i++) {
        let hexChar = binaryStr.charCodeAt(i).toString(16);
        hex += hexChar.length === 1 ? '0' + hexChar : hexChar;
    }
    return hex;

}

function getReceiptDigest(receipt, act){

  const buffer_1 = new SerialBuffer({ TextEncoder, TextDecoder });
  const buffer_2 = new SerialBuffer({ TextEncoder, TextDecoder });

  uint64.serialize(buffer_1, receipt.global_sequence);

  if (receipt.auth_sequence)  {
    varuint32.serialize(buffer_1, receipt.auth_sequence.length);
    for (var auth of receipt.auth_sequence){
      name.serialize(buffer_1, auth.account);
      uint64.serialize(buffer_1, auth.sequence);
    }
  }
  else varuint32.serialize(buffer_1, 0);

  if (receipt.code_sequence) varuint32.serialize(buffer_1, receipt.code_sequence);
  else varuint32.serialize(buffer_1, 0);

  if (receipt.abi_sequence) varuint32.serialize(buffer_1, receipt.abi_sequence);
  else varuint32.serialize(buffer_1, 0);

  var hash_1 = crypto.createHash("sha256").update(buffer_1.asUint8Array()).digest("hex");

  name.serialize(buffer_2, receipt.receiver);
  uint64.serialize(buffer_2, receipt.recv_sequence);
  name.serialize(buffer_2, act.account);
  name.serialize(buffer_2, act.name);
  checksum256.serialize(buffer_2, receipt.act_digest);
  checksum256.serialize(buffer_2, hash_1);

  var hash_2 = crypto.createHash("sha256").update(buffer_2.asUint8Array()).digest("hex");

  return hash_2;
  
}

function hashPair(l, r){

  //console.log("l", l);
  //console.log("r", r);

  var buffLeft = Buffer.from(l, "hex")
  var buffRight = Buffer.from(r, "hex")

  var buffFinal = Buffer.concat([buffLeft, buffRight]);
  var finalHash = crypto.createHash("sha256").update(buffFinal).digest("hex");

  return finalHash;
}

function generateMerkleProof(hashes, index) {

  console.log("hashes", hashes);
  console.log("hashes.length", hashes.length);
  console.log("index", index);

  let proof = [];
  while (hashes.length > 1) {
    let newLevel = [];
    for (let i = 0; i < hashes.length; i += 2) {
      let left = hashes[i];
      let right = (i + 1 < hashes.length) ? hashes[i + 1] : null;

      // Determine if the current hash is a left or right child, or a promoted odd-end node
      if (right && (i + 1 !== hashes.length - 1 || hashes.length % 2 === 0)) {
        // Normal case: both children exist and are not at the end or are even
        newLevel.push(hashPair(left, right));
        if (index === i || index === i + 1) {
          proof.push(index === i ? {direction: 0, hash: right} : {direction: 1, hash: left});
          index = Math.floor(i / 2); // Update index for next level
        }
      } else {
        // Odd number of nodes at this level, and we're at the end
        newLevel.push(left); // Promote the left (which is also the right in this case)
        if (index === i) index = Math.floor(i / 2); // Update index for next level, no sibling to add
      }
    }
    hashes = newLevel;
  }
  return proof;
}

function verifyProof(proof, targetNode, root){

  var hash_count = 0;
  var hash = targetNode;

  for (let i = 0; i < proof.length; i++) {
  
    var node = proof[i].hash;
  
    var buffers = [];

    buffers.push(Buffer.from(hash, "hex"));
    buffers[ proof[i].direction ? 'unshift' : 'push' ](Buffer.from(node, "hex"));

    var hash_hex = crypto.createHash('sha256').update(Buffer.concat(buffers)).digest("hex");

    hash_count++;
    hash = hash_hex;

  }

  return Buffer.compare(Buffer.from(hash, "hex"), Buffer.from(root, "hex")) === 0;
}

function reverseHexBytes(hexString) {
  // Ensure the hex string has an even length
  if (hexString.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }

  let reversedHex = "";
  for (let i = 0; i < hexString.length; i += 2) {
    reversedHex = hexString.substring(i, i + 2) + reversedHex;
  }
  return reversedHex;
}

function convertBitset(bitset ){
  const number = parseInt(bitset, 2); // Convert binary string to a number
  var hexString = number.toString(16); // Convert number to hexadecimal string
  if (hexString.length % 2)
     hexString = "0" + hexString;
    
  return reverseHexBytes(hexString);
}

function getProofOfInclusion(target_index, proven_index, leaves){

  try {

    if (proven_index > leaves.length-1 ) {
      console.log("invalid proven index");
      process.exit(1);
    }

    var adj_leaves = leaves.slice(0, proven_index+1);

    const tree = new MerkleTree(adj_leaves);

    var proof_of_inclusion = generateMerkleProof(adj_leaves, target_index);

    //console.log("adj_leaves", adj_leaves);
    //console.log("tree", tree);
    //console.log("proof_of_inclusion", proof_of_inclusion);
    //console.log("");

    var verif_result = verifyProof(proof_of_inclusion, adj_leaves[target_index], tree.tree[0][0]);

    //console.log("proof verification result : ", verif_result);

    if (verif_result == false){
      console.log("invalid proof of inclusion results");
      process.exit(1);
    }
    else {
      //console.log("proof is valid");
      return proof_of_inclusion;

    }

  }
  catch (ex){
    console.log("error while generating proof of inclusion", ex);
    process.exit(1);
  }

}

export {
  hexStringToNumbers, 
  blsPubKeyToHex, 
  getReceiptDigest, 
  generateMerkleProof, 
  verifyProof, 
  convertBitset,
  reverseHexBytes,
  getProofOfInclusion, 
  bool, 
  name, 
  uint8, 
  uint16, 
  uint32, 
  uint64, 
  time_point, 
  varuint32, 
  checksum256, 
  bytes, 
  string
};
