// routes/verify.js
const express = require('express');
const router = express.Router();
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const { Keypair, Connection, clusterApiUrl } = require('@solana/web3.js');

// Load your backend keypair (ensure secure key management in production)
const keypairString = process.env.BACKEND_KEYPAIR;

if (!keypairString) {
  throw new Error('Missing KEYPAIR env variable');
}

// Parse the JSON string to get the array and create the Uint8Array
const secretKey = Uint8Array.from(JSON.parse(keypairString));
const signer = Keypair.fromSecretKey(secretKey);

// Use Testnet (or Mainnet as needed)
const connection = new Connection(clusterApiUrl('testnet'));

router.post('/', async (req, res) => {
  // Expect the client to send the fileHash
  const { fileHash } = req.body;
  if (!fileHash) return res.status(400).json({ error: 'No fileHash provided' });
  
  try {
    // Retrieve recent transactions sent from your backend wallet
    const signatures = await connection.getSignaturesForAddress(signer.publicKey, { limit: 50 }); // IMPORTANT - In future we should index transaction data on an off-chain database for faster lookup when more content is added, but only use this data to quickly lookup on-chain data.

    for (const sigInfo of signatures) {
      // Check if a memo exists directly on the signature object
      if (!sigInfo.memo) continue;
      
      const memoText = sigInfo.memo;
      // Regex updated to allow an optional prefix like "[257] "
      // Expected format: "[optionalPrefix]User: <userPublicKey>, Hash: <fileHash>, Sig: <signature>"
      const regex = /^(?:\[[^\]]+\]\s*)?User:\s*([^\s,]+),\s*Hash:\s*([^\s,]+),\s*Sig:\s*([^\s,]+)/i;
      const match = memoText.match(regex);
      if (match && match.length === 4) {
        const extractedUserPublicKey = match[1];
        const extractedHash = match[2];
        const extractedSignature = match[3];

        // Ensure that the memo's hash exactly matches the provided fileHash
        if (extractedHash === fileHash) {
          // The message is the fileHash encoded as UTF-8 bytes.
          const message = new TextEncoder().encode(fileHash);
          // Convert the extracted signature from a hex string to a Uint8Array.
          const signatureBytes = new Uint8Array(Buffer.from(extractedSignature, 'hex'));
          // Decode the user public key from base58.
          const userPublicKeyBytes = bs58.decode(extractedUserPublicKey);
          
          // Verify the signature with tweetnacl.
          const isValid = nacl.sign.detached.verify(message, signatureBytes, userPublicKeyBytes);
          if (isValid) {
            return res.json({ userPublicKey: extractedUserPublicKey });
          } else {
            return res.status(400).json({ error: 'Signature verification failed' });
          }
        }
      }
    }
    
    // If no matching transaction is found:
    res.status(404).json({ error: 'No matching transaction found' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: err.toString() });
  }
});

module.exports = router;
