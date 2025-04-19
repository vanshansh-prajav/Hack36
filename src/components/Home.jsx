import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

function Home() {
  const relocate = useNavigate();
  const { state } = useLocation();
  const [dataString] = useState(state.dataString);
  const { username, account, signature } = state || JSON.parse(localStorage.getItem(dataString));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold text-gray-800 mb-6">Welcome, {username}</h1>

        <div className="mt-4 text-left">
          <p className="text-sm text-gray-600">
            <strong>Connected Address:</strong> {account}
          </p>
          <p className="text-xs text-gray-500">
            <strong>Signature:</strong> {signature}...
          </p>
        </div>
      </div>
      <button onClick={() => relocate('/chat')} className='w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50'>
        To chat
      </button>
    </div>
  );
}

export default Home;