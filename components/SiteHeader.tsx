"use client";

import { useEffect, useRef, useState } from "react";

export default function SiteHeader() {
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      firstMenuLinkRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = menuPanelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );

      if (!focusableElements?.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.innerWidth > 700 && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleViewportChange);

    return () => window.removeEventListener("resize", handleViewportChange);
  }, [isMenuOpen]);

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <>
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

          <button
            className="menu-toggle"
            type="button"
            ref={menuButtonRef}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          >
            <span className="menu-toggle-line" />
            <span className="menu-toggle-line" />
            <span className="menu-toggle-line" />
          </button>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="mobile-menu-layer">
          <button
            className="mobile-menu-backdrop"
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={closeMobileMenu}
          />
          <aside
            className="mobile-menu"
            id="mobile-menu"
            ref={menuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-menu-title"
          >
            <div className="mobile-menu-header">
              <div>
                <p className="mobile-menu-kicker">Estudio Fresco</p>
                <h2 id="mobile-menu-title">Explore</h2>
              </div>
              <button
                className="mobile-menu-close"
                type="button"
                aria-label="Close menu"
                onClick={closeMobileMenu}
              >
                <span aria-hidden="true">X</span>
              </button>
            </div>

            <nav className="mobile-menu-nav" aria-label="Mobile navigation">
              <a ref={firstMenuLinkRef} href="#stay" onClick={closeMobileMenu}>
                <span>The stay</span>
                <small aria-hidden="true">01</small>
              </a>
              <a href="#rates" onClick={closeMobileMenu}>
                <span>Rates</span>
                <small aria-hidden="true">02</small>
              </a>
              <a href="#amenities" onClick={closeMobileMenu}>
                <span>Amenities</span>
                <small aria-hidden="true">03</small>
              </a>
              <a href="#book" onClick={closeMobileMenu}>
                <span>Book your stay</span>
                <small aria-hidden="true">04</small>
              </a>
            </nav>

            <div className="mobile-menu-footer">
              <p>Wind Residences / Tagaytay</p>
              <a href="#book" onClick={closeMobileMenu}>
                Send an inquiry <span aria-hidden="true">-&gt;</span>
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
