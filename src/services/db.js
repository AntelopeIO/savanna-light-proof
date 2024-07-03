import deepEqual from 'fast-deep-equal';
import {IncrementalMerkleTree} from '../structs/merkleTree.js';

class DB {

    constructor(){
        this.blocks = [];
        this.savanna_activated = false;
        this.savanna_transition = false;
        this.last_pending_finalizer_policy = null;
        this.last_pending_finalizer_policy_digest = null;
        this.finalizer_policies = [];
        this.last_qc = null;
        this.qc_chain = [];
        this.roots = [];
        this.finality_tree = new IncrementalMerkleTree;
    }

    getNextBlockNum(){
        if (this.blocks.length>0) return this.blocks[this.blocks.length-1].block_num + 1;
        else return 1;
    }

    getLastBlock(){
        if (this.blocks.length>0) return this.blocks[this.blocks.length-1];
        else return {};
    }

    getBlock(blockNum){
        
        let block = this.blocks.find(b=>{return b.block_num == blockNum;});

        if (block) return block;
        else return null;

    }

    getProvingBlock(blockNum){
        
        let block = this.blocks.find(b=>{
            return b.last_qc_block_num == blockNum && b.is_last_qc_strong == true; 
        });

        if (block) return block;
        else return null;

    }

    processBlock(block){

        if (block.active_finalizer_policy_generation){

            let finality_mroot = "0000000000000000000000000000000000000000000000000000000000000000";

            //skip legacy blocks
            if (block.qc_extension || this.last_qc){
                if (block.qc_extension) this.last_qc = block.qc_extension;
                else b.qc_extension = this.last_qc;

                let finality_info = {
                    last_qc_block_num: block.last_qc_block_num,
                    is_last_qc_strong: block.is_last_qc_strong
                };

                if (this.qc_chain.length == 0 || !deepEqual(finality_info, this.qc_chain[this.qc_chain.length-1])){
                    this.qc_chain.push(finality_info);
                }

                if (this.qc_chain.length>=2){

                    let last_qc_strong = this.qc_chain[this.qc_chain.length-1].is_last_qc_strong;
                    let two_qcs = this.qc_chain[this.qc_chain.length-1].last_qc_block_num > this.qc_chain[this.qc_chain.length-2].last_qc_block_num;

                    if (last_qc_strong && two_qcs){

                        if (this.final_on_qc!= this.qc_chain[this.qc_chain.length-2].last_qc_block_num){
                            //finality progress, final_on_qc is now final
                              
                            let new_active = this.finalizer_policies.findLast(p=> this.final_on_qc >= p.pending_block_num && p.status == "pending");

                            if (new_active) {

                                this.finalizer_policies = this.finalizer_policies.map(p => {
                                  if(p.pending_block_num >= this.final_on_qc && p.status == "pending") p.status = "null";
                                  return p;
                                });

                            }

                            this.final_on_qc = this.qc_chain[this.qc_chain.length-2].last_qc_block_num;

                        }

                        while(this.qc_chain.length>2){
                            this.qc_chain.shift();
                        }

                    }

                }

                if (this.final_on_qc>0){
                    finality_mroot = this.roots.find((root)=> root.block_num == this.final_on_qc).root;
                }
            
            }

            //console.log("block : ", block);
            block.computed_finality_digest = block.finality_digest(finality_mroot);
            block.computed_finality_leaf = block.finality_leaf(finality_mroot);

            let new_root = this.finality_tree.append(block.computed_finality_leaf);

            block.finality_mroot = finality_mroot;
            block.computed_finality_mroot = new_root;

            this.roots.push({block_num: block.block_num, root:new_root});

            //console.log(block);

            this.blocks.push(block);
     
        }
        else this.blocks.push(block);

    }

}

export {DB}