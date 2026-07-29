import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchAdminInquiries, fetchAdminRequests, sendAdminInquiryReply, fetchUser, markConversationRead, deleteConversation } from '../../api/api';

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

export default function AdminInquiries() {
  const [messages, setMessages] = useState([]);
  const [activeConv, setActiveConv] = useState('');
  const [reply, setReply] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadConversationIds, setUnreadConversationIds] = useState(new Set());
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 480 : false));
  const [showChatView, setShowChatView] = useState(false);
  const [adminRequests, setAdminRequests] = useState([]);
  const [receiptPromptMsgIndex, setReceiptPromptMsgIndex] = useState(null);
  const [customerAvatars, setCustomerAvatars] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchCurrentX, setTouchCurrentX] = useState(0);
  const [swipingMsgId, setSwipingMsgId] = useState(null);

  const handleTouchStart = (e, msgId) => {
    setTouchStartX(e.touches[0].clientX);
    setSwipingMsgId(msgId);
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
    if (swipingMsgId && touchCurrentX > 40) {
      setReplyingTo(msg);
    }
    setTouchStartX(0);
    setTouchCurrentX(0);
    setSwipingMsgId(null);
  };
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const selectCustomerId = location.state?.selectCustomerId || null;
  const selectCustomerName = location.state?.selectCustomerName || null;

  useEffect(() => {
    Promise.all([fetchAdminInquiries(), fetchAdminRequests()])
      .then(([inquiryData, requestData]) => {
        const msgs = inquiryData.messages || [];
        setMessages(msgs);
        setAdminRequests(requestData.requests || []);
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
    const mediaQuery = window.matchMedia('(max-width: 480px)');
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener?.('change', updateViewport);
    mediaQuery.addListener?.(updateViewport);

    return () => {
      mediaQuery.removeEventListener?.('change', updateViewport);
      mediaQuery.removeListener?.(updateViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowChatView(false);
      return;
    }

    setShowChatView(Boolean(activeConv));
  }, [activeConv, isMobile]);

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

  // Fetch and cache customer avatar when switching conversations
  useEffect(() => {
    if (!activeConv) return;
    if (customerAvatars[activeConv] !== undefined) return; // already fetched
    fetchUser(activeConv)
      .then((res) => {
        const avatar = res?.user?.avatar || null;
        setCustomerAvatars((prev) => ({ ...prev, [activeConv]: avatar }));
      })
      .catch(() => {
        setCustomerAvatars((prev) => ({ ...prev, [activeConv]: null }));
      });
  }, [activeConv]);

  const activeConversation = conversationMap[activeConv];
  const activeMessages = activeConversation?.messages || [];
  const activeBookingRequest = adminRequests.find((req) => {
    const requestCustomerId = req.customerId || req.customer_public_id || req.customerId?.toString?.();
    return requestCustomerId && String(requestCustomerId) === String(activeConv);
  });

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

  const scrollToMessage = (targetId) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(targetId);
      setTimeout(() => setHighlightedId(null), 2000);
    }
  };

  const handleReply = async () => {
    if (!reply.trim() || !activeConv) return;
    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentReply = replyingTo ? {
      id: replyingTo.id,
      senderName: replyingTo.senderName,
      text: replyingTo.text,
      image: replyingTo.image ? '📷 Photo' : null
    } : null;

    const payload = {
      senderRole: 'admin',
      senderName: 'RRC Admin',
      customerPublicId: activeConv,   // links reply to this customer's thread
      text: reply.trim(),
      time: timeLabel,
      replyTo: currentReply,
    };

    setReply('');
    setReplyingTo(null);

    try {
      const response = await sendAdminInquiryReply(payload);
      setMessages((prev) => [...prev, response.message]);
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
      const currentReply = replyingTo ? {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.text,
        image: replyingTo.image ? '📷 Photo' : null
      } : null;

      const payload = {
        senderRole: 'admin',
        senderName: 'RRC Admin',
        customerPublicId: activeConv,
        text: '',
        image: base64Str,
        time: timeLabel,
        replyTo: currentReply,
      };

      setReplyingTo(null);

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
                  {customerAvatars[conv.id]
                    ? <img src={customerAvatars[conv.id]} alt={conv.name} className="conv-avatar-img" />
                    : conv.name.substring(0, 2).toUpperCase()}
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
                  <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
              )}
              {/* Avatar is clickable — tapping opens the info panel (Messenger-style) */}
              <div
                className="chat-header-avatar chat-header-avatar-btn"
                onClick={handleShowInfo}
                title="View profile"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleShowInfo()}
              >
                {customerAvatars[activeConv]
                  ? <img src={customerAvatars[activeConv]} alt={activeConversation?.name} className="msg-avatar-img" />
                  : (activeConversation?.name || '').substring(0, 2).toUpperCase()}
              </div>
              <div className="chat-header-info" onClick={isMobile ? handleShowInfo : undefined} style={isMobile ? { cursor: 'pointer' } : {}}>
                <div className="chat-header-name">{activeConversation?.name || activeConv}</div>
                <div className="chat-header-status">
                  <span className="status-dot online"></span>
                  Online
                </div>
              </div>
              <div className="chat-header-actions">
                {activeBookingRequest && (
                  <button
                    type="button"
                    className="chat-action-btn booking-icon"
                    title={`View Booking ${activeBookingRequest.id}`}
                    onClick={() => navigate('/admin/requests', { state: { searchId: activeBookingRequest.id } })}
                  >
                    <svg viewBox="0 0 24 24">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                    </svg>
                  </button>
                )}
                <button className="chat-action-btn" title="Phone Call" type="button" onClick={handlePhoneCall}>
                  <svg viewBox="0 0 24 24">
                    <path d="M6.62 10.79a15.149 15.149 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </button>
                <button className="chat-action-btn delete-icon" title="Delete Chat" onClick={handleDeleteConversation}>
                  <svg viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
                <button className="chat-action-btn info-icon" title="Info" onClick={handleShowInfo}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="chat-messages">
              {activeMessages.map((msg, index) => {
                const isOutgoing = msg.senderRole === 'admin' || msg.type === 'sent';
                const isReceiptImage = !isOutgoing && msg.image;
                const currentDateHeader = getMessageDateHeader(msg.createdAt, msg.time);
                const prevDateHeader = index > 0 ? getMessageDateHeader(activeMessages[index - 1].createdAt, activeMessages[index - 1].time) : null;
                const showDateHeader = currentDateHeader && currentDateHeader !== prevDateHeader;

                return (
                  <React.Fragment key={msg.id || index}>
                    {showDateHeader && (
                      <div className="date-separator">
                        <span>{currentDateHeader}</span>
                      </div>
                    )}
                    <div
                      id={`msg-${msg.id || index}`}
                      className={`msg-row ${isOutgoing ? 'outgoing' : 'incoming'} ${highlightedId === msg.id ? 'highlight-msg' : ''}`}
                      onTouchStart={(e) => handleTouchStart(e, msg.id || index)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={() => handleTouchEnd(msg)}
                      style={
                        swipingMsgId === (msg.id || index) && touchCurrentX > 0
                          ? { transform: `translateX(${touchCurrentX}px)`, transition: 'none' }
                          : { transition: 'transform 0.2s ease' }
                      }
                    >
                      {!isOutgoing && (
                        <div className="msg-avatar">
                          {customerAvatars[msg.customerPublicId]
                            ? <img src={customerAvatars[msg.customerPublicId]} alt={msg.senderName} className="msg-avatar-img" />
                            : msg.senderName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {isOutgoing && (
                        <button
                          className="reply-trigger-btn"
                          title="Reply"
                          onClick={() => setReplyingTo(msg)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                          </svg>
                        </button>
                      )}
                      <div className={`bubble ${msg.image ? 'image-bubble' : ''}`}>
                        {/* Quoted Reply Box */}
                        {msg.replyTo && (
                          <div
                            className="reply-quote-box"
                            onClick={() => msg.replyTo.id && scrollToMessage(msg.replyTo.id)}
                            title="Click to view original message"
                          >
                            <div className="reply-quote-name">{msg.replyTo.senderName}</div>
                            <div className="reply-quote-text">
                              {msg.replyTo.text || (msg.replyTo.image ? '📷 Photo' : 'Message')}
                            </div>
                          </div>
                        )}
                        {msg.text && <div>{msg.text}</div>}
                        {msg.image && <img src={msg.image} alt="Attachment" />}
                        <div className="bubble-meta">
                          <span className="bubble-time">{msg.time}</span>
                          {isOutgoing && <span className="read-tick">✓</span>}
                        </div>
                      </div>
                      {!isOutgoing && (
                        <button
                          className="reply-trigger-btn"
                          title="Reply"
                          onClick={() => setReplyingTo(msg)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {isReceiptImage && activeBookingRequest && receiptPromptMsgIndex !== index && (
                      <div className="receipt-prompt">
                        <span className="receipt-prompt-icon">🧾</span>
                        <span className="receipt-prompt-text">Receipt uploaded — mark this request as paid?</span>
                        <button
                          className="receipt-prompt-btn"
                          onClick={() => {
                            setReceiptPromptMsgIndex(index);
                            navigate('/admin/requests', { state: { searchId: activeBookingRequest.id } });
                          }}
                        >
                          Mark as Paid
                        </button>
                        <button
                          className="receipt-prompt-dismiss"
                          title="Dismiss"
                          onClick={() => setReceiptPromptMsgIndex(index)}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview Bar above input bar */}
            {replyingTo && (
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
                <div className="info-avatar">
                  {customerAvatars[activeConv]
                    ? <img src={customerAvatars[activeConv]} alt={infoData.username} className="msg-avatar-img" />
                    : (infoData.username || infoData.id || '').substring(0, 2).toUpperCase()}
                </div>
                <div className="info-rows">
                  <div><strong>Name:</strong> {infoData.username || '—'}</div>
                  <div><strong>ID:</strong> {infoData.id || infoData.public_id || activeConv}</div>
                  <div><strong>Email:</strong> {infoData.email || '—'}</div>
                  <div><strong>Phone:</strong> {infoData.phone || '—'}</div>
                  {activeBookingRequest && (
                    <div>
                      <strong>Booking Request:</strong>{' '}
                      <button
                        type="button"
                        className="chat-request-link"
                        onClick={() => {
                          setShowInfo(false);
                          navigate('/admin/requests', { state: { searchId: activeBookingRequest.id } });
                        }}
                      >
                        <span className="chat-request-badge">Open</span>
                        <span>{activeBookingRequest.id}</span>
                      </button>
                    </div>
                  )}
                </div>
                {/* Delete conversation — always accessible from info panel */}
                <button className="info-delete-btn" onClick={() => { setShowInfo(false); handleDeleteConversation(); }}>
                  <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  Delete Conversation
                </button>
              </div>
            ) : (
              <div className="info-body">
                <div className="info-avatar">
                  {(activeConversation?.name || activeConv || 'CU').substring(0, 2).toUpperCase()}
                </div>
                <div className="info-rows">
                  <div><strong>Customer ID:</strong> {activeConv}</div>
                  <div style={{ color: '#777', fontStyle: 'italic', fontSize: '13px', margin: '8px 0' }}>No additional profile information available.</div>
                </div>
                <button className="info-delete-btn" onClick={() => { setShowInfo(false); handleDeleteConversation(); }}>
                  <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                  Delete Conversation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
