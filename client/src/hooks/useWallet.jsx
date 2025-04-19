import { useState } from 'react';
import { ethers } from 'ethers';

function useWallet() {
  const [account, setAccount] = useState(null);
  const [signature, setSignature] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed');
      alert("MetaMask is not installed")
      return;
    }

    try {
      setConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const message = `Login to Decentralized Chat at ${new Date().toISOString()}`;
      const signedMessage = await signer.signMessage(message);

      setAccount(address);
      setSignature(signedMessage);
      setConnecting(false);
    } catch (err) {
      setConnecting(false);
      setError('Failed to connect wallet');
      console.error(err);
    }
  };

  return { connectWallet, account, signature, connecting, error };
}

export default useWallet;