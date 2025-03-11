const express = require('express');
const router = express.Router();
const {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} = require('@solana/web3.js');

const { Keypair } = require('@solana/web3.js');

// Load your backend keypair (ensure secure key management in production)
const keypairString = process.env.BACKEND_KEYPAIR;

if (!keypairString) {
  throw new Error('Missing KEYPAIR env variable');
}

// Parse the JSON string to get the array and create the Uint8Array
const secretKey = Uint8Array.from(JSON.parse(keypairString));
const signer = Keypair.fromSecretKey(secretKey);

// Use Devnet for testing
const connection = new Connection(clusterApiUrl('testnet'));

router.post('/', async (req, res) => {
  // Expect fileHash, signature, and userPublicKey from the client
  const { fileHash, signature, userPublicKey } = req.body;

  // Construct memo text with the user’s public key, file hash, and signature
  const memoText = `User: ${userPublicKey}, Hash: ${fileHash}, Sig: ${signature}`;
  const memoData = Buffer.from(memoText, 'utf-8');

  // Use the Memo Program on Solana
  const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: memoProgramId,
    data: memoData,
  });

  // Build the transaction
  const transaction = new Transaction().add(memoInstruction);
  transaction.feePayer = signer.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Sign the transaction with the backend keypair (for fee payment and submission)
  transaction.sign(signer);

  try {
    const txid = await connection.sendRawTransaction(transaction.serialize());
    res.json({ txid });
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(500).json({ error: err.toString() });
  }
});

module.exports = router;