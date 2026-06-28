export default function EquipmentList({ groups, selectedEquipment, onToggle, onQtyChange }) {
  return (
    <div className="equipment-dropdown-body open">
      <div className="equip-search-wrapper">
        <svg className="equip-search-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
      </div>
      {groups.map((group) => (
        <div key={group.group} className="equipment-group">
          <div className="equip-group-header">
            <span className="equip-group-name">{group.group}</span>
            <span className="equip-group-count">{group.items.length}</span>
          </div>
          {group.items.map((item) => (
            <label key={item.id} className={`equipment-item ${selectedEquipment[item.id] ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(selectedEquipment[item.id])}
                onChange={() => onToggle(item)}
              />
              <span className="equipment-name">{item.name}</span>
              <span className="equip-stock-tag">{item.stock} avail.</span>
              {item.requiresAuth && <span className="equipment-auth-badge">*</span>}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
