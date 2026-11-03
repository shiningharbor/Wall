import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <div className="home-card">
        <div className="home-mark">ROCHE ONCOLOGY</div>
        <h1>Photo Wall</h1>
        <p>Elige la pantalla que vas a utilizar.</p>
        <div className="home-links">
          <Link href="/camera">Abrir cámara de tablet</Link>
          <Link href="/wall">Abrir muro de fotografías</Link>
        </div>
        <small>Para pantalla vertical 100 × 350 cm utiliza /wall.</small>
      </div>
    </main>
  );
}
