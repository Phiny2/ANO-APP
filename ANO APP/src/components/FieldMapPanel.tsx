interface FieldScoutPin {
  label: string;
  detail: string;
}

interface FieldMapPanelProps {
  cropName: string;
  regionName: string;
  totalAreaHa: number;
  plantedAreaHa: number;
  remainingAreaHa: number;
  pins: FieldScoutPin[];
}

function FieldMapPanel({
  cropName,
  regionName,
  totalAreaHa,
  plantedAreaHa,
  remainingAreaHa,
  pins,
}: FieldMapPanelProps) {
  const sectors = Array.from({ length: 6 }, (_, index) => {
    const sectorSize = totalAreaHa > 0 ? totalAreaHa / 6 : 0;
    const plantedInSector = Math.max(Math.min(plantedAreaHa - sectorSize * index, sectorSize), 0);
    const fill = sectorSize > 0 ? Math.max(Math.min((plantedInSector / sectorSize) * 100, 100), 0) : 0;
    return {
      id: `sector-${index + 1}`,
      label: `Block ${index + 1}`,
      fill,
    };
  });

  return (
    <article className="subcard field-map-card">
      <div className="section-header compact-header">
        <div>
          <h3>Field map</h3>
          <p className="muted">
            {cropName} | {regionName}
          </p>
        </div>
        <span className="badge accent">{remainingAreaHa.toFixed(1)} ha left</span>
      </div>

      <div className="field-map-grid">
        {sectors.map((sector) => (
          <div className="field-sector" key={sector.id}>
            <div className="field-sector-fill" style={{ height: `${sector.fill}%` }} />
            <span>{sector.label}</span>
            <strong>{sector.fill.toFixed(0)}%</strong>
          </div>
        ))}
      </div>

      <div className="scout-pin-grid">
        {pins.length ? (
          pins.slice(0, 3).map((pin) => (
            <article className="scout-pin-card" key={`${pin.label}-${pin.detail}`}>
              <span className="map-pin" />
              <strong>{pin.label}</strong>
              <p>{pin.detail}</p>
            </article>
          ))
        ) : (
          <article className="scout-pin-card">
            <span className="map-pin" />
            <strong>No active scouting pins</strong>
            <p>Photo enquiries and issue reports will appear here as the field map gains more detail.</p>
          </article>
        )}
      </div>
    </article>
  );
}

export default FieldMapPanel;
