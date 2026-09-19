"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type GalleryImage = {
  image: string;
  alt: string;
  className?: string;
};

export default function ImageGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        lastFocusedTriggerRef.current?.focus();
        setActiveIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((currentIndex) =>
          currentIndex === null
            ? currentIndex
            : (currentIndex - 1 + images.length) % images.length,
        );
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((currentIndex) =>
          currentIndex === null ? currentIndex : (currentIndex + 1) % images.length,
        );
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, images.length]);

  const activeImage = activeIndex === null ? null : images[activeIndex];

  const closeViewer = () => {
    lastFocusedTriggerRef.current?.focus();
    setActiveIndex(null);
  };

  const showPrevious = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === null
        ? currentIndex
        : (currentIndex - 1 + images.length) % images.length,
    );
  };

  const showNext = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === null ? currentIndex : (currentIndex + 1) % images.length,
    );
  };

  return (
    <>
      <div className="photo-grid">
        {images.map((item, index) => (
          <div
            className={`photo-tile image-frame ${item.className ?? ""}`}
            key={item.image}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <button
              className="photo-trigger"
              type="button"
              aria-label={`View ${item.alt}`}
              onClick={(event) => {
                lastFocusedTriggerRef.current = event.currentTarget;
                setActiveIndex(index);
              }}
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                sizes="(max-width: 700px) 100vw, 50vw"
              />
              <span className="photo-tile-action" aria-hidden="true">
                View image <span>+</span>
              </span>
            </button>
            <p className="image-credit">Estudio Fresco / Wind Residences</p>
          </div>
        ))}
      </div>

      {activeImage && activeIndex !== null ? (
        <div
          className="lightbox-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeViewer();
            }
          }}
        >
          <div className="lightbox-panel">
            <div className="lightbox-toolbar">
              <p id="lightbox-title">Estudio Fresco / {activeIndex + 1} of {images.length}</p>
              <button
                className="lightbox-control lightbox-close"
                type="button"
                ref={closeButtonRef}
                aria-label="Close image viewer"
                onClick={closeViewer}
              >
                <span aria-hidden="true">X</span>
              </button>
            </div>

            <div className="lightbox-image-frame">
              <Image
                src={activeImage.image}
                alt={activeImage.alt}
                fill
                sizes="(max-width: 700px) 92vw, 1100px"
                priority
              />
            </div>

            <div className="lightbox-footer">
              <p>{activeImage.alt}</p>
              <div className="lightbox-navigation">
                <button className="lightbox-control" type="button" onClick={showPrevious}>
                  <span aria-hidden="true">&lt;</span> Previous
                </button>
                <button className="lightbox-control" type="button" onClick={showNext}>
                  Next <span aria-hidden="true">&gt;</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
