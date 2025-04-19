import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import Gun from 'gun';
import 'gun/sea';

// Initialize Gun
const gun = Gun({
  peers: [
    'http://localhost:4000/gun',
    'https://gun-manhattan.herokuapp.com/gun'
  ],
  localStorage: false,
});

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const didInit = useRef(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Identity & Loading
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);

  // Messages & UI
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');

  // Image Upload States
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState(null);

  // Encryption state
  const [encryptionReady, setEncryptionReady] = useState(false);

  // Constants for image upload
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB max image size

  // MetaMask helpers
  const getEncryptionPublicKey = useCallback(async (address) => {
    try {
      return await window.ethereum.request({
        method: 'eth_getEncryptionPublicKey',
        params: [address],
      });
    } catch {
      return null;
    }
  }, []);

  // 1. One-time load
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const state = location.state;
    const saved = localStorage.getItem('userData');

    if (state?.currentUser && state.selectedFriend) {
      setCurrentUser(state.currentUser);
      setSelectedFriend(state.selectedFriend);
    } else if (saved) {
      try {
        const { username, account } = JSON.parse(saved);
        setCurrentUser({ username, address: account });
        
        const friendStr = localStorage.getItem('selectedFriend');
        if (friendStr) {
          setSelectedFriend(JSON.parse(friendStr));
        } else {
          navigate('/home', { replace: true });
          return;
        }
      } catch {
        navigate('/', { replace: true });
        return;
      }
    } else {
      navigate('/', { replace: true });
      return;
    }

    setIsLoading(false);
  }, [location, navigate]);

  // 2. Publish public key
  useEffect(() => {
    if (!currentUser?.address) return;
    
    (async () => {
      const key = await getEncryptionPublicKey(currentUser.address);
      if (key) {
        gun.get('users').get(currentUser.address).put({ publicKey: key });
        setEncryptionReady(true);
      }
    })();
  }, [currentUser, getEncryptionPublicKey]);

  // 3. Subscribe to messages
  useEffect(() => {
    if (!currentUser || !selectedFriend) return;
    
    const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
    const chatRef = gun.get('chats').get(chatId);
    
    setMessages([]);
    
    const processMessage = (data, id) => {
      if (!data?.text || !data.timestamp || !data.sender) return;
      
      // Handle image messages
      const isImageMessage = data.isImage;
      
      setMessages(prev => {
        if (prev.some(m => m.id === id)) return prev;
        
        return [
          ...prev,
          {
            id,
            text: data.text,
            sender: data.sender,
            timestamp: data.timestamp,
            isMine: data.sender === currentUser.address,
            isEncrypted: !!data.isEncrypted,
            isImage: !!isImageMessage,
            imageName: data.imageName || null,
            imageType: data.imageType || null,
            imageSize: data.imageSize || null,
            imageData: data.imageData || null
          }
        ].sort((a, b) => a.timestamp - b.timestamp);
      });
    };
    
    chatRef.map().once(processMessage);
    chatRef.map().on(processMessage);
    
    return () => {
      chatRef.map().off();
    };
  }, [currentUser, selectedFriend]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert image to base64
  const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed (.jpg, .png, etc.)');
      return;
    }
    
    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
      alert(`Image size exceeds the maximum limit of ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
      return;
    }
    
    setSelectedImage(file);
    
    // Create preview for images
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Cancel image selection
  const cancelImageSelection = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send image message
  const sendImageMessage = async () => {
    if (!selectedImage || !encryptionReady) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Convert image to base64
      setUploadProgress(25);
      const base64Image = await imageToBase64(selectedImage);
      setUploadProgress(75);
      
      // Send message with image data
      const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
      const chatRef = gun.get('chats').get(chatId);
      
      chatRef.set({
        text: `Shared an image: ${selectedImage.name}`,
        sender: currentUser.address,
        timestamp: Date.now(),
        isEncrypted: true,
        isImage: true,
        imageName: selectedImage.name,
        imageType: selectedImage.type,
        imageSize: selectedImage.size,
        imageData: base64Image
      });
      
      setUploadProgress(100);
      setIsUploading(false);
      
      // Reset image selection
      cancelImageSelection();
    } catch (error) {
      console.error('Error sending image:', error);
      setIsUploading(false);
      alert('Failed to send image. Please try again.');
    }
  };

  // Send text message
  const sendMessage = useCallback(async () => {
    if (!messageText.trim() || !encryptionReady) return;
    
    const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
    const chatRef = gun.get('chats').get(chatId);
    
    chatRef.set({
      text: messageText,
      sender: currentUser.address,
      timestamp: Date.now(),
      isEncrypted: true
    });
    
    setMessageText('');
  }, [messageText, encryptionReady, currentUser, selectedFriend]);

  // Helper function to group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Loading chat...</div>
      </div>
    );
  }

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex items-center">
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
          {selectedFriend.username.charAt(0).toUpperCase()}
        </div>
        <div className="ml-3">
          <div className="font-semibold">{selectedFriend.username}</div>
          <div className="text-xs text-gray-500">{selectedFriend.address.substring(0, 6)}...{selectedFriend.address.substring(selectedFriend.address.length - 4)}</div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {Object.keys(groupedMessages).length > 0 ? (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date} className="mb-6">
              <div className="text-center mb-4">
                <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                  {date}
                </span>
              </div>
              
              {dateMessages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex mb-4 ${message.isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs lg:max-w-md rounded-lg p-4 ${
                      message.isMine 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : 'bg-white text-gray-800 rounded-bl-none shadow'
                    }`}
                  >
                    {message.isImage ? (
                      <div className="image-message">
                        <div className="mb-2 overflow-hidden rounded-lg">
                          <img 
                            src={message.imageData} 
                            alt={message.imageName || "Shared image"} 
                            className="w-full h-auto object-contain"
                          />
                        </div>
                        <div className={`text-xs ${message.isMine ? 'text-indigo-100' : 'text-gray-500'} flex justify-between`}>
                          <span>{message.imageName}</span>
                          <span>{formatFileSize(message.imageSize)}</span>
                        </div>
                      </div>
                    ) : (
                      <div>{message.text}</div>
                    )}
                    <div className={`text-xs mt-1 text-right ${message.isMine ? 'text-indigo-100' : 'text-gray-500'}`}>
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-center mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <p className="text-center">No messages yet</p>
            <p className="text-center text-sm mt-2">Start the conversation with {selectedFriend.username}. Your messages are end-to-end encrypted.</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="bg-gray-100 p-3 border-t border-gray-200">
          <div className="relative inline-block">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="h-32 w-auto rounded-lg border border-gray-300"
            />
            <button 
              onClick={cancelImageSelection}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
            >
              🔧
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <div>{selectedImage.name}</div>
            <div>{formatFileSize(selectedImage.size)}</div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {isUploading ? (
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Uploading image...</div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-right">{uploadProgress}%</div>
          </div>
        ) : null}
        
        <div className="flex items-center">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full text-gray-500 hover:text-indigo-500 hover:bg-gray-100 focus:outline-none"
          >
            📎
          </button>
          
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 mx-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (imagePreview) {
                  sendImageMessage();
                } else {
                  sendMessage();
                }
              }
            }}
          />
          
          {imagePreview ? (
            <button
              onClick={sendImageMessage}
              disabled={isUploading || !encryptionReady}
              className={`p-2 rounded-full ${
                isUploading || !encryptionReady
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
              } focus:outline-none`}
            >
              📩
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!messageText.trim() || !encryptionReady}
              className={`p-2 rounded-full ${
                !messageText.trim() || !encryptionReady
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-indigo-500 text-white hover:bg-indigo-600'
              } focus:outline-none`}
            >
              📩
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
