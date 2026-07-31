import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { editChatMessage, fetchChatMessages, postChatMessage } from '../api/api';
import '../styles/chat.css';

function getMessageDateHeader(createdAt, timeLabel) {
  if (!createdAt) return null;
  const msgDate = new Date(createdAt);
  if (isNaN(msgDate.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDay = new Date(msgDate.getFullYear(), msgDate.getMonth(), msgDate.getDate());

  if (targetDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (targetDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else if (now.getFullYear() === msgDate.getFullYear()) {
    return msgDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } else {
    return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [expandedOriginalId, setExpandedOriginalId] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchCurrentX, setTouchCurrentX] = useState(0);
  const [swipingMsgId, setSwipingMsgId] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
  const messageLongPressTimer = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const handleTouchStart = (e, msgId) => {
    setTouchStartX(e.touches[0].clientX);
    setSwipingMsgId(msgId);
    messageLongPressTimer.current = window.setTimeout(() => {
      const message = messages.find((item) => (item.id || messages.indexOf(item)) === msgId);
      if (!message) return;
      setMessageMenu({ message, x: e.touches[0].clientX, y: e.touches[0].clientY });
      setTouchCurrentX(0);
    }, 550);
  };

  const handleTouchMove = (e) => {
    if (!swipingMsgId) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX;
    if (diff > 0 && diff < 100) {
      setTouchCurrentX(diff);
    }
  };

  const handleTouchEnd = (msg) => {
    if (messageLongPressTimer.current) {
      window.clearTimeout(messageLongPressTimer.current);
      messageLongPressTimer.current = null;
    }
    if (swipingMsgId && touchCurrentX > 40) {
      setReplyingTo(msg);
    }
    setTouchStartX(0);
    setTouchCurrentX(0);
    setSwipingMsgId(null);
  };

  const handleMessageContextMenu = (event, message) => {
    event.preventDefault();
    setMessageMenu({ message, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    fetchChatMessages(user?.id)
      .then((data) => setMessages(data.messages || []))
      .catch(() => setError('Unable to load chat history.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToMessage = (targetId) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(targetId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  };

  const startEditing = (message) => {
    if (message.senderRole !== 'customer' || message.image || !message.id) return;
    setEditingMessage(message);
    setText(message.text || '');
    setReplyingTo(null);
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setText('');
  };

  const handleEdit = async () => {
    if (!editingMessage || !text.trim()) return;
    try {
      const res = await editChatMessage(editingMessage.id, {
        text: text.trim(),
        senderRole: 'customer',
        customerPublicId: user?.id,
      });
      setMessages((prev) => prev.map((message) => message.id === editingMessage.id ? res.message : message));
      cancelEditing();
    } catch (err) {
      setError(err.message || 'Unable to edit message.');
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    const currentReply = replyingTo ? {
      id: replyingTo.id,
      senderName: replyingTo.senderName,
      text: replyingTo.text,
      image: replyingTo.image ? '📷 Photo' : null
    } : null;

    const newMessage = {
      type: 'sent',
      senderRole: 'customer',
      senderName: user?.username || 'Customer',
      customerPublicId: user?.id || null,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      replyTo: currentReply,
    };

    setMessages((prev) => [...prev, newMessage]);
    setText('');
    setReplyingTo(null);

    try {
      const res = await postChatMessage(newMessage);
      if (res?.message?.id) {
        setMessages((prev) =>
          prev.map((m) => (m === newMessage ? { ...m, id: res.message.id } : m))
        );
      }
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
      const currentReply = replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.text,
        image: replyingTo.image ? '📷 Photo' : null
      } : null;

      const newMessage = {
        type: 'sent',
        senderRole: 'customer',
        senderName: user?.username || 'Customer',
        customerPublicId: user?.id || null,
        text: '',
        image: base64Str,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
        replyTo: currentReply,
      };

      setMessages((prev) => [...prev, newMessage]);
      setReplyingTo(null);

      try {
        const res = await postChatMessage(newMessage);
        if (res?.message?.id) {
          setMessages((prev) =>
            prev.map((m) => (m === newMessage ? { ...m, id: res.message.id } : m))
          );
        }
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
      <div className="chat-container">
        {loading && <div className="event-item">Loading chat…</div>}
        {error && <div className="event-item">{error}</div>}
        <div className="chat-messages">
          {filteredMessages.map((message, index) => {
            const isOutgoing = message.senderRole === 'customer' || message.type === 'sent';
            const currentDateHeader = getMessageDateHeader(message.createdAt, message.time);
            const prevDateHeader = index > 0 ? getMessageDateHeader(filteredMessages[index - 1].createdAt, filteredMessages[index - 1].time) : null;
            const showDateHeader = currentDateHeader && currentDateHeader !== prevDateHeader;

            return (
              <div key={message.id || index} style={{ display: 'contents' }}>
                {showDateHeader && (
                  <div className="date-separator">
                    <span>{currentDateHeader}</span>
                  </div>
                )}
                <div
                  id={`msg-${message.id || index}`}
                  className={`msg-row ${isOutgoing ? 'outgoing' : 'incoming'} ${highlightedId === message.id ? 'highlight-msg' : ''}`}
                  onTouchStart={(e) => handleTouchStart(e, message.id || index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={() => handleTouchEnd(message)}
                  onContextMenu={(e) => handleMessageContextMenu(e, message)}
                  style={
                    swipingMsgId === (message.id || index) && touchCurrentX > 0
                      ? { transform: `translateX(${touchCurrentX}px)`, transition: 'none' }
                      : { transition: 'transform 0.2s ease' }
                  }
                >
                  {!isOutgoing && (
                    <div className="msg-avatar">
                      {message.senderName?.substring(0, 2).toUpperCase() || 'AD'}
                    </div>
                  )}
                  {isOutgoing && (
                    <button
                      className="reply-trigger-btn"
                      title="Reply"
                      onClick={() => setReplyingTo(message)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                      </svg>
                    </button>
                  )}
                  <div className={`bubble ${message.image ? 'image-bubble' : ''}`}>
                    {/* Quoted Reply Box */}
                    {message.replyTo && (
                      <div
                        className="reply-quote-box"
                        onClick={() => message.replyTo.id && scrollToMessage(message.replyTo.id)}
                        title="Click to view original message"
                      >
                        <div className="reply-quote-name">{message.replyTo.senderName}</div>
                        <div className="reply-quote-text">
                          {message.replyTo.text || (message.replyTo.image ? '📷 Photo' : 'Message')}
                        </div>
                      </div>
                    )}
                    {message.originalText && (
                      <button
                        className="edited-indicator"
                        type="button"
                        onClick={() => setExpandedOriginalId((id) => id === message.id ? null : message.id)}
                      >
                        Edited
                      </button>
                    )}
                    {expandedOriginalId === message.id && message.originalText && (
                      <div className="original-message">{message.originalText}</div>
                    )}
                    {message.text && <div>{message.text}</div>}
                    {message.image && <img src={message.image} alt="Attachment" />}
                    <div className="bubble-meta">
                      <span className="bubble-time">{message.time}</span>
                      {isOutgoing && <span className="read-tick">✓</span>}
                    </div>
                  </div>
                  {isOutgoing && !message.image && message.id && (
                    <button className="edit-message-btn" type="button" onClick={() => startEditing(message)} title="Edit message">
                      Edit
                    </button>
                  )}
                  {!isOutgoing && (
                    <button
                      className="reply-trigger-btn"
                      title="Reply"
                      onClick={() => setReplyingTo(message)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Preview Bar above input bar */}
        {editingMessage && (
          <div className="reply-preview-bar edit-preview-bar">
            <div className="reply-preview-content">
              <div className="reply-preview-title"><span>Editing message</span></div>
              <div className="reply-preview-snippet">{editingMessage.text}</div>
            </div>
            <button className="reply-preview-close" onClick={cancelEditing} title="Cancel edit">&times;</button>
          </div>
        )}
        {replyingTo && !editingMessage && (
          <div className="reply-preview-bar">
            <div className="reply-preview-content">
              <div className="reply-preview-title">
                <svg viewBox="0 0 24 24">
                  <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                </svg>
                <span>Replying to {replyingTo.senderName}</span>
              </div>
              <div className="reply-preview-snippet">
                {replyingTo.text || (replyingTo.image ? '📷 Photo' : 'Message')}
              </div>
            </div>
            <button className="reply-preview-close" onClick={() => setReplyingTo(null)} title="Cancel reply">&times;</button>
          </div>
        )}

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
            placeholder={editingMessage ? 'Edit your message...' : replyingTo ? `Replying to ${replyingTo.senderName}…` : 'Type your message...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                editingMessage ? handleEdit() : handleSend();
              }
            }}
          />
          <button className="send-btn" onClick={editingMessage ? handleEdit : handleSend} title={editingMessage ? 'Save Edit' : 'Send Message'}>
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
      {messageMenu && (
        <div className="message-menu-overlay" onClick={() => setMessageMenu(null)}>
          <div
            className="message-menu"
            style={{ top: Math.min(messageMenu.y, window.innerHeight - 120), left: Math.min(messageMenu.x, window.innerWidth - 150) }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => { setReplyingTo(messageMenu.message); setMessageMenu(null); }}>Reply</button>
            {messageMenu.message.senderRole === 'customer' && !messageMenu.message.image && messageMenu.message.id && (
              <button type="button" onClick={() => { startEditing(messageMenu.message); setMessageMenu(null); }}>Edit</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
