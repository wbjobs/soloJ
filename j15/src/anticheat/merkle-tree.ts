import * as crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
  data?: string;
}

export interface MerkleProof {
  leafHash: string;
  leafIndex: number;
  siblings: { hash: string; direction: 'left' | 'right' }[];
  rootHash: string;
}

export class MerkleTree {
  private root: MerkleNode | null = null;
  private leaves: MerkleNode[] = [];

  constructor(data: string[] = []) {
    if (data.length > 0) {
      this.buildTree(data);
    }
  }

  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private combineHash(left: string, right: string): string {
    return MerkleTree.hash(left + right);
  }

  buildTree(data: string[]): void {
    if (data.length === 0) {
      this.root = null;
      this.leaves = [];
      return;
    }

    this.leaves = data.map(d => ({
      hash: MerkleTree.hash(d),
      isLeaf: true,
      data: d
    }));

    let nodes = [...this.leaves];

    while (nodes.length > 1) {
      const nextLevel: MerkleNode[] = [];

      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = i + 1 < nodes.length ? nodes[i + 1] : null;

        if (right) {
          nextLevel.push({
            hash: this.combineHash(left.hash, right.hash),
            left,
            right,
            isLeaf: false
          });
        } else {
          nextLevel.push({
            hash: this.combineHash(left.hash, left.hash),
            left,
            right: left,
            isLeaf: false
          });
        }
      }

      nodes = nextLevel;
    }

    this.root = nodes[0];
  }

  getRootHash(): string | null {
    return this.root?.hash || null;
  }

  getLeafCount(): number {
    return this.leaves.length;
  }

  getLeaf(index: number): string | null {
    return this.leaves[index]?.data || null;
  }

  getProof(index: number): MerkleProof | null {
    if (index < 0 || index >= this.leaves.length) {
      return null;
    }

    const leaf = this.leaves[index];
    const siblings: { hash: string; direction: 'left' | 'right' }[] = [];

    let currentIndex = index;
    let levelLeaves = [...this.leaves];

    while (levelLeaves.length > 1) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < levelLeaves.length) {
        siblings.push({
          hash: levelLeaves[siblingIndex].hash,
          direction: isRight ? 'left' : 'right'
        });
      } else if (levelLeaves.length > 1) {
        siblings.push({
          hash: levelLeaves[currentIndex].hash,
          direction: 'left'
        });
      }

      const nextLevel: MerkleNode[] = [];
      for (let i = 0; i < levelLeaves.length; i += 2) {
        const left = levelLeaves[i];
        const right = i + 1 < levelLeaves.length ? levelLeaves[i + 1] : left;
        nextLevel.push({
          hash: this.combineHash(left.hash, right.hash),
          left,
          right,
          isLeaf: false
        });
      }
      levelLeaves = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leafHash: leaf.hash,
      leafIndex: index,
      siblings,
      rootHash: this.root?.hash || ''
    };
  }

  static verifyProof(proof: MerkleProof): boolean {
    let currentHash = proof.leafHash;

    for (const sibling of proof.siblings) {
      if (sibling.direction === 'left') {
        currentHash = MerkleTree.hash(sibling.hash + currentHash);
      } else {
        currentHash = MerkleTree.hash(currentHash + sibling.hash);
      }
    }

    return currentHash === proof.rootHash;
  }

  static verifyProofWithData(data: string, proof: MerkleProof): boolean {
    const leafHash = MerkleTree.hash(data);
    if (leafHash !== proof.leafHash) {
      return false;
    }
    return MerkleTree.verifyProof({ ...proof, leafHash });
  }

  printTree(): void {
    if (!this.root) {
      console.log('Empty tree');
      return;
    }

    const printNode = (node: MerkleNode, level: number) => {
      const indent = '  '.repeat(level);
      console.log(`${indent}${node.isLeaf ? 'L: ' + node.data : 'N: ' + node.hash.slice(0, 8)}`);
      if (node.left) printNode(node.left, level + 1);
      if (node.right && node.right !== node.left) printNode(node.right, level + 1);
    };

    printNode(this.root, 0);
  }
}
