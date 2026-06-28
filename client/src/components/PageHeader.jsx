export default function PageHeader({ title, subtitle, legend }) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {legend && <div className="header-legend">{legend}</div>}
    </header>
  );
}
