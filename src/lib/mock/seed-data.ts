// Original, fictional catalog used to seed Aurora's database in development.
// No real-world titles, people, or copyrighted metadata are used here —
// everything below is invented for demo purposes.

export const GENRES = [
  "Sci-Fi",
  "Drama",
  "Thriller",
  "Comedy",
  "Horror",
  "Romance",
  "Fantasy",
  "Action",
  "Documentary",
  "Animation",
  "Mystery",
  "Crime",
  "Adventure",
  "Electronic",
  "Alternative",
  "Indie Rock",
  "Hip-Hop",
  "Jazz",
  "Ambient",
  "Folk",
  "R&B",
] as const;

export const MOODS = [
  "Melancholic",
  "Atmospheric",
  "Energetic",
  "Uplifting",
  "Dark",
  "Whimsical",
  "Intense",
  "Calm",
  "Nostalgic",
  "Euphoric",
  "Tense",
  "Dreamy",
] as const;

function img(seed: string, w: number, h: number) {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

export interface SeedMovie {
  slug: string;
  title: string;
  tagline: string;
  overview: string;
  releaseYear: number;
  runtimeMin: number;
  director: string;
  cast: string[];
  genres: string[];
  moods: string[];
  popularity: number;
  communityRating: number;
  ratingCount: number;
  /** Real artwork from a live provider — falls back to generated placeholder art when absent. */
  posterUrl?: string;
  backdropUrl?: string;
}

export const MOVIES: SeedMovie[] = [
  {
    slug: "the-long-orbit",
    title: "The Long Orbit",
    tagline: "Some distances can't be measured in miles.",
    overview:
      "A communications engineer aboard a generation ship must decide whether to reveal a course error that would strand the crew in deep space for another forty years.",
    releaseYear: 2027,
    runtimeMin: 142,
    director: "Marisol Adeyemi",
    cast: ["Dev Whitfield", "Lior Amsalem", "Grace Okonkwo"],
    genres: ["Sci-Fi", "Drama"],
    moods: ["Melancholic", "Atmospheric"],
    popularity: 92,
    communityRating: 4.4,
    ratingCount: 18240,
  },
  {
    slug: "glass-houses",
    title: "Glass Houses",
    tagline: "Everyone can see in. No one can get out.",
    overview:
      "Six estranged siblings return to their late father's experimental glass compound to settle his will, only to find the house itself keeping secrets.",
    releaseYear: 2026,
    runtimeMin: 108,
    director: "Petra Vance",
    cast: ["Odalys Reyes", "Tomas Lindqvist", "Beatrix Farrow"],
    genres: ["Thriller", "Mystery"],
    moods: ["Tense", "Dark"],
    popularity: 87,
    communityRating: 4.1,
    ratingCount: 12980,
  },
  {
    slug: "paper-tigers",
    title: "Paper Tigers",
    tagline: "It's not a comeback if you never left the couch.",
    overview:
      "A washed-up amateur chess club in a shrinking mill town enters a national tournament, mostly to annoy the mayor who wants to bulldoze their clubhouse.",
    releaseYear: 2025,
    runtimeMin: 101,
    director: "Nate Bergstrom",
    cast: ["Wren Castillo", "Abdi Farah", "June Okafor"],
    genres: ["Comedy", "Drama"],
    moods: ["Uplifting", "Whimsical"],
    popularity: 74,
    communityRating: 4.2,
    ratingCount: 8410,
  },
  {
    slug: "hollow-tide",
    title: "Hollow Tide",
    tagline: "The sea remembers what you did.",
    overview:
      "A marine biologist returns to her childhood fishing village to investigate a mass stranding, and finds the town's oldest stories are less myth than warning.",
    releaseYear: 2026,
    runtimeMin: 116,
    director: "Astrid Kallio",
    cast: ["Naomi Presley", "Callum Doyle", "Marguerite Ohene"],
    genres: ["Horror", "Mystery"],
    moods: ["Dark", "Atmospheric"],
    popularity: 81,
    communityRating: 4.0,
    ratingCount: 9765,
  },
  {
    slug: "the-cartographers-daughter",
    title: "The Cartographer's Daughter",
    tagline: "Some maps lead you home. Some lead you away.",
    overview:
      "In a kingdom where maps redraw themselves overnight, a mapmaker's apprentice discovers she can read the one thing the land refuses to show: the future.",
    releaseYear: 2025,
    runtimeMin: 124,
    director: "Idris Vance",
    cast: ["Sable Whitmore", "Kian Osei", "Delphine Auclair"],
    genres: ["Fantasy", "Adventure"],
    moods: ["Dreamy", "Uplifting"],
    popularity: 88,
    communityRating: 4.5,
    ratingCount: 21430,
  },
  {
    slug: "redline",
    title: "Redline",
    tagline: "One route. No backup.",
    overview:
      "A former courier for a defunct cartel is pulled back in for one last run across a border that's closing in six hours, with cargo she was never told about.",
    releaseYear: 2027,
    runtimeMin: 98,
    director: "Marcus Iwu",
    cast: ["Renata Solis", "Booker Vance", "Ilya Petrenko"],
    genres: ["Action", "Thriller"],
    moods: ["Intense", "Energetic"],
    popularity: 90,
    communityRating: 4.0,
    ratingCount: 15600,
  },
  {
    slug: "the-quiet-year",
    title: "The Quiet Year",
    tagline: "A year of small, enormous things.",
    overview:
      "After a diagnosis reshuffles her priorities, a symphony conductor spends a year teaching music in the rural town she grew up trying to leave.",
    releaseYear: 2024,
    runtimeMin: 119,
    director: "Helena Brandt",
    cast: ["Farah Al-Sayed", "Otto Lindgren", "Priya Chandrasekhar"],
    genres: ["Drama", "Romance"],
    moods: ["Melancholic", "Uplifting"],
    popularity: 79,
    communityRating: 4.6,
    ratingCount: 19870,
  },
  {
    slug: "static-bloom",
    title: "Static Bloom",
    tagline: "Grow something the signal can't reach.",
    overview:
      "In a city where every wall is a screen, an underground florist builds a garden that blocks the ambient broadcast — and becomes an accidental symbol of resistance.",
    releaseYear: 2026,
    runtimeMin: 110,
    director: "Junko Ezra",
    cast: ["Milo Andrade", "Sunniva Berg", "Tomiwa Balogun"],
    genres: ["Sci-Fi", "Drama"],
    moods: ["Atmospheric", "Dreamy"],
    popularity: 83,
    communityRating: 4.3,
    ratingCount: 11290,
  },
  {
    slug: "the-understudy",
    title: "The Understudy",
    tagline: "Everyone deserves one night in the spotlight.",
    overview:
      "A stagehand who has memorized every role in a dying regional theater's repertoire finally gets her shot when the lead vanishes hours before opening night.",
    releaseYear: 2025,
    runtimeMin: 104,
    director: "Colm Fitzgerald",
    cast: ["Anaïs Moreau", "Femi Adegoke", "Ruth Halvorsen"],
    genres: ["Drama", "Comedy"],
    moods: ["Uplifting", "Nostalgic"],
    popularity: 71,
    communityRating: 4.3,
    ratingCount: 7320,
  },
  {
    slug: "black-ice",
    title: "Black Ice",
    tagline: "The road doesn't forgive.",
    overview:
      "Stranded state troopers in a blacked-out mountain pass discover the pileup they're investigating isn't an accident, and the storm isn't letting anyone leave.",
    releaseYear: 2027,
    runtimeMin: 112,
    director: "Greta Sundqvist",
    cast: ["Warrick Osei", "Ines Cabrera", "Toby Lindeman"],
    genres: ["Thriller", "Crime"],
    moods: ["Tense", "Dark"],
    popularity: 85,
    communityRating: 3.9,
    ratingCount: 10440,
  },
  {
    slug: "the-orchard-keepers",
    title: "The Orchard Keepers",
    tagline: "Roots run deeper than blood.",
    overview:
      "Three generations of a family collide over the future of a failing orchard, unearthing a decades-old promise none of them knew they were bound to keep.",
    releaseYear: 2023,
    runtimeMin: 121,
    director: "Solveig Tamm",
    cast: ["Desmond Okafor", "Liesl Van Der Berg", "Amos Feldman"],
    genres: ["Drama"],
    moods: ["Melancholic", "Calm"],
    popularity: 68,
    communityRating: 4.4,
    ratingCount: 6890,
  },
  {
    slug: "nightjar",
    title: "Nightjar",
    tagline: "It only sings when something's wrong.",
    overview:
      "A wildlife recordist working alone in a national park starts hearing a birdsong in her recordings that no living species makes — and it's getting louder.",
    releaseYear: 2026,
    runtimeMin: 99,
    director: "Ravi Deshmukh",
    cast: ["Elowen Pryce", "Sacha Duval", "Nkem Chukwu"],
    genres: ["Horror", "Sci-Fi"],
    moods: ["Dark", "Tense"],
    popularity: 77,
    communityRating: 3.8,
    ratingCount: 5230,
  },
  {
    slug: "confetti",
    title: "Confetti",
    tagline: "The party's over. The mess is just starting.",
    overview:
      "A wedding planner's meticulously scheduled weekend unravels in real time when the bride, the caterer, and the mayor all quit within the same hour.",
    releaseYear: 2025,
    runtimeMin: 96,
    director: "Bianca Ferro",
    cast: ["Josefina Roth", "Elliot Nakamura", "Ada Osei"],
    genres: ["Comedy"],
    moods: ["Energetic", "Whimsical"],
    popularity: 66,
    communityRating: 3.9,
    ratingCount: 4120,
  },
  {
    slug: "the-last-signal",
    title: "The Last Signal",
    tagline: "Someone is still listening.",
    overview:
      "Decades after Earth goes silent, the last crewed relay station receives a transmission that shouldn't be possible — and a countdown that definitely isn't.",
    releaseYear: 2024,
    runtimeMin: 131,
    director: "Marisol Adeyemi",
    cast: ["Dev Whitfield", "Priya Chandrasekhar", "Kian Osei"],
    genres: ["Sci-Fi", "Thriller"],
    moods: ["Tense", "Atmospheric"],
    popularity: 94,
    communityRating: 4.7,
    ratingCount: 27650,
  },
];

export interface SeedEpisode {
  season: number;
  episodeNumber: number;
  title: string;
  overview: string;
  runtimeMin: number;
  communityRating: number;
  ratingCount: number;
  stillUrl?: string;
}

export interface SeedShow {
  slug: string;
  title: string;
  tagline: string;
  overview: string;
  firstAirYear: number;
  seasonCount: number;
  creator: string;
  cast: string[];
  genres: string[];
  moods: string[];
  popularity: number;
  communityRating: number;
  ratingCount: number;
  episodes: SeedEpisode[];
  posterUrl?: string;
  backdropUrl?: string;
}

export const SHOWS: SeedShow[] = [
  {
    slug: "the-relay",
    title: "The Relay",
    tagline: "Every message has a cost.",
    overview:
      "A skeleton crew on a deep-space relay station races to keep a century-old communication network alive while hiding what really happened to the last crew.",
    firstAirYear: 2025,
    seasonCount: 2,
    creator: "Wendell Achebe",
    cast: ["Saoirse Lund", "Emeka Obi", "Frida Halvorsen"],
    genres: ["Sci-Fi", "Drama", "Mystery"],
    moods: ["Atmospheric", "Tense"],
    popularity: 91,
    communityRating: 4.5,
    ratingCount: 33200,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "Dead Air",
        overview: "A garbled transmission from a decommissioned station forces the crew to break protocol.",
        runtimeMin: 52,
        communityRating: 4.6,
        ratingCount: 4200,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "Handshake",
        overview: "The crew makes first contact with a signal that keeps rewriting itself.",
        runtimeMin: 49,
        communityRating: 4.4,
        ratingCount: 3800,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Quiet Hours",
        overview: "A ship-wide blackout reveals who has been lying about the mission's real purpose.",
        runtimeMin: 55,
        communityRating: 4.7,
        ratingCount: 4100,
      },
    ],
  },
  {
    slug: "kitchen-table",
    title: "Kitchen Table",
    tagline: "Everything gets decided over dinner.",
    overview:
      "A sprawling immigrant family runs a beloved neighborhood diner, and every episode unfolds almost entirely around their kitchen table between service rushes.",
    firstAirYear: 2023,
    seasonCount: 3,
    creator: "Rosa Iglesias",
    cast: ["Dario Iglesias", "Tanvi Rao", "Sefa Boateng"],
    genres: ["Comedy", "Drama"],
    moods: ["Uplifting", "Nostalgic"],
    popularity: 82,
    communityRating: 4.6,
    ratingCount: 28900,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "Soft Opening",
        overview: "The family scrambles to cover for their sick head chef during a health inspector visit.",
        runtimeMin: 27,
        communityRating: 4.5,
        ratingCount: 3100,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "The Regulars",
        overview: "A beloved regular's absence sends the youngest daughter on a citywide search.",
        runtimeMin: 26,
        communityRating: 4.5,
        ratingCount: 2900,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Rent Week",
        overview: "The family debates whether to finally raise prices after eleven years.",
        runtimeMin: 28,
        communityRating: 4.7,
        ratingCount: 3300,
      },
    ],
  },
  {
    slug: "the-fold",
    title: "The Fold",
    tagline: "Reality has a seam. Someone found it.",
    overview:
      "A detective investigating a string of impossible disappearances discovers a literal fold in the city where two neighborhoods occupy the same space, decades apart.",
    firstAirYear: 2026,
    seasonCount: 1,
    creator: "Idris Vance",
    cast: ["Odalys Reyes", "Booker Vance", "Sunniva Berg"],
    genres: ["Mystery", "Sci-Fi", "Crime"],
    moods: ["Dark", "Tense"],
    popularity: 89,
    communityRating: 4.4,
    ratingCount: 19200,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "Missing Time",
        overview: "A missing-persons case leads to an address that hasn't existed since 1987.",
        runtimeMin: 48,
        communityRating: 4.5,
        ratingCount: 2600,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "Seam",
        overview: "The detective finds a physical crossing point and everything she knows starts to bend.",
        runtimeMin: 51,
        communityRating: 4.6,
        ratingCount: 2500,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Both Sides",
        overview: "A version of the detective from the other side of the fold starts leaving her messages.",
        runtimeMin: 50,
        communityRating: 4.7,
        ratingCount: 2700,
      },
    ],
  },
  {
    slug: "greenhouse",
    title: "Greenhouse",
    tagline: "Grow it, or go home.",
    overview:
      "Eight strangers compete to keep an off-grid vertical farm profitable for one year; whoever's section produces the least gets voted out of the greenhouse.",
    firstAirYear: 2024,
    seasonCount: 4,
    creator: "Bianca Ferro",
    cast: ["Nkem Chukwu", "Toby Lindeman", "Ada Osei"],
    genres: ["Documentary"],
    moods: ["Energetic", "Uplifting"],
    popularity: 63,
    communityRating: 4.0,
    ratingCount: 9600,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "Planting Day",
        overview: "Eight strangers meet their sections and immediately start forming alliances.",
        runtimeMin: 42,
        communityRating: 3.9,
        ratingCount: 1400,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "First Harvest",
        overview: "An early frost forces an emergency change in strategy across every section.",
        runtimeMin: 41,
        communityRating: 4.0,
        ratingCount: 1300,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "The Vote",
        overview: "The first elimination gets ugly when two contestants are accused of sabotage.",
        runtimeMin: 44,
        communityRating: 4.2,
        ratingCount: 1500,
      },
    ],
  },
  {
    slug: "low-orbit",
    title: "Low Orbit",
    tagline: "Debris doesn't care whose it is.",
    overview:
      "A private orbital cleanup crew — equal parts engineers and repo agents — races corporate rivals to claim abandoned satellites before they become a hazard.",
    firstAirYear: 2027,
    seasonCount: 1,
    creator: "Wendell Achebe",
    cast: ["Frida Halvorsen", "Emeka Obi", "Ilya Petrenko"],
    genres: ["Sci-Fi", "Action"],
    moods: ["Energetic", "Intense"],
    popularity: 86,
    communityRating: 4.2,
    ratingCount: 14700,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "Salvage Rights",
        overview: "The crew races a rival team to a defunct weather satellite worth a year's contract.",
        runtimeMin: 45,
        communityRating: 4.1,
        ratingCount: 2100,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "Debris Field",
        overview: "A miscalculated burn strands two crew members in an expanding cloud of shrapnel.",
        runtimeMin: 47,
        communityRating: 4.3,
        ratingCount: 2200,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Dead Weight",
        overview: "The crew discovers one of the 'abandoned' satellites is still very much active.",
        runtimeMin: 46,
        communityRating: 4.4,
        ratingCount: 2300,
      },
    ],
  },
  {
    slug: "the-standing-committee",
    title: "The Standing Committee",
    tagline: "Democracy in inaction.",
    overview:
      "A mockumentary following the world's least effective homeowners' association as it wages a two-season war over a shared fence, a stolen gnome, and parking.",
    firstAirYear: 2025,
    seasonCount: 2,
    creator: "Colm Fitzgerald",
    cast: ["Ruth Halvorsen", "Femi Adegoke", "Warrick Osei"],
    genres: ["Comedy"],
    moods: ["Whimsical", "Energetic"],
    popularity: 70,
    communityRating: 4.3,
    ratingCount: 11800,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "The Fence",
        overview: "A six-inch property dispute spirals into a full committee investigation.",
        runtimeMin: 24,
        communityRating: 4.2,
        ratingCount: 1900,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "The Gnome",
        overview: "The theft of a beloved lawn gnome exposes a decade of buried grudges.",
        runtimeMin: 23,
        communityRating: 4.4,
        ratingCount: 2000,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Quorum",
        overview: "The committee can't agree on anything long enough to hold a legal vote.",
        runtimeMin: 25,
        communityRating: 4.3,
        ratingCount: 1950,
      },
    ],
  },
  {
    slug: "borrowed-time",
    title: "Borrowed Time",
    tagline: "You don't get to choose which memories stay.",
    overview:
      "A memory archivist who preserves dying patients' most treasured moments starts noticing the same stranger appearing, uninvited, in every memory she saves.",
    firstAirYear: 2026,
    seasonCount: 1,
    creator: "Helena Brandt",
    cast: ["Anaïs Moreau", "Sacha Duval", "Elowen Pryce"],
    genres: ["Drama", "Mystery", "Romance"],
    moods: ["Melancholic", "Dreamy"],
    popularity: 84,
    communityRating: 4.6,
    ratingCount: 16400,
    episodes: [
      {
        season: 1,
        episodeNumber: 1,
        title: "The Archive",
        overview: "The archivist notices the same face in the background of an unrelated memory.",
        runtimeMin: 51,
        communityRating: 4.5,
        ratingCount: 2000,
      },
      {
        season: 1,
        episodeNumber: 2,
        title: "Recurrence",
        overview: "A pattern search across the archive turns up hundreds more sightings, spanning decades.",
        runtimeMin: 53,
        communityRating: 4.7,
        ratingCount: 2100,
      },
      {
        season: 1,
        episodeNumber: 3,
        title: "Borrowed Time",
        overview: "The archivist finally meets the stranger, and he already knows her name.",
        runtimeMin: 54,
        communityRating: 4.8,
        ratingCount: 2300,
      },
    ],
  },
];

