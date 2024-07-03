import crypto from 'crypto';

import { SerialBuffer } from 'enf-eosjs/dist/eosjs-serialize.js';
import { hexStringToNumbers, blsPubKeyToHex, uint8, uint32, uint64, varuint32, string} from '../services/utils.js';

class FinalizerPolicy {
  constructor(generation, threshold, finalizers) {
    this.generation = generation;
    this.threshold = threshold;
    this.finalizers = finalizers;
  }

  applyDiff(diff) {

    const updated_finalizers = [...this.finalizers];

    for (const index of diff.finalizers_diff.remove_indexes) {
      updated_finalizers.splice(index, 1);
    }

    for (var i = 0 ; i < diff.finalizers_diff.insert_indexes.length; i++) {

      const index = diff.finalizers_diff.insert_indexes[i][0];
      const value = diff.finalizers_diff.insert_indexes[i][1];

      updated_finalizers.splice(index, 0, value);
    }

    return new FinalizerPolicy(diff.generation, diff.threshold, updated_finalizers);
  }

  digest(){
    
    const buffer = new SerialBuffer({ TextEncoder, TextDecoder });

    uint32.serialize(buffer, this.generation);
    uint64.serialize(buffer, this.threshold);

    varuint32.serialize(buffer, this.finalizers.length);

    for (var i = 0 ; i < this.finalizers.length ; i++){
        
      string.serialize(buffer, this.finalizers[i].description);
      uint64.serialize(buffer, this.finalizers[i].weight);

      varuint32.serialize(buffer, 96);

      var pub_key = hexStringToNumbers(blsPubKeyToHex(this.finalizers[i].public_key));

      for (var j = 0 ; j < pub_key.length; j++){
        uint8.serialize(buffer, pub_key[j]);
      }

    }

    return crypto.createHash("sha256").update(buffer.asUint8Array()).digest("hex");

  }

}

function createOrUpdateFinalizerPolicy(diff, existingPolicy = null) {
  if (!existingPolicy) {
    const finalizers = diff.finalizers_diff.insert_indexes.map(item => item[1])

    return new FinalizerPolicy(
      diff.generation,
      diff.threshold,
      finalizers
    );
  } else {
    return existingPolicy.applyDiff(diff);
  }
}

export {FinalizerPolicy, createOrUpdateFinalizerPolicy};
