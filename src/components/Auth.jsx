import { useNavigate } from 'react-router';
import useWallet from '../hooks/useWallet';
import { useState } from 'react';

import Gun from 'gun';

const gun = Gun({
  peers: ['http://localhost:4000/gun']
});

const authenticateUser = ({ account, username }) => {
  return new Promise((resolve, reject) => {
    console.log('Authenticating user...');

    const userRef = gun.get('users').get(account);

    userRef.once((profile) => {
      if (!profile) {
        userRef.put({
          username,
          address: account,
          createdAt: Date.now()
        });
        return resolve('created');
      }
      else if (profile.username !== username) {
        return reject(new Error('Username mismatch'));
      }

      console.log('User authenticated:', account);
      return resolve('authenticated');
    });
  });
};

function Auth() {
  const { connectWallet, account, signature, connecting, error } = useWallet();
  const [username, setUsername] = useState();
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      if (!username) {
        alert("Username is required to login");
        return;
      }

      await connectWallet();
      if (error) return;

      if (account) {
        const status = await authenticateUser({ account, username });
        if (status === 'authenticated' || status === 'created') {
          localStorage.setItem(`userDataStored${account}`, JSON.stringify({ username, account, signature }));
          navigate('/home', { state: { dataString: `userDataStored${account}`, username, account, signature } });
        }
      }
    } catch (err) {
      console.error('Authentication failed:', err);
      alert(err.message);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
      <div className="flex flex-col gap-2 bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold text-gray-800 mb-6">🛡️ Decentralized Chat</h1>
        <div className='flex flex-col'>
          <strong className='text-start text-gray-800'>Enter Username: (required)</strong>
          <input autoFocus={true} onChange={(e) => setUsername(e.target.value)} type='text' className='rounded-md text-4xl bg-slate-400 text-gray-800' />
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50"
        >
          {connecting ? 'Connecting...' : 'Connect MetaMask'}
        </button>

        {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
      </div>
    </div>
  );
}

export default Auth;
