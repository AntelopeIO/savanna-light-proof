import express from 'express';
//import proofs from '../services/proofs.js';
import { MerkleTree} from '../structs/merkleTree.js';
import { getProofOfInclusion, convertBitset} from '../services/utils.js';

const router = express.Router();

function getTargetData(target_block){

  let target;

  let fp = global.db.finalizer_policies.find(p=>p.pending_block_num==target_block.block_num);

  if (!fp){
    target = [
      "simple_block_data", {
        major_version : target_block.major_version,
        minor_version : target_block.minor_version,
        finality_digest : target_block.computed_finality_digest,
        dynamic_data : {
          block_num : parseInt(target_block.block_num),
          action_proofs : [],
          action_mroot : target_block.action_mroot
        }
    }];
  }
  else {

    console.log("target_block", target_block);

    //let finalityMroot = global.db.blocks.find(r=> r.block_num == target_block.final_on_strong_qc_block_num);

/*    if (!finalityMroot){
      console.log("cannot find finalityMroot");
      process.exit(1);
    }*/

    target = [
      "extended_block_data", {
        finality_data : {
          major_version : target_block.major_version,
          minor_version : target_block.minor_version,
          finalizer_policy_generation : target_block.active_finalizer_policy_generation,
          final_on_strong_qc_block_num : target_block.final_on_strong_qc_block_num,
          new_finalizer_policy : fp.policy,
          witness_hash : target_block.base_digest,
          finality_mroot : target_block.finality_mroot

        },
        dynamic_data : {
          block_num : parseInt(target_block.block_num),
          action_proofs : [],
          action_mroot : target_block.action_mroot
        }
    }];

  }

  return target;

}

function isValid(data){

  //preliminary validation to guard against obvious invalid values
  if (data.qc_block && data.target_block) {
    if (data.target_block <= 0 || data.qc_block <= 0) return false; //block numbers must be positive
    if (data.target_block + 2 > data.qc_block) return false; //qc block_num must be greater than or equal to target block_num + 2  
  
    return true;

  }
  else return false;

}

function getProof(data){

  let proving_block = global.db.getProvingBlock(data.qc_block);
  if(!proving_block) return {"result":"error", "message":"cannot find a block containing the correct QC over the qc block"};
  
  let qc_block = global.db.getBlock(data.qc_block);
  if(!qc_block) return {"result":"error", "message":"cannot find the QC block"};
  
  let final_block = global.db.getBlock(qc_block.final_on_strong_qc_block_num);
  if(!final_block) return {"result":"error", "message":"cannot find the block that would become final on a strong QC"};
  
  let target_block = global.db.getBlock(data.target_block);
  if(!target_block) return {"result":"error", "message":"cannot find the target block"};

/*        console.log("target_block", target_block);
  console.log("final_block", final_block);
  console.log("qc_block", qc_block);
  console.log("proving_block", proving_block);
*/
  let targetData = getTargetData(target_block);

  //console.log(targetData);

  if (data.target_block>qc_block._final_on_strong_qc_block_num){
    console.log("requested QC block does not provide finality proof for target block");
    return {"result":"error", "message":"requested QC block does not provide finality proof for target block"} ;
  }

  var tree_blocks = global.db.blocks.filter(b=>b.block_num<=qc_block.final_on_strong_qc_block_num && b.active_finalizer_policy_generation);
  var leaves = tree_blocks.map(b=>b.computed_finality_leaf);

  //console.log(leaves);

  var target_block_index = leaves.findIndex(l=>l==target_block.computed_finality_leaf);
  var final_block_index = leaves.findIndex(l=>l==final_block.computed_finality_leaf);

  //console.log("target_block_index", target_block_index);
  //console.log("final_block_index", final_block_index);

  var proof_of_inclusion = getProofOfInclusion(target_block_index, final_block_index, leaves);

  var raw_bitset = proving_block.qc_extension.qc.data.strong_votes;
  var converted_bitset = convertBitset(raw_bitset);

  //console.log("raw_bitset", raw_bitset);
  //console.log("converted_bitset", converted_bitset);

  var proof = {
    finality_proof : {
      qc_block : {
        major_version : qc_block.major_version,
        minor_version : qc_block.minor_version,
        finalizer_policy_generation : qc_block.active_finalizer_policy_generation,
        final_on_strong_qc_block_num : qc_block.final_on_strong_qc_block_num,
        new_finalizer_policy : null,
        witness_hash : qc_block.static_data_digest(),
        finality_mroot : qc_block.finality_mroot
      },
      qc : {
        finalizers: converted_bitset,
        signature : proving_block.qc_extension.qc.data.sig
      }
    },
    target_block_proof_of_inclusion : {
      target_block_index : target_block_index,
      final_block_index : final_block_index,
      target : targetData,
      merkle_branches : proof_of_inclusion.map(item => item.hash)
    }
  }

  return {"result":"success", "proof":proof};

}

router.post('/', (req, res) => {

  const { type, data } = req.body;

  if (!type || !data) return res.status(400).json({ error: 'type and data fields are both required.' });
  else {
    //const template = proof_templates[type];
    if (!(type=='inclusion'||type=='finality')) return res.status(400).json({ error: 'proof type not supported.' });

    //if (!template.isValid(data)) return res.status(400).json({ error: 'invalid data for proof type.' });

    if (!isValid(data)) return res.status(400).json({ error: 'invalid request parameters' });

    let proofResult = getProof(data);

    if (type=='inclusion')  delete proofResult.proof.finality_proof;

    console.log("getProof results : ", proofResult);

    return res.json(proofResult);

  }

});

export default router;