import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import ImageGallery from "@/components/ImageGallery";

const inclusions = [
  {
    number: "01",
    title: "Bedroom with balcony",
    description: "A private room with a little space to take in the Tagaytay air.",
  },
  {
    number: "02",
    title: "Kitchen",
    description: "A practical kitchen for easy breakfasts and unhurried meals.",
  },
  {
    number: "03",
    title: "Toilet and bath",
    description: "Everything you need for a comfortable stay.",
  },
  {
    number: "04",
    title: "Wi-Fi, Netflix and Xbox",
    description: "Stay connected, switch off, or make the evening your own.",
  },
];

const amenityGroups = [
  {
    title: "Inside the residence",
    note: "For an easy stay",
    items: [
      "Air-conditioning unit",
      "Induction cooker",
      "Coffee maker",
      "Microwave",
      "Rice cooker",
      "Electric kettle",
      "Refrigerator",
      "Complete utensils",
    ],
  },
  {
    title: "For relaxing in",
    note: "Comforts for slow evenings",
    items: [
      "Wi-Fi",
      "Smart TV with Netflix",
      "Xbox",
      "Game console",
      "Sofa bed",
      "Karaoke",
      "Board and card games",
    ],
  },
  {
    title: "Condo amenities",
    note: "Additional fees may apply",
    items: [
      "Indoor and outdoor pools / 8 AM–10 PM",
      "Basketball court",
      "Tennis court",
      "Billiards, badminton, and dart boards",
      "Kids playground",
      "Garden for picnic",
    ],
  },
  {
    title: "House rules",
    note: "Please keep in mind",
    items: [
      "Maximum of 4 guests",
      "No smoking inside the unit",
      "No pets unless agreed in writing",
      "No parties or loud noise",
      "Follow all building and condo association rules",
    ],
  },
];

const galleryImages = [
  {
    image: "/images/4.webp",
    alt: "Living area and kitchen at Estudio Fresco",
    className: "photo-tile--large",
  },
  {
    image: "/images/6.webp",
    alt: "Bedroom with desk and wardrobe at Estudio Fresco",
    className: "photo-tile--small",
  },
  {
    image: "/images/13.webp",
    alt: "Bedroom with decorative wall art at Estudio Fresco",
    className: "photo-tile--small",
  },
  { image: "/images/1.webp", alt: "Bedroom workspace and television at Estudio Fresco" },
  { image: "/images/2.webp", alt: "Sofa bed and seating area at Estudio Fresco" },
  { image: "/images/5.webp", alt: "Kitchen at Estudio Fresco" },
  { image: "/images/7.webp", alt: "Coffee and cooking area at Estudio Fresco" },
  { image: "/images/9.webp", alt: "Coffee maker and rice cooker at Estudio Fresco" },
  { image: "/images/8.webp", alt: "Toilet and bath at Estudio Fresco" },
  { image: "/images/3.webp", alt: "Night view from the residence balcony" },
  { image: "/images/10.webp", alt: "Shared Wind Residences lounge" },
  { image: "/images/11.webp", alt: "Shared lounge with fireplace at Wind Residences" },
  { image: "/images/12.webp", alt: "Stone fireplace and seating area at Wind Residences" },
  { image: "/images/14.webp", alt: "Shared lounge seating at Wind Residences" },
  { image: "/images/15.webp", alt: "Outdoor tennis court at Wind Residences" },
  { image: "/images/16.webp", alt: "Outdoor basketball court at Wind Residences" },
  { image: "/images/17.webp", alt: "Indoor badminton courts at Wind Residences" },
  {
    image: "/images/18.webp",
    alt: "Table tennis table inside the recreation hall at Wind Residences",
  },
  { image: "/images/19.webp", alt: "Billiards table inside the recreation hall at Wind Residences" },
  { image: "/images/20.webp", alt: "Dartboards and billiards area at Wind Residences" },
  { image: "/images/21.webp", alt: "Dartboards inside the recreation hall at Wind Residences" },
  { image: "/images/22.webp", alt: "View of Taal Volcano and Taal Lake from Tagaytay" },
  { image: "/images/23.webp", alt: "Wind Residences swimming pools and towers at night" },
  { image: "/images/24.webp", alt: "Night view of the swimming pools and Wind Residences buildings" },
  { image: "/images/25.webp", alt: "Lit swimming pool with Wind Residences towers at night" },
];

