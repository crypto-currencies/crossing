export interface ImageAttribution {
  id: string;
  title: string;
  assetPath: string;
  alt: string;
  creator: string;
  sourceName: string;
  sourceUrl: string;
  originalPostDate: string;
  retrievedAt?: string;
  creditLine: string;
}

export const UNSPLASH_LICENSE = {
  name: "Unsplash License",
  url: "https://unsplash.com/license",
  permissions:
    "Free for commercial and non-commercial use. Permission and attribution are not required.",
  restrictions:
    "Images cannot be sold without significant modification or compiled to reproduce a similar or competing service.",
} as const;

/**
 * Add future image credits here. The attribution page renders this list
 * automatically; shared Unsplash terms live in UNSPLASH_LICENSE above.
 */
export const IMAGE_ATTRIBUTIONS: ImageAttribution[] = [
  {
    id: "sebastien-gabriel-sunset",
    title: "Sea under white clouds at golden hour",
    assetPath: "/crossing-sunset-sebastien-gabriel.jpg",
    alt: "A coral and gold sunset breaking through clouds above the sea",
    creator: "Sebastien Gabriel",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/sea-under-white-clouds-at-golden-hour--IMlv9Jlb24",
    originalPostDate: "August 26, 2017",
    retrievedAt: "July 20, 2026 at 5:00 PM",
    creditLine: "Photo by Sebastien Gabriel on Unsplash",
  },
  {
    id: "michal-parzuchowski-cafe",
    title: "Cafe with pendant lamps and menu boards",
    assetPath: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85",
    alt: "A warmly lit cafe with pendant lamps and menu boards",
    creator: "Michał Parzuchowski",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/photography-of-cafe-with-led-signage-and-pendant-lamps-and-menu-boards-ItaV89TNkks",
    originalPostDate: "July 29, 2017",
    creditLine: "Photo by Michał Parzuchowski on Unsplash",
  },
  {
    id: "kris-atomic-cafe-table",
    title: "Cafe table with French press",
    assetPath: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85",
    alt: "A wooden cafe table set with a French press and teacup",
    creator: "Kris Atomic",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/round-brown-wooden-table-with-french-press-on-top-with-white-ceramic-teacup-beside-3b2tADGAWnU",
    originalPostDate: "October 17, 2015",
    creditLine: "Photo by Kris Atomic on Unsplash",
  },
  {
    id: "clifford-cafe-interior",
    title: "Cafe interior with hanging bulbs and table",
    assetPath: "https://images.unsplash.com/photo-1511081692775-05d0f180a065?auto=format&fit=crop&w=1200&q=85",
    alt: "A cafe interior with hanging bulbs and a long wooden table",
    creator: "Clifford",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/cafe-interior-with-hanging-bulbs-and-table-VobvKmG-StA",
    originalPostDate: "November 19, 2017",
    creditLine: "Photo by Clifford on Unsplash",
  },
  {
    id: "kaur-kristjan-bicycle",
    title: "Black hardtail bicycle by a concrete wall",
    assetPath: "https://images.unsplash.com/photo-1529422643029-d4585747aaf2?auto=format&fit=crop&w=1200&q=85",
    alt: "A black hardtail bicycle leaning against a concrete wall",
    creator: "Kaur Kristjan",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/black-hardtail-bicycle-leaning-on-white-concrete-wall-miUC0b1IVYU",
    originalPostDate: "June 19, 2018",
    creditLine: "Photo by Kaur Kristjan on Unsplash",
  },
  {
    id: "volkan-olmez-motorcycle",
    title: "Motorcycle parked on a forest road",
    assetPath: "https://images.unsplash.com/photo-1502744688674-c619d1586c9e?auto=format&fit=crop&w=1200&q=85",
    alt: "A motorcycle parked on a tree-lined road",
    creator: "Volkan Olmez",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/motorcycle-parks-on-road-between-trees-SvMlXH_eW6o",
    originalPostDate: "August 14, 2017",
    creditLine: "Photo by Volkan Olmez on Unsplash",
  },
  {
    id: "sole-bicycles-road-bike",
    title: "Yellow and black road bike",
    assetPath: "https://images.unsplash.com/photo-1571333250630-f0230c320b6d?auto=format&fit=crop&w=1200&q=85",
    alt: "A yellow and black road bike",
    creator: "Solé Bicycles",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/yellow-and-black-road-bike-JK6lD_y3aDg",
    originalPostDate: "October 17, 2019",
    creditLine: "Photo by Solé Bicycles on Unsplash",
  },
  {
    id: "clay-banks-counter",
    title: "Customer smiling at a shop counter",
    assetPath: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85",
    alt: "A customer smiling while speaking with someone at a shop counter",
    creator: "Clay Banks",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/man-in-grey-crew-neck-t-shirt-smiling-to-woman-on-counter-Ox6SW103KtM",
    originalPostDate: "May 1, 2019",
    creditLine: "Photo by Clay Banks on Unsplash",
  },
  {
    id: "kelly-sikkema-calculator",
    title: "Calculator and financial paperwork",
    assetPath: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1200&q=85",
    alt: "A phone calculator resting on financial paperwork",
    creator: "Kelly Sikkema",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/black-android-smartphone-3-Tc_5LROrM",
    originalPostDate: "April 2, 2019",
    creditLine: "Photo by Kelly Sikkema on Unsplash",
  },
  {
    id: "luke-chesser-analytics",
    title: "Performance analytics on a laptop",
    assetPath: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85",
    alt: "Performance analytics charts displayed on a laptop",
    creator: "Luke Chesser",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/graphs-of-performance-analytics-on-a-laptop-screen-JKUTrJ4vK00",
    originalPostDate: "February 27, 2019",
    creditLine: "Photo by Luke Chesser on Unsplash",
  },
  {
    id: "brooke-lark-breakfast",
    title: "Pasta dish on a brown plate",
    assetPath: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85",
    alt: "A colorful breakfast dish with egg, vegetables, and noodles",
    creator: "Brooke Lark",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/pasta-dish-on-brown-plate-4J059aGa5s4",
    originalPostDate: "January 3, 2018",
    creditLine: "Photo by Brooke Lark on Unsplash",
  },
  {
    id: "emmanuel-ikwuegbu-construction",
    title: "Construction worker in a yellow hard hat",
    assetPath: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=85",
    alt: "A construction worker wearing a yellow hard hat",
    creator: "Emmanuel Ikwuegbu",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/man-in-blue-white-and-red-plaid-button-up-shirt-wearing-yellow-hard-hat-holding-black-zWOgsj3j0wA",
    originalPostDate: "May 25, 2021",
    creditLine: "Photo by Emmanuel Ikwuegbu on Unsplash",
  },
  {
    id: "c-d-x-headphones",
    title: "Wireless headphones",
    assetPath: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85",
    alt: "Black wireless headphones on a pale surface",
    creator: "C D-X",
    sourceName: "Unsplash",
    sourceUrl: "https://unsplash.com/photos/flatlay-photography-of-wireless-headphones-PDX_a_82obo",
    originalPostDate: "September 18, 2017",
    creditLine: "Photo by C D-X on Unsplash",
  },
];
