

interface OvenCardProps {
  title: string
  status: "Active" | "Non Active"
  temperature?: number
  onSelect: () => void
  onHistory: () => void
}

const OvenCard = ({ title, status, temperature, onSelect, onHistory }: OvenCardProps) => {
  return (
    <div style={{
      border: "4px solid #D0D0D0",
      borderRadius: "20px",
      width: "350px",
      padding: "40px",
      boxShadow: "4px 4px 10px rgba(0,0,0,0.1)",
      backgroundColor: "white",
      textAlign: "center",
    }}>
      <h3>{title}</h3>
      <p><strong>Status:</strong> {status}</p>
      <p>
        <strong>Current Temp :</strong>{" "}
        <span role="img" aria-label="thermometer">🌡️</span>{" "}
        {temperature ? `${temperature.toFixed(2)} °C` : "—"}
      </p>
      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <button onClick={onSelect} style={{ flex: 1, padding: "20px", backgroundColor: "#E7962C", borderRadius: "20px", border: "none" }}>
          Select
        </button>
        <button onClick={onHistory} style={{ flex: 1, padding: "20px", backgroundColor: "#d3d3d3", borderRadius: "20px", border: "none" }}>
          History
        </button>
      </div>
    </div>
  )
}

export default OvenCard
