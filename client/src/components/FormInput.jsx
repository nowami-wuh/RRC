export default function FormInput({ type = 'text', value, onChange, placeholder, className = '', id }) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`field-input ${className}`}
    />
  );
}