export interface SeedArtist {
  slug: string;
  name: string;
  bio: string;
  genres: string[];
  moods: string[];
  popularity: number;
  imageUrl?: string;
}

export const ARTISTS: SeedArtist[] = [
  {
    slug: "night-cartography",
    name: "Night Cartography",
    bio: "A Berlin-based duo mapping slow-building electronic soundscapes for late drives and later thoughts.",
    genres: ["Electronic", "Ambient"],
    moods: ["Atmospheric", "Nostalgic"],
    popularity: 88,
  },
  {
    slug: "the-low-tide",
    name: "The Low Tide",
    bio: "A four-piece indie rock outfit out of Portland known for reverb-drenched hooks and unusually specific lyrics.",
    genres: ["Indie Rock", "Alternative"],
    moods: ["Melancholic", "Dreamy"],
    popularity: 79,
  },
  {
    slug: "sable-quinn",
    name: "Sable Quinn",
    bio: "A singer-songwriter whose stripped-down folk arrangements have quietly soundtracked a decade of coming-of-age films.",
    genres: ["Folk"],
    moods: ["Calm", "Melancholic"],
    popularity: 74,
  },
  {
    slug: "ohm-district",
    name: "Ohm District",
    bio: "Genre-agnostic producer collective blending glitchy IDM with warm analog synth work.",
    genres: ["Electronic"],
    moods: ["Energetic", "Euphoric"],
    popularity: 82,
  },
  {
    slug: "marlowe-grant",
    name: "Marlowe Grant",
    bio: "A jazz pianist reworking modern standards through a minimalist, almost ambient lens.",
    genres: ["Jazz", "Ambient"],
    moods: ["Calm", "Nostalgic"],
    popularity: 61,
  },
  {
    slug: "kudzu-radio",
    name: "Kudzu Radio",
    bio: "Southern-fried alt-rock band whose live shows have become as legendary as their studio output is inconsistent.",
    genres: ["Alternative", "Indie Rock"],
    moods: ["Energetic", "Intense"],
    popularity: 76,
  },
  {
    slug: "dahlia-moon",
    name: "Dahlia Moon",
    bio: "An R&B vocalist whose smoky, unhurried delivery has drawn comparisons to jazz singers twice her age.",
    genres: ["R&B"],
    moods: ["Dreamy", "Euphoric"],
    popularity: 85,
  },
  {
    slug: "verse-and-vine",
    name: "Verse & Vine",
    bio: "A hip-hop duo splitting production duties evenly, known for dense wordplay over live instrumentation.",
    genres: ["Hip-Hop"],
    moods: ["Energetic", "Intense"],
    popularity: 80,
  },
  {
    slug: "glass-fields",
    name: "Glass Fields",
    bio: "Ambient composer building generative, ever-shifting pieces originally designed for a planetarium residency.",
    genres: ["Ambient"],
    moods: ["Calm", "Dreamy"],
    popularity: 58,
  },
  {
    slug: "the-departures",
    name: "The Departures",
    bio: "Anthemic alt-rock trio whose sophomore album turned late-night radio static into a genuine hit.",
    genres: ["Alternative"],
    moods: ["Uplifting", "Energetic"],
    popularity: 83,
  },
];

