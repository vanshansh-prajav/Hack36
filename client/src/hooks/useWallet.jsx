import { useState } from "react";
import { ethers } from "ethers";

function useWallet() {
  const [account, setAccount] = useState(null);
  const [signature, setSignature] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    // Clear previous errors
    setError(null);

    if (!window.ethereum) {
      setError("MetaMask is not installed");
      return { error: "MetaMask is not installed" };
    }

    try {
      setConnecting(true);

      // Request accounts
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      // Get signer after accounts are approved
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Create a unique message
      const message = `Login to Decentralized Chat with address ${address} at ${new Date().toISOString()}`;

      // Sign the message
      const signedMessage = await signer.signMessage(message);

      // Update state
      setAccount(address);
      setSignature(signedMessage);

      // Return the values directly for immediate use
      return { account: address, signature: signedMessage };
    } catch (err) {
      console.error("Wallet connection error:", err);

      let errorMsg = "Failed to connect wallet";
      if (err.code === 4001) {
        errorMsg = "You rejected the connection request";
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setConnecting(false);
    }
  };

  return { connectWallet, account, signature, connecting, error };
}

export default useWallet;
