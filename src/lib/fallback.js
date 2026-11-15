// Featured NASA images used only when the APOD API returns its generic
// placeholder logo instead of a real photo. All titles, descriptions and
// image URLs come from the NASA Image Library (images.nasa.gov).
export const FALLBACK_IMAGES = [
  {
    title: 'Weighing in on the Dumbbell Nebula',
    explanation: 'The Dumbbell nebula, also known as Messier 27, pumps out infrared light in this image from NASA Spitzer Space Telescope.',
    url: 'https://images-assets.nasa.gov/image/PIA14417/PIA14417~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA14417/PIA14417~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA14417/PIA14417~small.jpg',
    copyright: 'NASA / JPL-Caltech',
  },
  {
    title: 'Ant Nebula',
    explanation: 'This image from NASA Hubble Space Telescope shows the Ant Nebula, a planetary nebula with two lobes that look like the body of an ant.',
    url: 'https://images-assets.nasa.gov/image/PIA04216/PIA04216~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA04216/PIA04216~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA04216/PIA04216~small.jpg',
    copyright: 'NASA / Hubble',
  },
  {
    title: 'Planetary Nebula',
    explanation: 'This planetary nebula has a simple, graceful appearance, thought to be due to perspective: our view from Earth looking straight into what is actually a barrel-shaped cloud.',
    url: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001465/GSFC_20171208_Archive_e001465~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001465/GSFC_20171208_Archive_e001465~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001465/GSFC_20171208_Archive_e001465~small.jpg',
    copyright: 'NASA / Goddard',
  },
  {
    title: 'Mars Rover Opportunity Panorama of Rocheport',
    explanation: 'A ridge called Rocheport on the western rim of Mars Endeavour Crater spans this mosaic of images from the panoramic camera on NASA Mars rover Opportunity.',
    url: 'https://images-assets.nasa.gov/image/PIA21492/PIA21492~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA21492/PIA21492~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA21492/PIA21492~small.jpg',
    copyright: 'NASA / JPL-Caltech',
  },
  {
    title: 'Earth, the Blue Marble',
    explanation: 'One of the more detailed images of Earth yet created, a Blue Marble montage created from data collected by NASA Suomi NPP satellite.',
    url: 'https://images-assets.nasa.gov/image/PIA18033/PIA18033~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA18033/PIA18033~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA18033/PIA18033~small.jpg',
    copyright: 'NASA / Suomi NPP',
  },
  {
    title: 'Martian Valley May Be Curiosity Route',
    explanation: 'This view combines several frames taken by NASA Mars rover Curiosity, looking into a valley to the west from the eastern end of a dune.',
    url: 'https://images-assets.nasa.gov/image/PIA17931/PIA17931~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA17931/PIA17931~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA17931/PIA17931~small.jpg',
    copyright: 'NASA / JPL-Caltech',
  },
  {
    title: 'Great Observatories Unique Views of the Milky Way',
    explanation: 'In celebration of the International Year of Astronomy, NASA Great Observatories, the Hubble, Spitzer and Chandra telescopes, combine their views of the Milky Way.',
    url: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg',
    hdurl: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~orig.jpg',
    altUrl: 'https://images-assets.nasa.gov/image/PIA12348/PIA12348~small.jpg',
    copyright: 'NASA / Hubble, Spitzer, Chandra',
  },
]

export function fallbackForDate(dateStr) {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) % 100000
  }
  const pick = FALLBACK_IMAGES[hash % FALLBACK_IMAGES.length]
  return {
    date: dateStr,
    title: pick.title,
    explanation: pick.explanation,
    url: pick.url,
    hdurl: pick.hdurl,
    altUrl: pick.altUrl,
    media_type: 'image',
    copyright: pick.copyright,
    fallback: true,
    fallbackNote: 'Featured NASA image from the NASA Image Library.',
  }
}

export function isPlaceholderAPOD(data) {
  if (!data) return false
  const url = data.url || data.hdurl || ''
  if (url.includes('nasa-logo')) return true
  if (data.title === 'NASA Science' && (data.explanation || '').startsWith('Discover the cosmos')) return true
  return false
}
