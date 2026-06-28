export default function ProfileCard({ user, onEdit }) {
  return (
    <aside className="profile-col">
      <div className="profile-card">
        <div className="avatar-wrap">
          {user.avatar ? <img className="avatar-img visible" src={user.avatar} alt="Profile" /> : <div className="avatar-placeholder"><svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>}
        </div>
        <h2 className="profile-name">{user.username}</h2>
        <div className="user-id-pill">{user.id}</div>
      </div>
    </aside>
  );
}
