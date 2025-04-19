import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import Gun from "gun";

const gun = Gun({
  peers: [
    "http://localhost:4000/gun",
    "https://gun-manhattan.herokuapp.com/gun",
  ],
});

function Home() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [userData, setUserData] = useState({
    account: "",
    username: "",
    signature: "",
    friends: [],
  });

  useEffect(() => {
    if (state && state.account) {
      localStorage.setItem("userData", JSON.stringify(state));
      setUserData(state);
    } else {
      const savedData = localStorage.getItem("userData");
      if (savedData) {
        try {
          setUserData(JSON.parse(savedData));
        } catch (e) {
          console.error("Error parsing saved user data:", e);
          navigate("/");
        }
      } else {
        navigate("/");
      }
    }
  }, [state, navigate]);

  function removeDuplicatesById(array) {
    if (!Array.isArray(array)) return [];
    const seen = new Set();
    return array.filter((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  useEffect(() => {
    if (userData.account) {
      const friendsRef = gun
        .get("usersList")
        .get(userData.account)
        .get("friends");

      const friendsSubscription = friendsRef.map().on((friend, id) => {
        if (friend) {
          setUserData((prev) => {
            // Build the new friends array
            let newFriends = Array.isArray(prev.friends)
              ? [...prev.friends, { id, ...friend }]
              : [{ id, ...friend }];

            // Remove duplicates by id
            newFriends = removeDuplicatesById(newFriends);

            return {
              ...prev,
              friends: newFriends,
            };
          });
        }
      });

      return () => {
        friendsRef.map().off(friendsSubscription);
      };
    }
  }, [userData.account]);

  const handleLogout = () => {
    localStorage.removeItem("userData");
    navigate("/");
  };

  const goToChat = () => {
    navigate("/chat", {
      state: {
        currentUser: {
          username: userData.username,
          account: userData.account,
          address: userData.account,
        },
        friends: userData.friends || [],
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Welcome, {userData.username}</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your Profile</h2>
          <div className="space-y-2">
            <p>
              <strong>Connected Address:</strong> {userData.account}
            </p>
            <p>
              <strong>Username:</strong> {userData.username}
            </p>
            <p>
              <strong>Signature:</strong> {userData.signature}
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Friends</h2>
            <button
              onClick={goToChat}
              className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 transition"
            >
              Manage Friends
            </button>
          </div>

          {Array.isArray(userData.friends) && userData.friends.length > 0 ? (
            <ul className="divide-y divide-gray-700">
              {userData.friends.map((friend, index) => (
                <li key={friend.id || index} className="py-3">
                  {friend.username}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">You haven't added any friends yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
