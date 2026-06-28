import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchAdminInquiries, sendAdminInquiryReply, fetchUser, markConversationRead, deleteConversation } from '../../api/api';

export default function AdminInquiries() {
  const [messages, setMessages] = useState([]);
  const [activeConv, setActiveConv] = useState('');
  const [reply, setReply] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadConversationIds, setUnreadConversationIds] = useState(new Set());
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 360 : false));
  const [showChatView, setShowChatView] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const location = useLocation();
  const selectCustomerId = location.state?.selectCustomerId || null;
  const selectCustomerName = location.state?.selectCustomerName || null;

  useEffect(() => {
    fetchAdminInquiries()
      .then((data) => {
        const msgs = data.messages || [];
        setMessages(msgs);
        // Auto-select the conversation passed from AdminRequests
        if (selectCustomerId) {
          setActiveConv(selectCustomerId);
        }
      })
      .catch(() => {});
  }, []);

  // Filter out seed/dummy data
  const filteredMessages = messages.filter(
    (m) => m.senderName !== 'Sample User' && m.text !== 'Sample Message'
  );

  // Build conversation list: each unique customer thread, regardless of who sent the first message.
  // Key = customerPublicId, value = { id, name, messages[] }
  const conversationMap = {};
  filteredMessages.forEach((msg) => {
    if (!msg.customerPublicId) return;

    const fallbackName = selectCustomerName || `Customer ${msg.customerPublicId.slice(-6)}`;

    if (!conversationMap[msg.customerPublicId]) {
      conversationMap[msg.customerPublicId] = {
        id: msg.customerPublicId,
        name: msg.senderRole === 'customer' ? msg.senderName || fallbackName : fallbackName,
        messages: [],
      };
    }

    if (msg.senderRole === 'customer' && msg.senderName) {
      conversationMap[msg.customerPublicId].name = msg.senderName;
    }

    conversationMap[msg.customerPublicId].messages.push(msg);
  });

  // If navigated from a request but this customer has no messages yet,
  // create a stub conversation so the chat panel opens for them
  if (selectCustomerId && !conversationMap[selectCustomerId]) {
    conversationMap[selectCustomerId] = {
      id: selectCustomerId,
      name: selectCustomerName || selectCustomerId,
      messages: [],
    };
  }

  const conversations = Object.values(conversationMap);

  // Filter conversations by search input (by name or ID)
  const displayedConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const unreadCount = displayedConversations.filter((conv) => unreadConversationIds.has(conv.id) && conv.id !== activeConv).length;

  useEffect(() => {
    if (!messages.length) return;

    setUnreadConversationIds((prev) => {
      const next = new Set(prev);
      messages.forEach((msg) => {
        // Only consider customer-sent messages that are not already marked read
        if (
          msg.customerPublicId &&
          msg.senderRole === 'customer' &&
          !msg.isRead &&
          msg.customerPublicId !== activeConv
        ) {
          next.add(msg.customerPublicId);
        }
      });
      return next;
    });
  }, [messages, activeConv]);

  useEffect(() => {
    if (!activeConv) return;

    setUnreadConversationIds((prev) => {
      if (!prev.has(activeConv)) return prev;
      const next = new Set(prev);
      next.delete(activeConv);
      return next;
    });
  }, [activeConv]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 360px)');
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener?.('change', updateViewport);

    return () => mediaQuery.removeEventListener?.('change', updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowChatView(false);
      return;
    }

    if (selectCustomerId && activeConv) {
      setShowChatView(true);
    }
  }, [activeConv, isMobile, selectCustomerId]);

  // Auto-select first conversation only if no selectCustomerId was passed
  useEffect(() => {
    if (!activeConv && !selectCustomerId && displayedConversations.length > 0 && !isMobile) {
      setActiveConv(displayedConversations[0].id);
    }
  }, [displayedConversations.length, activeConv, selectCustomerId, isMobile]);

  // Scroll to bottom of chat area when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv, messages]);

  const activeConversation = conversationMap[activeConv];
  const activeMessages = activeConversation?.messages || [];

  const handleSelectConversation = (conversationId) => {
    setActiveConv(conversationId);
    if (isMobile) {
      setShowChatView(true);
    }
  };

  // Persist read state on server when opening a conversation
  useEffect(() => {
    if (!activeConv) return;
    // remove from local unread set immediately
    setUnreadConversationIds((prev) => {
      if (!prev.has(activeConv)) return prev;
      const next = new Set(prev);
      next.delete(activeConv);
      return next;
    });

    // Mark messages locally as read to avoid re-adding them when messages update
    setMessages((prev) => prev.map((m) => (m.customerPublicId === activeConv ? { ...m, isRead: true } : m)));

    // Tell server this conversation has been read
    (async () => {
      try {
        await markConversationRead(activeConv);
      } catch (e) {
        // ignore failures — local state still cleared
      }
    })();
  }, [activeConv]);

  const handleBackToList = () => {
    setShowChatView(false);
  };

  const [showInfo, setShowInfo] = useState(false);
  const [infoData, setInfoData] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const handleShowInfo = async () => {
    if (!activeConv) return;
    setInfoLoading(true);
    try {
      const res = await fetchUser(activeConv);
      setInfoData(res.user || res);
      setShowInfo(true);
    } catch (_) {
      setInfoData(null);
      setShowInfo(true);
    } finally {
      setInfoLoading(false);
    }
  };

  const formatPhilippinePhone = (phone) => {
    const cleaned = String(phone || '').replace(/\D/g, '');
    return cleaned.length === 11 && cleaned.startsWith('09') ? cleaned : '';
  };

  const handlePhoneCall = async () => {
    if (!activeConv) return;
    let phone = infoData?.phone;
    if (!phone) {
      setInfoLoading(true);
      try {
        const res = await fetchUser(activeConv);
        const user = res.user || res;
        phone = user?.phone;
        setInfoData(user);
      } catch (_) {
        phone = '';
      } finally {
        setInfoLoading(false);
      }
    }

    const formattedPhone = formatPhilippinePhone(phone);
    if (!formattedPhone) {
      window.alert('Unable to place call. The customer phone number must be an 11-digit Philippine number starting with 09.');
      return;
    }
    window.location.href = `tel:${formattedPhone}`;
  };

  const handleDeleteConversation = async () => {
    if (!activeConv) return;
    const ok = window.confirm(`Delete all chat messages for customer ${activeConv}? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteConversation(activeConv);
      // remove from local messages and unread set
      setMessages((prev) => prev.filter((m) => m.customerPublicId !== activeConv));
      setUnreadConversationIds((prev) => {
        if (!prev.has(activeConv)) return prev;
        const next = new Set(prev);
        next.delete(activeConv);
        return next;
      });
      setActiveConv('');
      if (isMobile) setShowChatView(false);
      setShowInfo(false);
    } catch (e) {
      // ignore; could show error toast later
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeConv) return;
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const payload = {
      senderRole: 'admin',
      senderName: 'RRC Admin',
      customerPublicId: activeConv,   // links reply to this customer's thread
      text: reply.trim(),
      time: timeLabel,
    };

    try {
      const response = await sendAdminInquiryReply(payload);
      setMessages((prev) => [...prev, response.message]);
      setReply('');
    } catch {}
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result;
      if (!activeConv) return;
      const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const payload = {
        senderRole: 'admin',
        senderName: 'RRC Admin',
        customerPublicId: activeConv,
        text: '',
        image: base64Str,
        time: timeLabel,
      };

      try {
        const response = await sendAdminInquiryReply(payload);
        setMessages((prev) => [...prev, response.message]);
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`admin-inquiries-shell ${isMobile ? 'mobile' : ''}`}>
      {/* Left panel: Conversation List */}
      <div className={`conv-panel ${isMobile && showChatView ? 'mobile-hidden' : ''}`}>
        <div className="conv-panel-header">
          <h2 className="conv-panel-title">Inquiries</h2>
          <span className={`conv-unread-total ${unreadCount === 0 ? 'hidden' : ''}`}>
            {unreadCount}
          </span>
        </div>

        <div className="conv-search-wrapper">
          <svg viewBox="0 0 24 24">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            className="conv-search-input"
            type="text"
            placeholder="Search conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="conv-list">
          {displayedConversations.map((conv) => {
            const isUnread = unreadConversationIds.has(conv.id) && conv.id !== activeConv;
            const lastMsg = conv.messages[conv.messages.length - 1];
            const previewText = lastMsg ? (lastMsg.text || '📷 Photo') : 'No messages yet';
            const previewTime = lastMsg ? lastMsg.time : '';

            return (
              <div
                key={conv.id}
                className={`conv-item ${isUnread ? 'unread' : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="conv-avatar">
                  {conv.name.substring(0, 2).toUpperCase()}
                  <span className="online-dot"></span>
                </div>
                <div className="conv-info">
                  <div className="conv-name">{conv.name}</div>
                  <div className="conv-preview">{previewText}</div>
                </div>
                <div className="conv-meta">
                  <div className="conv-time">{previewTime}</div>
                  {isUnread && <span className="conv-unread-badge">•</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Active Chat View */}
      <div className={`chat-panel ${isMobile && !showChatView ? 'mobile-hidden' : ''}`}>
        {activeConv ? (
          <div className="chat-active">
            <div className="chat-header">
              {isMobile && (
                <button className="mobile-back-btn" onClick={handleBackToList} title="Back to inbox">
                  ←
                </button>
              )}
              <div className="chat-header-avatar">
                {(activeConversation?.name || '').substring(0, 2).toUpperCase()}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">{activeConversation?.name || activeConv}</div>
                <div className="chat-header-status">
                  <span className="status-dot online"></span>
                  Online
                </div>
              </div>
              <div className="chat-header-actions">
                <button className="chat-action-btn" title="Phone Call" type="button" onClick={handlePhoneCall}>
                  <svg viewBox="0 0 24 24">
                    <path d="M6.62 10.79a15.149 15.149 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </button>
                <button className="chat-action-btn" title="Delete Chat" onClick={handleDeleteConversation}>
                  <svg viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
                <button className="chat-action-btn" title="Info" onClick={handleShowInfo}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="chat-messages">
              {activeMessages.map((msg, index) => {
                const isOutgoing = msg.senderRole === 'admin';
                return (
                  <div key={index} className={`msg-row ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                    {!isOutgoing && (
                      <div className="msg-avatar">
                        {msg.senderName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className={`bubble ${msg.image ? 'image-bubble' : ''}`}>
                      {msg.text && <div>{msg.text}</div>}
                      {msg.image && <img src={msg.image} alt="Attachment" />}
                      <div className="bubble-meta">
                        <span className="bubble-time">{msg.time}</span>
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
                type="text"
                placeholder="Type your message..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
              <button className="send-btn" onClick={handleReply} title="Send Message">
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-empty">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
            </svg>
            <p>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
      {showInfo && (
        <div className="info-modal" onClick={() => setShowInfo(false)}>
          <div className="info-panel" onClick={(e) => e.stopPropagation()}>
            <button className="info-close" onClick={() => setShowInfo(false)}>✕</button>
            {infoLoading ? (
              <div className="info-loading">Loading...</div>
            ) : infoData ? (
              <div className="info-body">
                <div className="info-avatar">{(infoData.username || infoData.id || '').substring(0,2).toUpperCase()}</div>
                <div className="info-rows">
                  <div><strong>Name:</strong> {infoData.username || '—'}</div>
                  <div><strong>ID:</strong> {infoData.id || infoData.public_id || activeConv}</div>
                  <div><strong>Email:</strong> {infoData.email || '—'}</div>
                  <div><strong>Phone:</strong> {infoData.phone || '—'}</div>
                </div>
              </div>
            ) : (
              <div className="info-body">No information available</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
