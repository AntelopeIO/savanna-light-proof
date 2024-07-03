import crypto from 'crypto';

function hashPair(l, r){
  var buffLeft = Buffer.from(l, "hex")
  var buffRight = Buffer.from(r, "hex")

  var buffFinal = Buffer.concat([buffLeft, buffRight]);
  var finalHash = crypto.createHash("sha256").update(buffFinal).digest("hex");

  return finalHash;
}

function nextPowerOf2(value) {
  value -= 1;
  value |= value >> 1;
  value |= value >> 2;
  value |= value >> 4;
  value |= value >> 8;
  value |= value >> 16;
  value |= value >> 32;
  value += 1;   
  return value;
}

function clzPower2( value) {
  var count = 1;

  for (var i = 0; i < 30; i++){
    count*=2;
    if (value == count) return i+1;
  }

  return 0;
}

function calculateMaxDepth( nodeCount) {
  if (nodeCount == 0) return 0;
  var impliedCount = nextPowerOf2(nodeCount);
  return clzPower2(impliedCount) + 1;
}

class MerkleTree {
  constructor(leaves = []) {
    this.leaves = leaves;
    this.tree = [];
    this.buildTree();
  }

  buildTree() {
    this.tree = [this.leaves];
    let currentLevel = this.leaves;
    while (currentLevel.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        if (currentLevel[i + 1]){
          const right = currentLevel[i + 1];
          nextLevel.push(hashPair(left, right));
        }
        else nextLevel.push(left);
      }
      this.tree.unshift(nextLevel); // Prepend to build the tree upwards
      currentLevel = nextLevel;
    }
  }

/*  getRoot() {
    return this.tree[0][0];
  }
*/
/*  getProof(leaf) {
    const leafHash = leaf;
    let index = this.leaves.indexOf(leafHash);
    if (index === -1) return null;

    const proof = [];

    for (let i = this.tree.length - 1; i > 0; i--) {
      const layer = this.tree[i];
      const isRightNode = index % 2;
      const pairIndex = isRightNode ? index - 1 : index + 1;

      if (pairIndex < layer.length) {
        proof.push({ direction: isRightNode ? 'left' : 'right', data: layer[pairIndex] });
      }
      index = Math.floor(index / 2);
    }
    return proof;
  }

  verifyProof(leaf, proof, root) {
    let hashToCheck = leaf;
    for (const { direction, data } of proof) {
      if (direction == 'left') {
        hashToCheck = hash(data, hashToCheck);
      } else {
        hashToCheck = hash(hashToCheck, data);
      }
    }
    return hashToCheck == root;
  }*/
}

function generateMerkleProof(hashes, index) {

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

class IncrementalMerkleTree {
    constructor() {
        this.root = "0000000000000000000000000000000000000000000000000000000000000000";
        this.active_nodes = [];
        this.nodes_count = 0;
    }

    append(digest){
        
        const maxDepth = calculateMaxDepth(this.nodes_count + 1);
        let currentDepth = maxDepth - 1;

        let count = 0;
        const nodes = [];
        let partial = false;
        let index = this.nodes_count;
        let top = digest;

        while (currentDepth > 0) {

          if (!(index & 0x1)) {
            if (!partial) nodes.push(top);
            top = top; //hashPair(top, top);
            partial = true;
          } 
          else {
            var left_value = this.active_nodes[count];
            count++;
            if (partial) nodes.push(left_value);
            top = hashPair(left_value, top);
          }

           currentDepth--;
           index = index >> 1;
        }

        nodes.push(top);
        
        this.active_nodes = nodes;
        this.nodes_count++;

        this.root = this.active_nodes[this.active_nodes.length-1];

        return this.root;

    }

}

export {MerkleTree, IncrementalMerkleTree};
