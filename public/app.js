// Helper function to compute a SHA-256 hash using SubtleCrypto
async function computeHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function showNotification(message, type = 'info', txid = null, acc = null) {
  const notifications = document.getElementById('notifications');
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  let content = message;
  if (txid) {
    content += ` <a href="https://solscan.io/tx/${txid}?cluster=testnet" target="_blank" rel="noopener" class="solscan-link">View on Solscan</a>`;
  } else if (acc) {
    content += ` <a href="https://solscan.io/account/${acc}" target="_blank" rel="noopener" class="solscan-link">View on Solscan</a>`;
  }

  notification.innerHTML = `
    <div>${content}</div>
    <button class="close-btn">&times;</button>
  `;

  notification.querySelector('.close-btn').addEventListener('click', () => {
    notification.remove();
  });

  notifications.appendChild(notification);

  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);

  // Ensure only the latest 3 notifications are kept
  const existingNotifications = notifications.querySelectorAll('.notification');
  if (existingNotifications.length > 3) {
    existingNotifications[0].remove(); // Remove the oldest notification
  }
}

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.classList.add('loading');

  const input = document.getElementById('mediaInput');
  if (!input.files.length) {
    uploadBtn.classList.remove('loading');
    return showNotification('Please select a file.', 'error');
  }

  const file = input.files[0];
  const fileHash = await computeHash(file);
  console.log('Computed file hash:', fileHash);

  // Check if the media has already been signed using the verify endpoint
  try {
    const verifyResponse = await fetch('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileHash })
    });
    const verifyResult = await verifyResponse.json();
    if (verifyResult.userPublicKey) {
      uploadBtn.classList.remove('loading');
      return showNotification('This media has already been put on-chain.', 'error');
    }
  } catch (error) {
    // Handle error if verify endpoint fails; you might choose to stop or continue based on your application's needs
    console.error('Verification error:', error);
    uploadBtn.classList.remove('loading');
    return showNotification('Error checking media signature.', 'error');
  }

  // Ensure Phantom is available and connected
  if (window.solana && window.solana.isPhantom) {
    try {
      // Connect to Phantom if not already connected
      const response = await window.solana.connect();
      // Get the user's public key as a string
      const userPublicKey = response.publicKey.toString();
      console.log('User Public Key:', userPublicKey);

      // Convert the hash string to bytes for signing
      const encoder = new TextEncoder();
      const hashBytes = encoder.encode(fileHash);
      
      // Request Phantom to sign the hash
      const signed = await window.solana.signMessage(hashBytes, 'utf8');
      const signatureHex = Array.from(signed.signature)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log('Signature:', signatureHex);

      // Send fileHash, signature, and user public key to the backend
      const responseData = await fetch('/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileHash,
          signature: signatureHex,
          userPublicKey, // now sending the public key instead of fileName
        })
      });
      const result = await responseData.json();
      showNotification(`Transaction submitted: `, 'success', txid=result.txid);
    } catch (error) {
      showNotification('Error signing media with Phantom.', 'error');
    }
    finally {
      uploadBtn.classList.remove('loading');
    }
  } else {
    showNotification('Phantom wallet not found. Please install Phantom.', 'error');
  }
});
  
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const verifyBtn = document.getElementById('verifyBtn');
  verifyBtn.classList.add('loading');

  const input = document.getElementById('verifyMediaInput');
  if (!input.files.length) {
    verifyBtn.classList.remove('loading');
    return showNotification('Please select a file.', 'error');
  }

  const file = input.files[0];
  const fileHash = await computeHash(file);
  console.log('Computed file hash for verification:', fileHash);
  
  try {
    const response = await fetch('/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileHash })
    });
    const result = await response.json();
    if (result.userPublicKey) {
      showNotification(`Signed by account: `, 'success', txid=null, acc=result.userPublicKey);
    } else {
      showNotification(`No matching signature found`, 'error');
    }
  } catch (error) {
    console.error('Verification error:', error);
    showNotification('Error during verification.', 'error');
  }

  verifyBtn.classList.remove('loading');
});