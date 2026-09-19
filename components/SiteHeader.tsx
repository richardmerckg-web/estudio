"use client";

import { useEffect, useState } from "react";

export default function SiteHeader() {
  const [isHeroVisible, setIsHeroVisible] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("top");

    if (!hero || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsHeroVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );

    observer.observe(hero);

    return () => observer.disconnect();
  }, []);

  return (
    <header className={`site-header ${isHeroVisible ? "site-header--hero" : "site-header--solid"}`}>
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="Estudio Fresco home">
          <span className="brand-name">ESTUDIO FRESCO</span>
          <span className="brand-detail">Wind Residences / Tagaytay</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#stay">The stay</a>
          <a href="#rates">Rates</a>
          <a href="#amenities">Amenities</a>
          <a href="#book">Book</a>
        </nav>

        <a className="header-cta" href="#book">
          Book now
        </a>
      </div>
    </header>
  );
}
