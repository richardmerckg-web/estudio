const siteUrl = "https://www.estudiofrescowindresidence.com";

export const siteConfig = {
  name: "Estudio Fresco",
  url: siteUrl,
  title: "Estudio Fresco | Tagaytay Stay at Wind Residences",
  description:
    "Book Estudio Fresco, a one-bedroom stay at Wind Residences Tagaytay with a balcony, kitchen, Wi-Fi, Netflix, PS4, and space for up to four guests.",
  locale: "en_PH",
  socialImage: `${siteUrl}/images/4.jpg`,
  socialImageAlt: "Living area and kitchen at Estudio Fresco in Wind Residences Tagaytay",
  galleryImageUrls: Array.from(
    { length: 25 },
    (_, index) => `${siteUrl}/images/${index + 1}.jpg`,
  ),
} as const;
