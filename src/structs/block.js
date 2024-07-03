import { Serialize } from 'enf-eosjs';
import { SerialBuffer } from 'enf-eosjs/dist/eosjs-serialize.js';
import crypto from 'crypto';

import { checksum256, uint32} from '../services/utils.js';

class Block {
    constructor(    base_digest, 
                    block_num, 
                    timestamp, 
                    previous, 
                    action_mroot, 
                    major_version, 
                    minor_version, 
                    active_finalizer_policy_generation, 
                    final_on_strong_qc_block_num, 
                    last_qc_block_num, 
                    is_last_qc_strong, 
                    last_pending_finalizer_policy_digest, 
                    action_receipts, 
                    qc_extension) {
        this.base_digest = base_digest;
        this.block_num = block_num;
        this.timestamp = timestamp;
        this.previous = previous;
        this.action_mroot = action_mroot;
        this.major_version = major_version;
        this.minor_version = minor_version;
        this.active_finalizer_policy_generation = active_finalizer_policy_generation;
        this.final_on_strong_qc_block_num = final_on_strong_qc_block_num;
        this.last_qc_block_num = last_qc_block_num;
        this.is_last_qc_strong = is_last_qc_strong;
        this.last_pending_finalizer_policy_digest = last_pending_finalizer_policy_digest;
        this.action_receipts = action_receipts;
        this.qc_extension = qc_extension;
    }

    static_data_digest(){
        
        const buff = new SerialBuffer({ TextEncoder, TextDecoder });

        checksum256.serialize(buff, this.last_pending_finalizer_policy_digest);
        checksum256.serialize(buff, this.base_digest);

        var hash = crypto.createHash("sha256").update(buff.asUint8Array()).digest("hex");;

        return hash;
    }

    finality_digest(finality_mroot){

        const buff = new SerialBuffer({ TextEncoder, TextDecoder });

        uint32.serialize(buff, this.major_version);
        uint32.serialize(buff, this.minor_version);
        uint32.serialize(buff, this.active_finalizer_policy_generation);
        uint32.serialize(buff, this.final_on_strong_qc_block_num);
        checksum256.serialize(buff, finality_mroot);
        checksum256.serialize(buff, this.static_data_digest());

        return crypto.createHash("sha256").update(buff.asUint8Array()).digest("hex");

    }

    finality_leaf(finality_mroot){

        const buff = new SerialBuffer({ TextEncoder, TextDecoder });

        uint32.serialize(buff, this.major_version);
        uint32.serialize(buff, this.minor_version);
        uint32.serialize(buff, this.block_num);
        checksum256.serialize(buff, this.finality_digest(finality_mroot));
        checksum256.serialize(buff, this.action_mroot);

        return crypto.createHash("sha256").update(buff.asUint8Array()).digest("hex");

    }

}

export {Block};