import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import Gun from 'gun';
import 'gun/sea'; // For encryption capabilities

// Initialize Gun with peers
const gun = Gun({
  peers: [
    'http://localhost:4000/gun',
    'https://gun-manhattan.herokuapp.com/gun'
  ],
  localStorage: false
});

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const messageInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // State variables
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load user data from location state or localStorage
  useEffect(() => {
    if (location.state && location.state.currentUser && location.state.selectedFriend) {
      setCurrentUser(location.state.currentUser);
      setSelectedFriend(location.state.selectedFriend);
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
          
          // If no selected friend in state, redirect to friends list
          if (location.state && location.state.selectedFriend) {
            setSelectedFriend(location.state.selectedFriend);
          } else {
            navigate('/chat');
            return;
          }
        } catch (e) {
          console.error("Error parsing saved user data:", e);
          navigate('/');
        }
      } else {
        navigate('/');
      }
    }
    setIsLoading(false);
  }, [location, navigate]);

  // Subscribe to messages when users are loaded
  useEffect(() => {
    if (!currentUser || !selectedFriend) return;
    
    // Create a unique chat ID based on user IDs (sorted to ensure consistency)
    const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
    const messagesRef = gun.get('chats').get(chatId);
    
    console.log(`Subscribing to chat ${chatId} between ${currentUser.username} and ${selectedFriend.username}`);
    
    // Listen for new messages
    const messageListener = messagesRef.map().on((messageData, messageId) => {
      if (messageData && messageData.text && messageData.sender && messageData.timestamp) {
        setMessages(prevMessages => {
          // Check if message already exists to avoid duplicates
          const exists = prevMessages.some(msg => msg.id === messageId);
          if (exists) return prevMessages;
          
          // Add new message
          const newMessage = {
            id: messageId,
            text: messageData.text,
            sender: messageData.sender,
            timestamp: messageData.timestamp,
            isMine: messageData.sender === currentUser.address
          };
          
          // Sort messages by timestamp
          return [...prevMessages, newMessage].sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    });
    
    // Cleanup subscription on unmount
    return () => {
      messagesRef.map().off(messageListener);
    };
  }, [currentUser, selectedFriend]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!messageText.trim()) return;
    
    // Create a unique chat ID (same as in the subscription)
    const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
    const messagesRef = gun.get('chats').get(chatId);
    
    // Create message object
    const messageObject = {
      text: messageText,
      sender: currentUser.address,
      senderName: currentUser.username,
      receiver: selectedFriend.address,
      timestamp: Date.now()
    };
    
    // Save message to Gun
    messagesRef.set(messageObject, (ack) => {
      if (ack.err) {
        console.error("Error sending message:", ack.err);
      } else {
        console.log("Message sent successfully");
      }
    });
    
    // Clear input field
    setMessageText('');
    messageInputRef.current.focus();
  };

  // Handle back navigation
  const goBack = () => {
    navigate('/chat');
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen text-lg text-gray-600">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <header className="flex items-center p-4 bg-blue-600 text-white shadow-md">
        <button 
          className="bg-transparent border-none text-white text-2xl mr-4 cursor-pointer hover:text-gray-200 transition-colors" 
          onClick={goBack}
        >
          ←
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold m-0">{selectedFriend?.username}</h2>
        </div>
      </header>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Say hello to {selectedFriend?.username}!</p>
          </div>
        ) : (
          messages.map(message => (
            <div 
              key={message.id} 
              className={`max-w-[70%] mb-3 ${message.isMine ? 'ml-auto' : 'mr-auto'}`}
            >
              <div 
                className={`relative p-3 rounded-2xl break-words ${
                  message.isMine 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="m-0">{message.text}</p>
                <span className={`block text-xs mt-1 ${message.isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="flex p-4 bg-white border-t border-gray-200" onSubmit={sendMessage}>
        <input
          type="text"
          ref={messageInputRef}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={`Message ${selectedFriend?.username}...`}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-l-full text-base outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button 
          type="submit" 
          disabled={!messageText.trim()} 
          className="ml-2 py-3 px-6 bg-blue-500 text-white rounded-r-full font-medium cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPage;


// import React, { useEffect, useRef, useState } from "react";
// import { useNavigate, useLocation } from "react-router";
// import Gun from "gun";
// import "gun/sea";
// const SEA = Gun.SEA;

// // Initialize Gun with the same peers
// const gun = Gun({
//   peers: ["http://localhost:4000/gun", "https://gun-manhattan.herokuapp.com/gun"],
//   localStorage: false,
// });

// const ChatPage = () => {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const messageInputRef = useRef(null);
//   const messagesEndRef = useRef(null);

//   // User state
//   const [currentUser, setCurrentUser] = useState(null);
//   const [friends, setFriends] = useState([]);
//   const [keyPair, setKeyPair] = useState(null);
  
//   // Chat state
//   const [activeChat, setActiveChat] = useState(null);
//   const [messages, setMessages] = useState([]);
//   const [messageInput, setMessageInput] = useState("");
//   const [loadingMessages, setLoadingMessages] = useState(false);
//   const [friendKeyPairs, setFriendKeyPairs] = useState({});

//   // Load user data on mount
//   useEffect(() => {
//     const loadUserData = async () => {
//       if (location.state && location.state.currentUser) {
//         setCurrentUser(location.state.currentUser);
//         setFriends(Array.isArray(location.state.friends) ? location.state.friends : []);
        
//         // Check if a specific friend was selected from the Chat screen
//         if (location.state.selectedFriend) {
//           // Set it as the active chat after a short delay to ensure state is fully loaded
//           setTimeout(() => {
//             selectChat(location.state.selectedFriend);
//           }, 100);
//         }
//       } else {
//         // Try to load from localStorage
//         const savedData = localStorage.getItem('userData');
//         if (savedData) {
//           try {
//             const parsedData = JSON.parse(savedData);
//             setCurrentUser({
//               username: parsedData.username,
//               account: parsedData.account,
//               address: parsedData.account
//             });
//             setFriends(Array.isArray(parsedData.friends) ? parsedData.friends : []);
//           } catch (e) {
//             console.error("Error parsing saved user data:", e);
//             navigate('/');
//             return;
//           }
//         } else {
//           navigate('/');
//           return;
//         }
//       }
//     };

//     loadUserData();
//   }, [location, navigate]);

//   // Generate or load cryptographic key pair
//   useEffect(() => {
//     const generateOrLoadKeyPair = async () => {
//       if (!currentUser?.account) return;
      
//       try {
//         // Check if we have a stored key pair for this account
//         const storedKeyPair = localStorage.getItem(`keyPair_${currentUser.account}`);
//         if (storedKeyPair) {
//           setKeyPair(JSON.parse(storedKeyPair));
//         } else {
//           // Generate a new key pair and store it
//           const newKeyPair = await SEA.pair();
//           setKeyPair(newKeyPair);
//           localStorage.setItem(`keyPair_${currentUser.account}`, JSON.stringify(newKeyPair));
          
//           // Store public key in user's profile for others to encrypt messages to them
//           gun.get('usersList').get(currentUser.account).get('publicKey').put(newKeyPair.pub);
//         }
//       } catch (error) {
//         console.error("Error generating key pair:", error);
//       }
//     };

//     generateOrLoadKeyPair();
//   }, [currentUser]);

//   // Load friend's public key
//   const loadFriendPublicKey = async (friendId) => {
//     return new Promise((resolve) => {
//       gun.get('usersList').get(friendId).get('publicKey').once((publicKey) => {
//         if (publicKey) {
//           resolve(publicKey);
//         } else {
//           resolve(null);
//         }
//       });
//     });
//   };

//   // Function to create shared secret between current user and friend
//   const createSharedSecret = async (friendPublicKey) => {
//     if (!keyPair || !friendPublicKey) return null;
//     try {
//       return await SEA.secret(friendPublicKey, keyPair);
//     } catch (error) {
//       console.error("Error creating shared secret:", error);
//       return null;
//     }
//   };

//   // Select chat
//   const selectChat = async (friend) => {
//     setActiveChat(friend);
//     setMessages([]);
//     setLoadingMessages(true);
    
//     // Load friend's public key if not already loaded
//     if (!friendKeyPairs[friend.id]) {
//       const publicKey = await loadFriendPublicKey(friend.id);
//       if (publicKey) {
//         const sharedSecret = await createSharedSecret(publicKey);
//         setFriendKeyPairs(prev => ({
//           ...prev,
//           [friend.id]: { publicKey, sharedSecret }
//         }));
//       }
//     }
    
//     // Create chat ID (sorted combination of user IDs to ensure same ID from both sides)
//     const chatId = [currentUser.account, friend.id].sort().join('_');
    
//     // Subscribe to messages
//     subscribeToMessages(chatId);
//   };

//   // Subscribe to messages for a chat
//   const subscribeToMessages = (chatId) => {
//     gun.get('chats').get(chatId).map().on(async (message, msgId) => {
//       if (!message || !message.sender || !message.content) return;
      
//       try {
//         // Check if the message is already in our state
//         setMessages(prevMessages => {
//           const isDuplicate = prevMessages.some(m => m.id === msgId);
//           if (isDuplicate) return prevMessages;
          
//           // Add new message to state
//           const newMessage = {
//             id: msgId,
//             sender: message.sender,
//             timestamp: message.timestamp || Date.now(),
//             content: message.content,
//             decrypted: false // Will be decrypted in useEffect
//           };
          
//           return [...prevMessages, newMessage].sort((a, b) => a.timestamp - b.timestamp);
//         });
//       } catch (error) {
//         console.error("Error processing message:", error);
//       }
//     });
    
//     setLoadingMessages(false);
//   };

//   // Effect to decrypt messages when they come in or when sharedSecret changes
//   useEffect(() => {
//     const decryptMessages = async () => {
//       if (!activeChat || !keyPair || !friendKeyPairs[activeChat.id]?.sharedSecret) return;
      
//       const sharedSecret = friendKeyPairs[activeChat.id].sharedSecret;
      
//       // Create a copy of messages and decrypt them
//       const decryptedMessages = await Promise.all(
//         messages.map(async (message) => {
//           // Skip if already decrypted
//           if (message.decrypted) return message;
          
//           try {
//             // Try to decrypt the message
//             const decryptedContent = await SEA.decrypt(message.content, sharedSecret);
            
//             return {
//               ...message,
//               decryptedContent: decryptedContent,
//               decrypted: true
//             };
//           } catch (error) {
//             console.error("Failed to decrypt message:", error);
//             return {
//               ...message,
//               decryptedContent: "🔒 [Encrypted message]",
//               decrypted: false
//             };
//           }
//         })
//       );
      
//       setMessages(decryptedMessages);
//     };

//     decryptMessages();
//   }, [messages, activeChat, friendKeyPairs, keyPair]);

//   // Scroll to bottom when messages change
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   // Send message
//   const sendMessage = async (e) => {
//     e.preventDefault();
    
//     if (!messageInput.trim() || !activeChat || !keyPair) return;
    
//     try {
//       // Get friend's public key and shared secret
//       const friendData = friendKeyPairs[activeChat.id];
//       if (!friendData || !friendData.sharedSecret) {
//         console.error("Cannot send message: No shared secret available");
//         return;
//       }
      
//       // Encrypt the message
//       const encryptedContent = await SEA.encrypt(messageInput, friendData.sharedSecret);
      
//       // Chat ID (sorted to ensure same ID from both sides)
//       const chatId = [currentUser.account, activeChat.id].sort().join('_');
      
//       // Add message to Gun
//       const messageData = {
//         sender: currentUser.account,
//         receiver: activeChat.id,
//         content: encryptedContent,
//         timestamp: Date.now()
//       };
      
//       gun.get('chats').get(chatId).set(messageData);
      
//       // Clear input
//       setMessageInput("");
//       messageInputRef.current?.focus();
      
//     } catch (error) {
//       console.error("Error sending message:", error);
//     }
//   };

//   // Navigate back to friend list
//   const goToFriendList = () => {
//     navigate("/chat", { 
//       state: {
//         currentUser: currentUser,
//         friends: friends
//       }
//     });
//   };

//   // Format timestamp
//   const formatTime = (timestamp) => {
//     const date = new Date(timestamp);
//     return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//   };

//   return (
//     <div className="flex flex-col h-screen bg-gray-900 text-white">
//       {/* Header */}
//       <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
//         <button 
//           onClick={goToFriendList}
//           className="py-2 px-4 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition"
//         >
//           Back to Friends
//         </button>
        
//         <div className="text-xl font-semibold">
//           {activeChat ? `Chat with ${activeChat.username}` : 'Select a chat'}
//         </div>
        
//         <div className="py-2 px-4 bg-gray-700 rounded-lg">
//           {currentUser?.username}
//         </div>
//       </div>

//       {/* Main area - Sidebar and Chat */}
//       <div className="flex flex-1 overflow-hidden">
//         {/* Friends sidebar */}
//         <div className="w-64 bg-gray-800 border-r border-gray-700 overflow-y-auto">
//           <div className="p-4 font-semibold text-gray-400">Your Friends</div>
//           {friends.length > 0 ? (
//             <ul>
//               {friends.map((friend) => (
//                 <li 
//                   key={friend.id} 
//                   onClick={() => selectChat(friend)}
//                   className={`p-4 flex items-center cursor-pointer hover:bg-gray-700 transition ${
//                     activeChat?.id === friend.id ? 'bg-gray-700' : ''
//                   }`}
//                 >
//                   <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
//                     {friend.username?.charAt(0).toUpperCase() || "?"}
//                   </div>
//                   <span className="ml-3">{friend.username}</span>
//                 </li>
//               ))}
//             </ul>
//           ) : (
//             <div className="p-4 text-gray-500">No friends yet. Add some from the friends page.</div>
//           )}
//         </div>

//         {/* Chat area */}
//         <div className="flex-1 flex flex-col">
//           {activeChat ? (
//             <>
//               {/* Messages area */}
//               <div className="flex-1 p-4 overflow-y-auto bg-gray-900">
//                 {loadingMessages ? (
//                   <div className="flex items-center justify-center h-full">
//                     <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
//                   </div>
//                 ) : messages.length > 0 ? (
//                   <div className="space-y-4">
//                     {messages.map((message) => {
//                       const isFromMe = message.sender === currentUser.account;
//                       return (
//                         <div 
//                           key={message.id}
//                           className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
//                         >
//                           <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
//                             isFromMe 
//                               ? 'bg-purple-600 text-white rounded-br-none' 
//                               : 'bg-gray-700 rounded-bl-none'
//                           }`}>
//                             <div className="break-words">
//                               {message.decryptedContent || "🔒 [Decrypting...]"}
//                             </div>
//                             <div className={`text-xs mt-1 ${isFromMe ? 'text-purple-200' : 'text-gray-400'}`}>
//                               {formatTime(message.timestamp)}
//                             </div>
//                           </div>
//                         </div>
//                       );
//                     })}
//                     <div ref={messagesEndRef} />
//                   </div>
//                 ) : (
//                   <div className="flex items-center justify-center h-full text-gray-500">
//                     No messages yet. Start the conversation!
//                   </div>
//                 )}
//               </div>

//               {/* Message input */}
//               <form onSubmit={sendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
//                 <div className="flex">
//                   <input
//                     ref={messageInputRef}
//                     type="text"
//                     value={messageInput}
//                     onChange={(e) => setMessageInput(e.target.value)}
//                     placeholder="Type a message..."
//                     className="flex-1 py-2 px-4 bg-gray-700 text-white rounded-l-md focus:outline-none focus:ring-2 focus:ring-purple-500"
//                   />
//                   <button
//                     type="submit"
//                     disabled={!messageInput.trim()}
//                     className="py-2 px-6 bg-purple-600 text-white rounded-r-md disabled:opacity-50 hover:bg-purple-700 transition"
//                   >
//                     Send
//                   </button>
//                 </div>
//               </form>
//             </>
//           ) : (
//             <div className="flex-1 flex items-center justify-center text-gray-500">
//               Select a friend to start chatting
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ChatPage;