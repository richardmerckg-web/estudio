import { siteConfig } from "@/app/site-config";

const lodgingId = `${siteConfig.url}/#lodging-business`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      url: siteConfig.url,
      name: siteConfig.name,
      description: siteConfig.description,
      inLanguage: "en-PH",
    },
    {
      "@type": "LodgingBusiness",
      "@id": lodgingId,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      image: siteConfig.galleryImageUrls,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Tagaytay",
        addressRegion: "Cavite",
        addressCountry: "PH",
      },
      areaServed: {
        "@type": "City",
        name: "Tagaytay",
      },
      numberOfRooms: 1,
      checkinTime: "14:00:00+08:00",
      checkoutTime: "12:00:00+08:00",
      priceRange: "₱1,800–₱2,300",
      currenciesAccepted: "PHP",
      containsPlace: {
        "@type": "Accommodation",
        name: "One-bedroom stay at Estudio Fresco",
        numberOfBedrooms: 1,
        occupancy: {
          "@type": "QuantitativeValue",
          value: 4,
        },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "wifi", value: true },
          { "@type": "LocationFeatureSpecification", name: "balcony", value: true },
          { "@type": "LocationFeatureSpecification", name: "kitchen", value: true },
          { "@type": "LocationFeatureSpecification", name: "tv", value: true },
          { "@type": "LocationFeatureSpecification", name: "pool", value: true },
        ],
      },
    },
    {
      "@type": "WebPage",
      "@id": `${siteConfig.url}/#webpage`,
      url: siteConfig.url,
      name: siteConfig.title,
      description: siteConfig.description,
      isPartOf: { "@id": `${siteConfig.url}/#website` },
      about: { "@id": lodgingId },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: siteConfig.socialImage,
      },
      inLanguage: "en-PH",
    },
  ],
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