export default function Home() {
  return (
    <main className="site-shell">
      <SiteHeader />

      <section className="hero" id="top" aria-labelledby="hero-heading">
        <div className="hero-background" aria-hidden="true">
          <Image
            src="/images/4.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-copy">
          <p className="eyebrow">Estudio Fresco / Wind Residences</p>
          <h1 id="hero-heading">
            A fresh stay in <em>Tagaytay.</em>
          </h1>
          <p className="hero-intro">
            A comfortable one-bedroom stay with a balcony, kitchen, and the small
            comforts that make a weekend away feel easy.
          </p>
          <div className="hero-meta">
            <span>Check-in / 2:00 PM</span>
            <span>Check-out / 12:00 NN Philippine time</span>
          </div>
          <div className="hero-actions">
            <a className="button button--dark" href="#book">
              Book Now
            </a>
            <a className="text-link" href="#rates">
              View rates
            </a>
          </div>
        </div>
        <p className="image-credit hero-credit">Estudio Fresco / Wind Residences</p>
      </section>

      <div className="word-strip" aria-label="Estudio Fresco stay details">
        <div className="word-strip-inner">
          <span>TAGAYTAY</span>
          <span>BEDROOM + BALCONY</span>
          <span>KITCHEN</span>
          <span>POOL ACCESS</span>
          <span>WI-FI</span>
          <span>NETFLIX</span>
        </div>
      </div>

      <section className="statement-band" id="stay" aria-labelledby="statement-heading">
        <div className="statement-inner">
          <div>
            <p className="eyebrow eyebrow--light">The stay</p>
            <h2 id="statement-heading">
              A little more room to <em>slow down.</em>
            </h2>
          </div>
          <div className="statement-copy">
            <p>
              Estudio Fresco at Wind Residences Tagaytay is a one-bedroom stay for
              up to four guests in total. Come for a change of air, a slower
              morning, and an easy place to settle in.
            </p>
            <div className="statement-facts">
              <span>Weekdays ₱1,800</span>
              <span>Weekends ₱2,300</span>
              <span>Up to 4 guests</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section rates-section" id="rates" aria-labelledby="rates-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rates and details</p>
            <h2 id="rates-heading">
              Simple rates. <em>Easy plans.</em>
            </h2>
          </div>
          <p className="section-note">
            Weekday and weekend rates are good for up to four guests.
          </p>
        </div>

        <div className="rate-layout">
          <div className="rate-list">
            <div className="rate-row">
              <div className="rate-copy">
                <span className="rate-label">Weekdays</span>
                <span className="rate-description">Good for up to 4 guests</span>
              </div>
              <strong>₱1,800</strong>
            </div>
            <div className="rate-row">
              <div className="rate-copy">
                <span className="rate-label">Weekends</span>
                <span className="rate-description">Good for up to 4 guests</span>
              </div>
              <strong>₱2,300</strong>
            </div>
            <div className="rate-row">
              <div className="rate-copy">
                <span className="rate-label">Maximum capacity</span>
                <span className="rate-description">For the whole residence</span>
              </div>
              <strong>4 guests</strong>
            </div>
          </div>

          <div className="booking-panel" id="booking-details">
            <p className="eyebrow">Stay times</p>
            <div className="booking-line">
              <span>Check-in</span>
              <strong>2:00 PM</strong>
            </div>
            <div className="booking-line">
              <span>Check-out</span>
              <strong>12:00 NN Philippine time</strong>
            </div>
            <a className="button button--dark" href="#book">
              Message to reserve
            </a>
          </div>
        </div>
      </section>

      <section className="split-section" id="included" aria-labelledby="included-heading">
        <div className="image-frame split-media">
          <Image
            src="/images/5.webp"
            alt="Kitchen at Estudio Fresco with cooking equipment and counter space"
            fill
            sizes="(max-width: 820px) 100vw, 50vw"
          />
          <p className="image-credit">Estudio Fresco / Wind Residences</p>
        </div>
        <div className="split-copy">
          <p className="eyebrow">What is included</p>
          <h2 id="included-heading">
            Everything you need to <em>settle in.</em>
          </h2>
          <p className="body-copy">
            Bring the people you love, make the place your own for a while, and
            enjoy the comforts waiting for you at Wind Residences.
          </p>

          <div className="principles-list">
            {inclusions.map((inclusion) => (
              <div className="principle-row" key={inclusion.number}>
                <span className="principle-number">{inclusion.number}</span>
                <div>
                  <h3>{inclusion.title}</h3>
                  <p>{inclusion.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="amenities-section" id="amenities" aria-labelledby="amenities-heading">
        <div className="section amenities-inner">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Condo amenities</p>
              <h2 id="amenities-heading">
                Settle in. Stay a <em>while.</em>
              </h2>
            </div>
            <p className="section-note">
              A fuller list of the comforts and shared facilities available at the
              residence. Additional fees may apply to some condo amenities.
            </p>
          </div>

          <div className="amenities-grid">
            {amenityGroups.map((group) => (
              <div className="amenity-group" key={group.title}>
                <div className="amenity-group-heading">
                  <h3>{group.title}</h3>
                  <span>{group.note}</span>
                </div>
                <div className="amenity-list">
                  {group.items.map((item, itemIndex) => (
                    <div className="amenity-row" key={item}>
                      <span className="amenity-number">
                        {String(itemIndex + 1).padStart(2, "0")}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="process-section" aria-labelledby="pool-heading">
        <div className="section process-inner">
          <div className="section-heading section-heading--process">
            <div>
              <p className="eyebrow">Good to know</p>
              <h2 id="pool-heading">
                Make space for a longer <em>weekend.</em>
              </h2>
            </div>
            <p className="section-note">
              Swimming pool access is available from 8:00 AM to 10:00 PM. Pool
              access rates vary by day.
            </p>
          </div>

          <div className="process-grid">
            <div className="process-item">
              <span>01</span>
              <h3>Pool access</h3>
              <p>8:00 AM–10:00 PM</p>
            </div>
            <div className="process-item">
              <span>02</span>
              <h3>Regular days</h3>
              <p>₱150 per head</p>
            </div>
            <div className="process-item">
              <span>03</span>
              <h3>Holidays</h3>
              <p>₱300 per head</p>
            </div>
            <div className="process-item">
              <span>04</span>
              <h3>Reservations</h3>
              <p>Send us a message for inquiries and booking.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section photo-section" aria-labelledby="photo-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inside the stay</p>
            <h2 id="photo-heading">
              See yourself <em>here.</em>
            </h2>
          </div>
          <p className="section-note">
            A visual tour of the residence, including the bedroom, kitchen, bath,
            balcony view, and shared Wind Residences spaces. Tap any image to view
            it full size.
          </p>
        </div>

        <ImageGallery images={galleryImages} />
      </section>

      <section className="property-note-section" aria-labelledby="property-note-heading">
        <div className="testimonial-inner">
          <p className="eyebrow eyebrow--light">Estudio Fresco at Wind Residences</p>
          <h2 id="property-note-heading">
            Come for the air. Stay for the <em>ease.</em>
          </h2>
          <p className="property-note-copy">
            A single Airbnb stay in Tagaytay, made for a quiet reset, a shared
            weekend, or a little time away from the usual rhythm.
          </p>
          <p className="testimonial-count">One residence / Tagaytay</p>
        </div>
      </section>

      <section className="contact-section booking-section" id="book" aria-labelledby="booking-heading">
        <div className="contact-inner booking-inner">
          <div className="booking-intro">
            <p className="eyebrow eyebrow--light">Book your stay</p>
            <h2 id="booking-heading">
              Make your next stay feel <em>fresh.</em>
            </h2>
            <p className="contact-intro">
              Send us your preferred dates and guest details for availability and
              reservation information.
            </p>
            <div className="booking-summary">
              <span>Weekdays / ₱1,800</span>
              <span>Weekends / ₱2,300</span>
              <span>Up to 4 guests</span>
            </div>
          </div>

          <form className="booking-form" id="booking-form" action="#book" method="get">
            <div className="booking-form-grid">
              <div className="form-field">
                <label htmlFor="guest-name">Full name</label>
                <input id="guest-name" name="name" type="text" autoComplete="name" required />
              </div>
              <div className="form-field">
                <label htmlFor="guest-email">Email address</label>
                <input id="guest-email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="form-field">
                <label htmlFor="preferred-dates">Preferred dates</label>
                <input
                  id="preferred-dates"
                  name="dates"
                  type="text"
                  placeholder="e.g. 12–14 July 2026"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="guest-count">Number of guests</label>
                <select id="guest-count" name="guests" defaultValue="4" required>
                  <option value="1">1 guest</option>
                  <option value="2">2 guests</option>
                  <option value="3">3 guests</option>
                  <option value="4">4 guests</option>
                </select>
              </div>
              <div className="form-field form-field--full">
                <label htmlFor="booking-message">Message</label>
                <textarea
                  id="booking-message"
                  name="message"
                  rows={4}
                  placeholder="Tell us anything we should know about your stay."
                />
              </div>
            </div>
            <button className="button button--dark" type="submit">
              Send booking request
            </button>
            <p className="form-note">We will reply with availability and next steps.</p>
          </form>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <p className="footer-brand">ESTUDIO FRESCO</p>
            <p className="footer-note">A fresh stay in Tagaytay.</p>
          </div>
          <div className="footer-links">
            <a href="#stay">The stay</a>
            <a href="#rates">Rates</a>
            <a href="#amenities">Amenities</a>
            <a href="#book">Book</a>
          </div>
          <div className="footer-legal">
            <span>Property photography supplied by Estudio Fresco.</span>
            <span>© 2026 ESTUDIO FRESCO</span>
          </div>
        </div>
      </footer>

      <a
        className="floating-action airbnb-button"
        href="https://www.airbnb.com/h/merckgildo"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Book Estudio Fresco on Airbnb"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.4"
            d="M16 4.25c-2.07 0-3.38 1.89-4.52 4.03L5.62 20c-.85 1.58-.46 3.54.94 4.67 1.77 1.44 4.43.95 5.57-1.05L16 17.1l3.87 6.52c1.14 2 3.8 2.49 5.57 1.05 1.4-1.13 1.79-3.09.94-4.67L20.52 8.28C19.38 6.14 18.07 4.25 16 4.25Z"
          />
          <circle cx="16" cy="14.7" r="1.7" fill="currentColor" />
        </svg>
      </a>

      <a
        className="floating-action messenger-button"
        href="https://www.messenger.com/t/1038638419343903"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Message us about your stay"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M16 3C8.27 3 2 8.53 2 15.35c0 3.88 1.97 7.38 5.06 9.7v4.04l4.64-2.55c1.37.38 2.81.58 4.3.58 7.73 0 14-5.53 14-12.35S23.73 3 16 3Z"
          />
          <path
            fill="#0084ff"
            d="m7.6 19.05 6.15-6.55 3.02 2.72 5.98-3.25-6.2 6.6-2.98-2.67-5.97 3.15Z"
          />
        </svg>
      </a>
    </main>
  );
}
