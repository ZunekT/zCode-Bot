/** Szkielet ładowania – pokazywany natychmiast po kliknięciu, zanim serwer odda dane. */
export default function Loading() {
  return (
    <div className="app-page" aria-busy="true" aria-label="Ładowanie">
      <div className="sk sk-title" />
      <div className="sk-grid">
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
        <div className="sk sk-card" />
      </div>
      <div className="sk sk-block" />
    </div>
  );
}
