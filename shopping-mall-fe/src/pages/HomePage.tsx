import { Link } from "react-router-dom";
import { SolarHorizon } from "../components/SolarHorizon";
import "./home.css";

export function HomePage() {
  return (
    <main className="portal-page" id="top">
      <div className="portal-art" />
      <div className="portal-grade" />
      <SolarHorizon />
      <div className="portal-shade" />
      <header className="portal-header">
        <Link className="portal-brand" to="/" aria-label="NEXORA home">
          NEXORA
        </Link>
        <span>Two worlds / one horizon</span>
      </header>
      <section className="portal-world portal-merchant" aria-labelledby="merchant-title">
        <p className="portal-eyebrow">MERCHANT WORLD</p>
        <h1 id="merchant-title">CREATE</h1>
        <p>Build your own corner of the city</p>
        <Link className="portal-cta" to="/login?role=ROLE_MERCHANT">
          Enter merchant world <span>↗</span>
        </Link>
      </section>
      <section className="portal-world portal-buyer" aria-labelledby="buyer-title">
        <p className="portal-eyebrow">BUYER WORLD</p>
        <h1 id="buyer-title">EXPLORE</h1>
        <p>Find something that feels like you</p>
        <Link className="portal-cta" to="/login?role=ROLE_USER">
          Enter the city <span>↗</span>
        </Link>
      </section>
      <footer className="portal-footer">
        <span>NEXORA · A MARKETPLACE BETWEEN WORLDS</span>
      </footer>
    </main>
  );
}