export interface SeedSong {
  title: string;
  durationSec: number;
  moods: string[];
  popularity: number;
  communityRating: number;
  ratingCount: number;
}

export interface SeedAlbum {
  slug: string;
  title: string;
  artistSlug: string;
  releaseYear: number;
  genres: string[];
  moods: string[];
  popularity: number;
  communityRating: number;
  ratingCount: number;
  songs: SeedSong[];
  coverUrl?: string;
}

export const ALBUMS: SeedAlbum[] = [
  {
    slug: "night-cartography-atlas",
    title: "Atlas",
    artistSlug: "night-cartography",
    releaseYear: 2026,
    genres: ["Electronic", "Ambient"],
    moods: ["Atmospheric", "Nostalgic"],
    popularity: 86,
    communityRating: 4.5,
    ratingCount: 6200,
    songs: [
      { title: "Coastal Road", durationSec: 251, moods: ["Atmospheric"], popularity: 84, communityRating: 4.6, ratingCount: 1800 },
      { title: "Static Coordinates", durationSec: 218, moods: ["Dreamy"], popularity: 78, communityRating: 4.4, ratingCount: 1400 },
      { title: "Last Exit", durationSec: 273, moods: ["Melancholic"], popularity: 81, communityRating: 4.5, ratingCount: 1600 },
      { title: "Atlas", durationSec: 302, moods: ["Nostalgic", "Atmospheric"], popularity: 90, communityRating: 4.7, ratingCount: 2100 },
    ],
  },
  {
    slug: "the-low-tide-driftwood",
    title: "Driftwood",
    artistSlug: "the-low-tide",
    releaseYear: 2025,
    genres: ["Indie Rock"],
    moods: ["Melancholic", "Dreamy"],
    popularity: 77,
    communityRating: 4.3,
    ratingCount: 4900,
    songs: [
      { title: "Salt Air", durationSec: 198, moods: ["Dreamy"], popularity: 75, communityRating: 4.2, ratingCount: 1100 },
      { title: "Driftwood", durationSec: 224, moods: ["Melancholic"], popularity: 82, communityRating: 4.5, ratingCount: 1500 },
      { title: "Rusted Pier", durationSec: 187, moods: ["Nostalgic"], popularity: 70, communityRating: 4.1, ratingCount: 900 },
    ],
  },
  {
    slug: "sable-quinn-low-country",
    title: "Low Country",
    artistSlug: "sable-quinn",
    releaseYear: 2024,
    genres: ["Folk"],
    moods: ["Calm", "Melancholic"],
    popularity: 71,
    communityRating: 4.6,
    ratingCount: 5300,
    songs: [
      { title: "Porch Light", durationSec: 213, moods: ["Calm"], popularity: 73, communityRating: 4.6, ratingCount: 1200 },
      { title: "Low Country", durationSec: 241, moods: ["Melancholic"], popularity: 79, communityRating: 4.7, ratingCount: 1500 },
      { title: "Leaving Song", durationSec: 205, moods: ["Melancholic", "Calm"], popularity: 68, communityRating: 4.5, ratingCount: 1000 },
    ],
  },
  {
    slug: "ohm-district-phase-lock",
    title: "Phase Lock",
    artistSlug: "ohm-district",
    releaseYear: 2027,
    genres: ["Electronic"],
    moods: ["Energetic", "Euphoric"],
    popularity: 85,
    communityRating: 4.3,
    ratingCount: 5800,
    songs: [
      { title: "Phase Lock", durationSec: 226, moods: ["Energetic"], popularity: 88, communityRating: 4.4, ratingCount: 1900 },
      { title: "Voltage", durationSec: 198, moods: ["Euphoric"], popularity: 83, communityRating: 4.3, ratingCount: 1600 },
      { title: "Analog Sunrise", durationSec: 254, moods: ["Euphoric", "Uplifting"], popularity: 80, communityRating: 4.5, ratingCount: 1500 },
    ],
  },
  {
    slug: "marlowe-grant-quiet-standards",
    title: "Quiet Standards",
    artistSlug: "marlowe-grant",
    releaseYear: 2023,
    genres: ["Jazz", "Ambient"],
    moods: ["Calm", "Nostalgic"],
    popularity: 59,
    communityRating: 4.7,
    ratingCount: 3100,
    songs: [
      { title: "After Hours", durationSec: 267, moods: ["Calm"], popularity: 60, communityRating: 4.8, ratingCount: 900 },
      { title: "Quiet Standards", durationSec: 289, moods: ["Nostalgic"], popularity: 63, communityRating: 4.7, ratingCount: 950 },
    ],
  },
  {
    slug: "kudzu-radio-firebreak",
    title: "Firebreak",
    artistSlug: "kudzu-radio",
    releaseYear: 2026,
    genres: ["Alternative", "Indie Rock"],
    moods: ["Energetic", "Intense"],
    popularity: 78,
    communityRating: 4.1,
    ratingCount: 4400,
    songs: [
      { title: "Firebreak", durationSec: 203, moods: ["Intense"], popularity: 80, communityRating: 4.2, ratingCount: 1300 },
      { title: "Dry Season", durationSec: 219, moods: ["Energetic"], popularity: 74, communityRating: 4.0, ratingCount: 1000 },
      { title: "Ash & Signal", durationSec: 231, moods: ["Intense", "Dark"], popularity: 76, communityRating: 4.1, ratingCount: 1100 },
    ],
  },
  {
    slug: "dahlia-moon-slow-static",
    title: "Slow Static",
    artistSlug: "dahlia-moon",
    releaseYear: 2025,
    genres: ["R&B"],
    moods: ["Dreamy", "Euphoric"],
    popularity: 87,
    communityRating: 4.6,
    ratingCount: 7100,
    songs: [
      { title: "Slow Static", durationSec: 214, moods: ["Dreamy"], popularity: 90, communityRating: 4.7, ratingCount: 2400 },
      { title: "Copper Light", durationSec: 198, moods: ["Euphoric"], popularity: 85, communityRating: 4.6, ratingCount: 2000 },
      { title: "Undertow", durationSec: 227, moods: ["Dreamy", "Melancholic"], popularity: 82, communityRating: 4.5, ratingCount: 1800 },
    ],
  },
  {
    slug: "verse-and-vine-dovetail",
    title: "Dovetail",
    artistSlug: "verse-and-vine",
    releaseYear: 2026,
    genres: ["Hip-Hop"],
    moods: ["Energetic", "Intense"],
    popularity: 81,
    communityRating: 4.4,
    ratingCount: 5600,
    songs: [
      { title: "Dovetail", durationSec: 189, moods: ["Intense"], popularity: 84, communityRating: 4.5, ratingCount: 1700 },
      { title: "Load Bearing", durationSec: 176, moods: ["Energetic"], popularity: 79, communityRating: 4.3, ratingCount: 1400 },
      { title: "Two Chairs", durationSec: 201, moods: ["Melancholic", "Intense"], popularity: 77, communityRating: 4.4, ratingCount: 1300 },
    ],
  },
  {
    slug: "glass-fields-planetarium",
    title: "Planetarium Sessions",
    artistSlug: "glass-fields",
    releaseYear: 2024,
    genres: ["Ambient"],
    moods: ["Calm", "Dreamy"],
    popularity: 57,
    communityRating: 4.5,
    ratingCount: 2200,
    songs: [
      { title: "Aphelion", durationSec: 312, moods: ["Dreamy"], popularity: 55, communityRating: 4.6, ratingCount: 600 },
      { title: "Planetarium", durationSec: 298, moods: ["Calm"], popularity: 58, communityRating: 4.5, ratingCount: 650 },
    ],
  },
  {
    slug: "the-departures-static-anthem",
    title: "Static Anthem",
    artistSlug: "the-departures",
    releaseYear: 2025,
    genres: ["Alternative"],
    moods: ["Uplifting", "Energetic"],
    popularity: 84,
    communityRating: 4.4,
    ratingCount: 6700,
    songs: [
      { title: "Static Anthem", durationSec: 217, moods: ["Uplifting"], popularity: 89, communityRating: 4.6, ratingCount: 2500 },
      { title: "Runway Lights", durationSec: 204, moods: ["Energetic"], popularity: 82, communityRating: 4.3, ratingCount: 1900 },
      { title: "Aftertaste", durationSec: 195, moods: ["Melancholic", "Uplifting"], popularity: 78, communityRating: 4.3, ratingCount: 1700 },
    ],
  },
];

export function posterUrl(slug: string) {
  return img(slug, 600, 900);
}
export function backdropUrl(slug: string) {
  return img(`${slug}-backdrop`, 1600, 900);
}
export function stillUrl(slug: string) {
  return img(`${slug}-still`, 800, 450);
}
export function avatarUrl(slug: string) {
  return img(`${slug}-portrait`, 500, 500);
}
export function coverUrl(slug: string) {
  return img(`${slug}-cover`, 700, 700);
}
