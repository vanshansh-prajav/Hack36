import { useNavigate } from "react-router";
import useWallet from "../hooks/useWallet";
import { useState } from "react";
import Gun from "gun";

const gun = Gun({
  peers: ["http://localhost:4000/gun", "https://gun-manhattan.herokuapp.com/gun"],
});

const authenticateUser = ({ account, username }) => {
  return new Promise((resolve, reject) => {
    const usersSet = gun.get("usersList");
    usersSet.get(account).once((userData) => {
      if (!userData) {
        
        usersSet.get(account).put({
          account,
          username,
          address: account, 
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        }, (ack) => {
          if (ack.err) return reject(`Error storing user: ${ack.err}`);
          
          
          usersSet
            .get(account)
            .get("friends")
            .set([], (friendAck) => {
              if (friendAck.err) {
                return reject(`Error initializing friends: ${friendAck.err}`);
              }
              
              gun.get("usersList").once(() => {
                resolve("User created and synced");
              });
            });
        });
      } else {
        
        usersSet.get(account).put({
          lastLogin: new Date().toISOString()
        });
        
        if (userData.username !== username) {
          return reject(new Error("Username mismatch"));
        }
        return resolve("Authenticated");
      }
    });
  });
};

export function getUserProfile(account) {
  return new Promise((resolve, reject) => {
    if (!account) {
      return reject(new Error("No account provided"));
    }
    
    gun
      .get("usersList")
      .get(account)
      .once((profile) => {
        if (!profile) {
          return reject(new Error("Profile not found"));
        }
        
        
        const safeProfile = {
          ...profile,
          friends: Array.isArray(profile.friends) ? profile.friends : []
        };
        
        resolve(safeProfile);
      });
  });
}

function Auth() {
  const { connectWallet, account, signature, connecting, error } = useWallet();
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      setAuthError("");
      
      if (!username) {
        setAuthError("Username is required");
        return;
      }
      
      // Get the direct result from connectWallet
      const walletResult = await connectWallet();
      
      // Use the returned account value or fall back to the state value
      const walletAccount = walletResult?.account || account;
      const walletSignature = walletResult?.signature || signature;
      
      if (!walletAccount) {
        console.warn("No account after connectWallet");
        setAuthError("Failed to connect wallet");
        return;
      }
      
      // Store session data using the directly returned account
      localStorage.setItem('userData', JSON.stringify({
        account: walletAccount,
        username,
        signature: walletSignature,
        lastLogin: new Date().toISOString(),
        friends: []
      }));
  
      await authenticateUser({ account: walletAccount, username });
      const userData = await getUserProfile(walletAccount);
      
      navigate("/home", { 
        state: {
          ...userData,
          account: walletAccount,
          signature: walletSignature,
          username
        }
      });
    } catch (err) {
      console.error("Authentication failed:", err);
      setAuthError(err.message || "Authentication failed");
    }
  };
  

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-6">Connect Wallet</h1>
        
        <div className="mb-4">
          <label htmlFor="username" className="block text-white mb-2">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:outline-none"
            placeholder="Enter username"
          />
        </div>
        
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect with MetaMask"}
        </button>
        
        {(authError || error) && (
          <div className="mt-4 text-red-400">
            {authError || error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Auth;
