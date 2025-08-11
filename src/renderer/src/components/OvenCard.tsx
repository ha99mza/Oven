

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
      width: "450px",
      padding: "50px",
      boxShadow: "4px 4px 10px rgba(0,0,0,0.1)",
      backgroundColor: "white",
      textAlign: "center",
      
    }}>
      <h1>{title}</h1>
      <p style={{fontSize: "28px"}}><strong>Status:</strong> {status}</p>
      <p style={{fontSize: "28px"}}>
        <strong>Current Temp :</strong>{" "}
        {temperature ? `${temperature.toFixed(2)} °C` : "—"}
      </p>
      <div style={{ display: "flex", gap: "10px", marginTop: "40px" }}>
        <button onClick={onSelect} style={{ flex: 1,fontSize: "28px",height:"80px", padding: "20px", backgroundColor: "#E7962C", borderRadius: "20px", border: "none" }}>
          Select
        </button>
        <button onClick={onHistory} style={{ flex: 1,fontSize: "28px", padding: "20px", backgroundColor: "#d3d3d3", borderRadius: "20px", border: "none" }}>
          History
        </button>
      </div>
    </div>
  )
}

export default OvenCard
