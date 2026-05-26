export default function EnConstruccion({ titulo }: { titulo: string }) {
  return (
    <div style={{
      textAlign: "center",
      marginTop: "60px",
      color: "white"
    }}>
      <img
        src="/construccion.png"
        alt="En desarrollo"
        style={{ width: "160px", opacity: 0.8, marginBottom: "20px" }}
      />
      <h2 style={{ fontSize: "32px", marginBottom: "10px" }}>{titulo}</h2>
      <p style={{ color: "#aaa", fontSize: "18px" }}>
        Esta sección está en desarrollo
      </p>
    </div>
  )
}
