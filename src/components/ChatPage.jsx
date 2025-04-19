import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import Gun from 'gun';
import 'gun/sea';

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

  // Identity & Loading
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);

  // Messages & UI
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef(null);

  // Encryption state
  const [encryptionReady, setEncryptionReady] = useState(false);

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
          navigate('/friends', { replace: true });
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
          }
        ].sort((a, b) => a.timestamp - b.timestamp);
      });
    };

    chatRef.map().once(processMessage);
    chatRef.map().on(processMessage);

    return () => { chatRef.map().off(); };
  }, [currentUser, selectedFriend]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !encryptionReady) return;
    const chatId = [currentUser.address, selectedFriend.address].sort().join('_');
    const chatRef = gun.get('chats').get(chatId);
    chatRef.set({
      text: messageText,
      sender: currentUser.address,
      timestamp: Date.now(),
    });
    setMessageText('');
  }, [messageText, encryptionReady, currentUser, selectedFriend]);

  // Group messages by date for better organization
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDate(messages);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e0e0e0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Loading chat...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#f5f7fb',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Enhanced Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: 'white',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <button
            onClick={() => navigate('/home', { replace: true })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              transition: 'background-color 0.2s',
              marginRight: '12px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              {selectedFriend.username.charAt(0).toUpperCase()}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                {selectedFriend.username}
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: encryptionReady ? '#059669' : '#d97706',
                marginTop: '4px'
              }}>
                {encryptionReady ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
                      <path d="M19 11H5V21H19V11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M17 11V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Encrypted
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '6px' }}>
                      <path d="M12 16V16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Setting up encryption...
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
            textAlign: 'center',
            padding: '0 20px'
          }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '16px', color: '#d1d5db' }}>
              <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>No messages yet</p>
            <p style={{ fontSize: '14px', maxWidth: '300px' }}>
              Start the conversation with {selectedFriend.username}. Your messages are end-to-end encrypted.
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '16px 0 8px 0'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  backgroundColor: 'rgba(229, 231, 235, 0.5)',
                  padding: '4px 12px',
                  borderRadius: '16px'
                }}>
                  {new Date(date).toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {msgs.map(message => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.isMine ? 'flex-end' : 'flex-start',
                    marginBottom: '8px'
                  }}
                >
                  {!message.isMine && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '8px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#4b5563',
                      flexShrink: 0
                    }}>
                      {selectedFriend.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: message.isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    backgroundColor: message.isMine ? '#3b82f6' : 'white',
                    color: message.isMine ? 'white' : '#374151',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    wordBreak: 'break-word'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      {message.text}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: message.isMine ? 'rgba(255, 255, 255, 0.7)' : '#9ca3af',
                      textAlign: 'right',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px'
                    }}>
                      {encryptionReady && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 11H5V21H19V11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M17 11V7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {new Date(message.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  
                  {message.isMine && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      marginLeft: '8px'
                    }}>
                      {message.isMine && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Message Input */}
      <form
        onSubmit={sendMessage}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: 'white',
          borderTop: '1px solid #e5e7eb',
          gap: '12px'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          backgroundColor: '#f3f4f6',
          borderRadius: '24px',
          padding: '0 16px'
        }}>
          <button 
            type="button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              padding: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          <input
            type="text"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder={encryptionReady ? "Type a message..." : "Waiting for encryption..."}
            disabled={!encryptionReady}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              padding: '12px 8px',
              fontSize: '15px',
              outline: 'none',
              color: '#374151'
            }}
          />
          
          <button 
            type="button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              padding: '8px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.44 11.05L12.25 20.24C11.12 21.37 9.61 22 8 22C6.39 22 4.88 21.37 3.75 20.24C2.62 19.11 2 17.6 2 16C2 14.4 2.63 12.89 3.76 11.76L12.33 3.19C12.85 2.67 13.54 2.38 14.25 2.38C14.96 2.38 15.65 2.67 16.17 3.19C16.69 3.71 16.99 4.4 16.99 5.11C16.99 5.82 16.69 6.51 16.17 7.03L7.59 15.61C7.33 15.87 6.98 16.01 6.62 16.01C6.26 16.01 5.91 15.87 5.65 15.61C5.39 15.35 5.25 15 5.25 14.64C5.25 14.28 5.39 13.93 5.65 13.67L14.06 5.26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        
        <button
          type="submit"
          disabled={!messageText.trim() || !encryptionReady}
          style={{
            backgroundColor: messageText.trim() && encryptionReady ? '#3b82f6' : '#93c5fd',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: messageText.trim() && encryptionReady ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s',
            flexShrink: 0
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
