import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchChatMessages, postChatMessage } from '../api/api';
import '../styles/chat.css';

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChatMessages(user?.id)
      .then((data) => setMessages(data.messages || []))
      .catch(() => setError('Unable to load chat history.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const newMessage = {
      type: 'sent',
      senderRole: 'customer',
      senderName: user?.username || 'Customer',
      customerPublicId: user?.id || null,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, newMessage]);
    setText('');
    try {
      await postChatMessage(newMessage);
    } catch {
      setError('Unable to send message.');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result;
      const newMessage = {
        type: 'sent',
        senderRole: 'customer',
        senderName: user?.username || 'Customer',
        customerPublicId: user?.id || null,
        text: '',
        image: base64Str,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, newMessage]);
      try {
        await postChatMessage(newMessage);
      } catch {
        setError('Unable to send photo.');
      }
    };
    reader.readAsDataURL(file);
  };

  // Filter out any dummy seed data
  const filteredMessages = messages.filter(
    (m) => m.senderName !== 'Sample User' && m.text !== 'Sample Message'
  );

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Inquiries / Chat</h1>
      </header>
      <div className="chat-container">
        {loading && <div className="event-item">Loading chat…</div>}
        {error && <div className="event-item">{error}</div>}
        <div className="chat-messages">
          {filteredMessages.map((message, index) => {
            const isOutgoing = message.type === 'sent';
            return (
              <div key={index} className={`msg-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                {!isOutgoing && (
                  <div className="msg-avatar">
                    {message.senderName?.substring(0, 2).toUpperCase() || 'AD'}
                  </div>
                )}
                <div className={`bubble ${message.image ? 'image-bubble' : ''}`}>
                  {message.text && <div>{message.text}</div>}
                  {message.image && <img src={message.image} alt="Attachment" />}
                  <div className="bubble-meta">
                    <span className="bubble-time">{message.time}</span>
                    {isOutgoing && <span className="read-tick">✓</span>}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageChange}
          />
          <div className="attach-btn" title="Attach Image" onClick={() => fileInputRef.current.click()}>
            <svg viewBox="0 0 24 24">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
          <input
            className="chat-input"
            placeholder="Type your message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button className="send-btn" onClick={handleSend} title="Send Message">
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
