import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import Gun from "gun";
import "gun/sea"; 


const gun = Gun({
  peers: ["http://localhost:4000/gun", "https://gun-manhattan.herokuapp.com/gun"],
  localStorage: false, 
});

const Chat = () => {
  
  const modalRef = useRef(null);
  
  
  const navigate = useNavigate();
  const location = useLocation();
  
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  
  
  const [currentUser, setCurrentUser] = useState(null);
  const [friends, setFriends] = useState([]);

  
  useEffect(() => {
    if (location.state && location.state.currentUser) {
      setCurrentUser(location.state.currentUser);
      setFriends(Array.isArray(location.state.friends) ? location.state.friends : []);
    } else {
      
      const savedData = localStorage.getItem('userData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setCurrentUser({
            username: parsedData.username,
            account: parsedData.account,
            address: parsedData.account
          });
          setFriends(Array.isArray(parsedData.friends) ? parsedData.friends : []);
        } catch (e) {
          console.error("Error parsing saved user data:", e);
          navigate('/');
        }
      } else {
        
        navigate('/');
      }
    }
  }, [location, navigate]);

  
  useEffect(() => {
    if (!currentUser) return;
    
    const usersRef = gun.get("usersList");
    const usersMap = new Map();

    console.log("Setting up user subscription...");
    
    
    const userSubscription = usersRef.map().on((userData, userId) => {
      if (userData && userData.username) {
        
        usersMap.set(userId, userData);
        
        
        const usersList = Array.from(usersMap).map(([id, data]) => ({
          id,
          ...data,
        }));
        setAllUsers(usersList);
        
        
        console.clear();
        console.log("All users in usersList:", new Date().toISOString());
        console.log("Current user:", currentUser?.username);
        console.log("Peer servers:", gun._.opt.peers);
        
        console.table(usersList);
      }
    });
    
    
    return () => {
      console.log("Cleaning up user subscription...");
      usersRef.map().off(userSubscription);
    };
  }, [currentUser]);

  
  const toggleModal = () => {
    if (isModalOpen) {
      modalRef.current.close();
      setSearchQuery("");
      setSearchResults([]);
      setErrorMessage("");
    } else {
      modalRef.current.showModal();
    }
    setIsModalOpen(!isModalOpen);
  };

  
  const searchUsers = () => {
    if (!searchQuery.trim()) {
      setErrorMessage("Please enter a username to search");
      return;
    }

    setIsSearching(true);
    setErrorMessage("");
    setSearchResults([]);
    
    const query = searchQuery.toLowerCase().trim();
    const results = [];
    
    console.log("Searching for users with query:", query);
    console.log("Current user searching:", currentUser?.username);
    
    
    allUsers.forEach(user => {
      if (user.username && user.username.toLowerCase().includes(query)) {
        
        if (currentUser && user.username !== currentUser.username) {
          console.log("Found potential match:", user.username);
          results.push({
            id: user.id,
            username: user.username,
            address: user.address || user.id
          });
        }
      }
    });
    
    
    setSearchResults(results);
    setIsSearching(false);
    
    
    if (results.length === 0) {
      setErrorMessage("No users found matching that username");
    }
  };

  
  const addFriend = (user) => {
    
    let isAlreadyFriend = false;
    if (Array.isArray(friends)) {
      for (let i = 0; i < friends.length; i++) {
        const f = friends[i];
        if (f && (f.id === user.id || f.username === user.username)) {
          isAlreadyFriend = true;
          break;
        }
      }
    }
    
    if (isAlreadyFriend) {
      setErrorMessage(`${user.username} is already in your friends list`);
      return;
    }
    
    console.log("Adding friend:", user);
    
    
    const updatedFriends = Array.isArray(friends) ? [...friends, user] : [user];
    setFriends(updatedFriends);
    
    
    const savedData = localStorage.getItem('userData');
    if (savedData) {
      try {
        const userData = JSON.parse(savedData);
        userData.friends = updatedFriends;
        localStorage.setItem('userData', JSON.stringify(userData));
      } catch (e) {
        console.error("Error updating localStorage:", e);
      }
    }
    
    
    if (currentUser && currentUser.account) {
      console.log(`Adding friend to ${currentUser.account}'s friends list`);
      
      
      gun.get("usersList")
        .get(currentUser.account)
        .get("friends")
        .set({
          id: user.id,
          username: user.username,
          address: user.address,
          addedAt: new Date().toISOString()
        }, ack => {
          if (ack.err) {
            console.error("Failed to add friend (set method):", ack.err);
            
            
            gun.get("usersList")
              .get(currentUser.account)
              .get("friends")
              .get(user.id)
              .put({
                username: user.username,
                address: user.address,
                addedAt: new Date().toISOString()
              }, innerAck => {
                if (innerAck.err) {
                  console.error("Failed to add friend (put method):", innerAck.err);
                  setErrorMessage("Failed to add friend. Please try again.");
                } else {
                  console.log("Friend added successfully via fallback method");
                  toggleModal();
                }
              });
          } else {
            console.log("Friend added successfully");
            toggleModal();
          }
        });
    } else {
      setErrorMessage("You must be logged in to add friends");
    }
  };

  // Function to navigate to ChatPage with selected friend
  const startChatWithFriend = (friend) => {
    console.log("Starting chat with friend:", friend);
    navigate("/chatpage", {
      state: {
        currentUser: currentUser,
        friends: friends,
        selectedFriend: friend
      }
    });
  };
  
  const goToHome = () => {
    navigate("/home", { 
      state: {
        account: currentUser?.account,
        username: currentUser?.username,
        signature: currentUser?.signature,
        friends: friends
      }
    });
  };

  return (
    <div className="flex flex-col p-4 gap-4 min-h-screen bg-gray-900 text-white">
      <div className="flex justify-between">
        <button
          onClick={goToHome}
          className="py-3 px-6 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition duration-300"
        >
          Back to Home
        </button>

        <button 
          onClick={toggleModal}
          className="py-3 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition duration-300"
        >
          Add Friend
        </button>
      </div>

      {/* Friends list - Enhanced to be obviously clickable */}
      <div className="mt-4 bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Your Friends</h2>
        <p className="text-gray-400 mb-4">Click on a friend to start chatting</p>
        
        {Array.isArray(friends) && friends.length > 0 ? (
          <ul className="space-y-2">
            {friends.map((friend, index) => (
              <li 
                key={friend.id || index} 
                className="bg-gray-700 hover:bg-gray-600 transition-all duration-200 p-3 rounded-lg flex items-center justify-between cursor-pointer border border-transparent hover:border-purple-500"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {friend.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <span className="ml-3 font-medium">{friend.username}</span>
                </div>
                
                <button onClick={() => startChatWithFriend(friend)} className="bg-purple-600 hover:bg-purple-500 text-white py-1 px-3 rounded text-sm">
                  Chat Now
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">You haven't added any friends yet.</p>
        )}
      </div>

      {/* Add Friend Modal */}
      <dialog
        ref={modalRef}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 backdrop:bg-black/40 backdrop:backdrop-blur-sm p-6 rounded-xl shadow-2xl bg-gray-900 text-white w-full max-w-md"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Add a Friend</h2>
          <button
            onClick={toggleModal}
            className="text-white text-xl px-3 py-1 rounded hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col text-left">
            <span className="text-lg mb-1">Search by Username</span>
            <div className="flex">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                type="text"
                placeholder="Enter username"
                className="p-3 rounded-l-md text-black bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 flex-grow"
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              />
              <button
                onClick={searchUsers}
                disabled={isSearching}
                className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-r-md transition disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </label>

          {errorMessage && (
            <div className="text-red-400 text-sm mt-1">{errorMessage}</div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Search Results</h3>
              <ul className="divide-y divide-gray-700">
                {searchResults.map((user) => (
                  <li key={user.id} className="py-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="ml-3">{user.username}</span>
                    </div>
                    <button
                      onClick={() => addFriend(user)}
                      className="bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-md text-sm transition"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
};

export default Chat;