export default function ChatMessage({ message }) {
  return (
    <div className={`message-container ${message.type}`}>
      <div className="message-bubble">
        {message.text && <div className="message-text">{message.text}</div>}
        {message.image && <img className="message-image" src={message.image} alt="Attachment" />}
        <div className="message-time">{message.time}</div>
      </div>
    </div>
  );
}
