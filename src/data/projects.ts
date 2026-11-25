export interface ProjectSystem {
  name: string;
  description: string;
  techStack: string[];
  features: string[];
}

export type ProjectType = 'Professional' | 'Personal' | 'Game Jam' | 'Tool' | 'Prototype';

export interface Project {
  id: string;
  title: string;
  description: string;
  shortDescription?: string;
  thumbnail: string;
  category: 'Unity' | 'Unreal Engine' | 'Marketing';
  tags: string[];
  projectType?: ProjectType;
  role?: string;
  company?: string;
  timeframe?: string;
  featured?: boolean;
  priority?: number;
  isSecret?: boolean;
  impact?: string[];
  challenges?: string[];
  systems: ProjectSystem[];
  demoUrl?: string;
  githubUrl?: string;
  gallery?: string[];
  /** CSS object-position for the card thumbnail, e.g. 'left center'. */
  thumbnailPosition?: string;
  /** flagship = big card, also = compact tile, archive = collapsed list */
  tier?: ProjectTier;
  /** One punchy sentence shown on cards/tiles */
  headline?: string;
  /** Small proof badge, e.g. '50+ fixes · Update 20' */
  badge?: string;
}

export type ProjectTier = 'flagship' | 'also' | 'archive';

export const projects: Project[] = [
  // —— Tier 1: Featured / Professional ——
  {
    id: 'mayhem-a-la-carte',
    priority: 3,
    tier: 'flagship',
    headline: 'Run marketing for Ingame’s next game: social, reveal, creators, streams and the website.',
    badge: 'Reveal → wishlists',
    featured: true,
    title: 'Mayhem À La Carte',
    description: 'Marketing Engineer for Mayhem À La Carte, Ingame Studios’ co-op cooking shooter, published by 505 Games. I own the social media strategy and channels, worked on the reveal campaign, run creator outreach on a tool I built for it (IGS Outreach), built mayhemalacarte.com, host livestreams on Twitch and YouTube and voiced part of the trailer. It started because my ModKit tutorials and streams worked, so the studio moved me into marketing full time.',
    shortDescription: 'Marketing for Ingame Studios’ co-op cooking shooter: reveal, social, creators, streams, website.',
    thumbnail: '/projects/mayhem/key-art.jpg',
    thumbnailPosition: 'left center',
    gallery: [
      '/projects/mayhem/shot-01.jpg',
      '/projects/mayhem/shot-02.jpg',
      '/projects/mayhem/shot-03.jpg',
      '/projects/mayhem/shot-04.jpg',
      '/projects/mayhem/shot-05.jpg',
    ],
    category: 'Marketing',
    tags: ['Game Marketing', 'Social', 'Creators'],
    projectType: 'Professional',
    role: 'Marketing Engineer',
    company: 'Ingame Studios',
    timeframe: '2026–now',
    impact: [
      'Own social media strategy and channels',
      'Reveal campaign',
      'Built mayhemalacarte.com, voiced part of the trailer',
      'Represented Ingame at gamescom 2026 and VGDM #98 Vienna',
    ],
    demoUrl: 'https://mayhemalacarte.com/',
    systems: [
      {
        name: 'Launch & Community Marketing',
        description: 'Day-to-day marketing for a PC/console game with a publisher partner.',
        techStack: ['Social platforms', 'Creator outreach', 'Web', 'Livestreams'],
        features: ['Reveal campaign', 'Social calendar', 'Creator outreach', 'Game website', 'Trailer voice-over', 'Events'],
      },
    ],
  },
  {
    id: 'igs-outreach',
    priority: 2,
    tier: 'flagship',
    headline: 'Built the studio’s creator-outreach platform: find, mail, follow up and measure in one tool.',
    badge: 'Live Twitch + YouTube data',
    featured: true,
    title: 'IGS Outreach',
    description: 'A creator-outreach platform I designed and built for Ingame Studios. Every streamer and YouTuber we work with lives in one searchable database that hydrates itself daily from the Twitch and YouTube APIs, so follower counts and stats are always current. It plugs into Outlook through Microsoft Entra: it sends personalised HTML mail campaigns with tokens and multiple copy variants, throttles sends in irregular steps with per-minute, hour and day caps to stay out of spam folders, detects replies and asks you to rate them. After a campaign it asks what the creator actually made and stores the links, and that feedback powers recommendations for similar creators.',
    shortDescription: 'Influencer CRM + mail engine: live Twitch/YouTube data, throttled personalised campaigns, reply tracking, recommendations.',
    thumbnail: '/projects/igs-outreach.svg',
    category: 'Marketing',
    tags: ['Full-stack', 'APIs', 'Marketing Eng.'],
    projectType: 'Tool',
    role: 'Marketing Engineer',
    company: 'Ingame Studios',
    timeframe: '2026',
    impact: [
      'Whole creator pipeline in one tool: find, mail, follow up, measure',
      'Data re-hydrated daily from Twitch and YouTube APIs',
      'Throttled, personalised sends that stay out of spam',
    ],
    challenges: [
      'Deliverability: irregular throttling, rate caps and copy variants',
      'Keeping thousands of creator profiles fresh without hitting API quotas',
      'Turning campaign feedback into useful recommendations',
    ],
    systems: [
      {
        name: 'Creator Database & Search',
        description: 'Tagged creator profiles with live platform stats and a filter system built for campaign briefs ("~5k Twitch followers, streams co-op games").',
        techStack: ['Twitch API', 'YouTube Data API', 'Scheduled hydration job'],
        features: ['Tags & advanced filters', 'Daily stat hydration', 'Good/bad collaboration flags', 'Similar-creator recommendations'],
      },
      {
        name: 'Campaign Mailer',
        description: 'Outlook-connected mail engine for personalised outreach at scale.',
        techStack: ['Microsoft Graph / Entra', 'HTML + CSS email', 'Token templating'],
        features: ['Tokens ({name}, {handle}, …)', 'Multiple copy variants per campaign', 'Irregular throttling + rate caps', 'Reply detection & in-app replies'],
      },
      {
        name: 'Follow-up & Analytics',
        description: 'Closes the loop after every campaign.',
        techStack: ['Analytics', 'Feedback prompts'],
        features: ['Response rates', 'Positive/negative reply tagging', 'Post-campaign content links + ratings', 'Follow-up reminders'],
      },
    ],
  },
  {
    id: 'mayhem-recipe-pipeline',
    priority: 6,
    tier: 'flagship',
    headline: 'One click turns the design team’s recipe sheet into every cooking-step asset in Unreal.',
    badge: 'CSV → Data Assets',
    featured: true,
    title: 'Recipe Data Pipeline',
    description: 'In Mayhem À La Carte every dish is a chain of steps: bun, bun + patty, bun + patty + tomato, and so on. Design keeps all recipes in a Confluence table. I built the Unreal tooling that takes the exported CSV and generates the recipe data assets, including every intermediate step, with one click. The game’s whole cooking logic runs on the assets this pipeline creates.',
    shortDescription: 'One-click CSV → Unreal recipe assets, generating every intermediate cooking step automatically.',
    thumbnail: '/projects/mayhem/shot-03.jpg',
    category: 'Unreal Engine',
    tags: ['Tools', 'Data Pipeline', 'C++'],
    projectType: 'Professional',
    role: 'Tools Programmer',
    company: 'Ingame Studios · Mayhem À La Carte',
    timeframe: '2026',
    impact: [
      'Recipe import went from manual work to one button',
      'Generates every intermediate step automatically',
      'The cooking gameplay runs on its data assets',
    ],
    challenges: [
      'Deriving the full step graph from a flat design table',
      'Re-imports that update assets without breaking references',
    ],
    demoUrl: 'https://mayhemalacarte.com/',
    systems: [
      {
        name: 'CSV → Recipe Asset Importer',
        description: 'Editor tool that turns the design team’s recipe table into gameplay-ready data assets.',
        techStack: ['Unreal Engine 5', 'C++', 'Data Assets', 'CSV'],
        features: ['One-click import', 'Automatic intermediate steps', 'Safe re-import', 'Designer-owned source of truth'],
      },
    ],
  },
  {
    id: 'mayhem-website',
    priority: 9,
    tier: 'also',
    headline: 'Designed and built the official game website for the reveal.',
    badge: 'Live site',
    title: 'mayhemalacarte.com',
    description: 'Designed and built the official website for Mayhem À La Carte: the game’s home on the web for the reveal, wishlists, media and newsletter, kept in the game’s own visual language.',
    shortDescription: 'The official game website, designed and built by me.',
    thumbnail: '/projects/mayhem/hero.jpg',
    thumbnailPosition: 'center right',
    category: 'Marketing',
    tags: ['Web', 'Game Marketing', 'Frontend', 'Wishlists'],
    projectType: 'Professional',
    role: 'Marketing Engineer',
    company: 'Ingame Studios',
    timeframe: '2026',
    impact: ['Official home of the game online', 'Built for the reveal campaign'],
    demoUrl: 'https://mayhemalacarte.com/',
    systems: [
      {
        name: 'Game Website',
        description: 'Responsive marketing site for a PC game reveal.',
        techStack: ['Web', 'Frontend'],
        features: ['Reveal landing page', 'Wishlist calls to action', 'Media and key art'],
      },
    ],
  },
  {
    id: 'agentic-marketing',
    priority: 7,
    tier: 'also',
    headline: 'Stream in, scheduled clips out: AI finds the moments, I approve them.',
    badge: 'Human-in-the-loop AI',
    title: 'Agentic Content Pipeline',
    description: 'An AI-assisted content workflow I built with Claude: it transcribes multi-hour livestreams, samples frames every few seconds, and finds the strongest moments from what is said and what is on screen. I review the picks in a queue; approved clips get platform-specific copy written and are scheduled and posted automatically. The human directs and reviews, the pipeline does the grind.',
    shortDescription: 'Stream → clips → copy → scheduled posts. AI does the grind, a human approves every step.',
    thumbnail: '/projects/agentic-pipeline.svg',
    category: 'Marketing',
    tags: ['AI Agents', 'Automation', 'Speech-to-text', 'Social Media'],
    projectType: 'Tool',
    role: 'Marketing Engineer',
    timeframe: '2026',
    impact: [
      '5-hour stream to a clip shortlist without scrubbing footage',
      'Per-platform copy and scheduling on approval',
      'Human-in-the-loop review queue',
    ],
    systems: [
      {
        name: 'Clip Finder',
        description: 'Transcript + frame analysis to surface highlight moments.',
        techStack: ['Claude', 'Speech-to-text', 'Frame sampling'],
        features: ['Moment detection from speech and visuals', 'Review queue (accept / reject)', 'Auto-cut clips'],
      },
      {
        name: 'Copy & Scheduler',
        description: 'Writes platform-specific posts and schedules them.',
        techStack: ['Claude', 'Social platform APIs'],
        features: ['Copy per platform', 'Scheduling', 'Auto-posting after approval'],
      },
    ],
  },
  {
    id: 'modkit-docs',
    priority: 10,
    tier: 'also',
    headline: 'Designed and built the ModKit’s official website for modders.',
    badge: 'Website',
    title: 'Crime Boss ModKit Website',
    description: 'Designed and built the official website for the Crime Boss: Rockay City ModKit: the hub modders land on, with guides for missions, teammates and bosses, Rockay Rumble maps and equipment, all tied into my tutorial video series.',
    shortDescription: 'The official ModKit website, designed and built by me.',
    thumbnail: '/projects/crimeboss-modkit.jpg',
    category: 'Marketing',
    tags: ['Web', 'Community', 'Modding'],
    projectType: 'Professional',
    role: 'Designer & Developer',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    impact: ['Official home for Crime Boss modders', 'Paired with my 11-part tutorial series'],
    demoUrl: 'https://cbmodkit.ingamestudios.com/',
    systems: [
      {
        name: 'ModKit Website',
        description: 'Website for modders working without source access.',
        techStack: ['Web', 'Video tutorials'],
        features: ['Mission creation', 'Custom bosses & teammates', 'Rockay Rumble maps', 'Weapons & skins'],
      },
    ],
  },
  {
    id: 'network-session-kit',
    priority: 8,
    tier: 'also',
    headline: 'My own UE5 plugin that makes OSSv2 sessions and lobbies a few clean calls.',
    badge: 'v2.0 · solo',
    title: 'Network Session Kit',
    description: 'My own Unreal Engine 5 plugin for sessions and lobbies on Online Subsystem v2. A drop-in layer that turns the async OSSv2 session flow into a few clean Blueprint and C++ calls. Version 2.0, designed, written and maintained by me.',
    shortDescription: 'My UE5 plugin for sessions and lobbies on Online Subsystem v2. Drop-in, Blueprint-friendly.',
    thumbnail: '/projects/network-session-kit.jpg',
    category: 'Unreal Engine',
    tags: ['Multiplayer', 'Plugin', 'Online Subsystem', 'C++'],
    projectType: 'Tool',
    role: 'Author',
    company: 'Own plugin',
    timeframe: '2026',
    impact: [
      'Sessions and lobbies on Online Subsystem v2',
      'Version 2.0, written solo',
      'Blueprint + C++ API, drop-in for any UE5 project',
    ],
    systems: [
      {
        name: 'Session & Lobby Plugin',
        description: 'Reusable plugin that wraps OSSv2 session and lobby flows.',
        techStack: ['Unreal Engine 5', 'C++', 'Online Subsystem v2'],
        features: ['Session create / find / join', 'Lobbies', 'Drop-in plugin'],
      },
    ],
  },
  {
    id: 'crime-boss-rockay-city',
    priority: 1,
    tier: 'flagship',
    headline: 'Shipped gameplay, UI and replication fixes on a live Unreal co-op shooter.',
    badge: '50+ fixes · Update 20',
    featured: true,
    title: 'Crime Boss: Rockay City',
    description: 'Worked as a Gameplay Programmer on Crime Boss: Rockay City, fixing gameplay, UI, and replication issues across a large Unreal codebase. Contributed over 50 bug fixes included in Update 20.',
    shortDescription: 'Gameplay programmer on shipped Unreal title; 50+ bug fixes in Update 20, replication and UI work.',
    thumbnail: '/projects/crimeboss.jpg',
    category: 'Unreal Engine',
    tags: ['Unreal Engine', 'Replication', 'C++'],
    projectType: 'Professional',
    role: 'Gameplay Programmer',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    impact: [
      'Contributed 50+ bug fixes included in Update 20',
      'Resolved join-in-progress replication issues',
      'Worked directly on shipped production code',
    ],
    challenges: [
      'Debugging hybrid Blueprint/C++ systems',
      'Investigating complex replication edge cases',
      'Navigating a large established codebase quickly',
    ],
    demoUrl: 'https://store.steampowered.com/app/2933080/Crime_Boss_Rockay_City/',
    systems: [
      {
        name: 'Gameplay Bug Fixing & Systems Maintenance',
        description: 'Resolved gameplay, UI, and networking issues across core game systems in a live production environment.',
        techStack: ['Unreal Engine 4', 'Unreal Engine 5', 'C++', 'Blueprints'],
        features: [
          'Join-in-progress replication fixes',
          'Gameplay ability bug fixing',
          'Item system debugging',
          'Mission logic fixes',
          'UI bug fixing',
          'Production code maintenance',
        ],
      },
    ],
  },
  {
    id: 'crime-boss-modkit',
    priority: 4,
    tier: 'flagship',
    headline: 'Made Crime Boss moddable without source code, then taught it in an 11-part video series.',
    badge: 'Custom bosses + Rumble maps',
    featured: true,
    title: 'Crime Boss Official Modkit',
    description: 'Contributed to the official Crime Boss modkit by refactoring gameplay systems to be Blueprint-extensible and DataTable-driven, enabling meaningful mod support without source code access.',
    shortDescription: 'Refactored gameplay for Blueprint/DataTable moddability; Rockay Rumble and custom boss support.',
    thumbnail: '/projects/crimeboss-modkit.jpg',
    category: 'Unreal Engine',
    tags: ['Modding', 'Blueprints', 'DataTables'],
    projectType: 'Professional',
    role: 'Gameplay / Systems Programmer',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    impact: [
      'Made Rockay Rumble moddable',
      'Enabled custom playable boss character support',
      'Contributed to public modding docs and tutorial videos',
    ],
    challenges: [
      'Refactoring systems for moddability without source code distribution',
      'Exposing gameplay logic safely to Blueprint',
      'Extending in-game DataTable workflows with custom features',
    ],
    demoUrl: 'https://store.steampowered.com/app/2933080/Crime_Boss_Rockay_City/',
    systems: [
      {
        name: 'Moddable Gameplay Systems',
        description: 'Refactored gameplay features to support extension through Blueprints and DataTables in a source-code-free modding environment.',
        techStack: ['Unreal Engine', 'C++', 'Blueprints', 'DataTables'],
        features: [
          'Blueprint-exposed gameplay systems',
          'DataTable-driven extensibility',
          'Rockay Rumble mod support',
          'Custom boss character support',
          'Public modkit documentation',
          'Tutorial and promotional material support',
        ],
      },
    ],
  },
  {
    id: 'unreal-multiplayer-framework',
    priority: 5,
    tier: 'flagship',
    headline: 'Wrote the EOS multiplayer subsystem that runs Mayhem À La Carte’s 4-player co-op.',
    badge: 'EOS · dedicated servers',
    featured: true,
    title: 'Unreal Multiplayer Framework',
    description: 'Designed and implemented the reusable multiplayer subsystem behind Mayhem À La Carte’s 4-player co-op, built on EOS. It wraps session creation, lobby flow, player registration and dedicated server workflows into gameplay-facing Unreal subsystems.',
    shortDescription: 'The EOS multiplayer subsystem behind Mayhem À La Carte’s co-op: sessions, lobbies, dedicated servers.',
    thumbnail: '/projects/mayhem/shot-04.jpg',
    category: 'Unreal Engine',
    tags: ['Multiplayer', 'EOS', 'C++'],
    projectType: 'Professional',
    role: 'Systems Programmer',
    company: 'Ingame Studios · Mayhem À La Carte',
    timeframe: '2025–2026',
    impact: [
      'Multiplayer backbone of Mayhem À La Carte’s co-op',
      'Unified session and lobby workflows on EOS',
      'Supported dedicated server hosting flows',
    ],
    challenges: [
      'Wrapping low-level EOS functionality into usable gameplay framework',
      'Handling async/session lifecycle behavior',
      'Designing one-size-fits-all multiplayer architecture',
    ],
    demoUrl: 'https://mayhemalacarte.com/',
    systems: [
      {
        name: 'Session & Lobby Framework',
        description: 'Subsystem-based multiplayer framework built to abstract EOS functionality into reusable gameplay-facing systems.',
        techStack: ['Unreal Engine 5', 'C++', 'EOS', 'Subsystems'],
        features: [
          'Session creation',
          'Lobby management',
          'Player registration',
          'Session discovery',
          'Dedicated server support',
          'Reusable subsystem architecture',
        ],
      },
    ],
  },
  {
    id: 'nok-sound-system',
    priority: 11,
    tier: 'also',
    headline: 'Dynamic mixing and spatial audio system for a shipped Steam game.',
    badge: 'Shipped on Steam',
    title: 'NOK - Advanced Sound System',
    description: 'Built a reusable sound system for NOK (physics-based sandbox hidden object game) with dynamic mixing, spatial audio, and interactive effects—later folded into the BaboonWorks package for use across projects.',
    shortDescription: 'Dynamic mixing, spatial audio, and interactive SFX; part of BaboonWorks package.',
    thumbnail: '/projects/nok.png',
    category: 'Unity',
    tags: ['Audio Programming', 'Game Development', 'Unity Package'],
    projectType: 'Professional',
    role: 'Gameplay / Tools',
    company: 'Nerd Monkeys',
    demoUrl: 'https://store.steampowered.com/app/2451750/NOK/',
    systems: [
      {
        name: 'Dynamic Sound System',
        description: 'Custom sound management with dynamic mixing and spatial audio for varied game contexts.',
        techStack: ['C#', 'Unity Audio System', 'BaboonWorks Package'],
        features: [
          'Dynamic audio mixing',
          'Spatial audio implementation',
          'Interactive sound effects',
          'Custom audio package development',
        ],
      },
    ],
  },
  {
    id: 'cognition-redcross',
    priority: 12,
    tier: 'also',
    headline: 'Puzzle and session systems for a Portuguese Red Cross cognitive-training game.',
    badge: 'Client project',
    title: 'Cognition - Red Cross Project',
    description: 'Implemented puzzle and session logic for an educational title commissioned by the Portuguese Red Cross, aimed at cognitive training and elderly care. Shipped custom pipe puzzle mechanics and session tracking.',
    shortDescription: 'Educational title for Portuguese Red Cross; puzzle design and session tracking.',
    thumbnail: '/projects/cognition.jpg',
    category: 'Unity',
    tags: ['Educational', 'Healthcare', 'Puzzle Design'],
    projectType: 'Professional',
    role: 'Gameplay Programmer',
    company: 'Nerd Monkeys',
    impact: [
      'Shipped puzzle and session systems for client',
      'Session persistence and progress tracking',
      'Accessibility-oriented design',
    ],
    systems: [
      {
        name: 'Pipe Logic Puzzle',
        description: 'Interactive puzzle system designed for cognitive training and clear feedback.',
        techStack: ['Unity', 'C#'],
        features: [
          'Custom puzzle mechanics',
          'Session management',
          'Progress tracking',
          'Accessibility features',
        ],
      },
      {
        name: 'Session Management',
        description: 'Session handling for user progress and engagement metrics.',
        techStack: ['Unity', 'C#'],
        features: [
          'User progress tracking',
          'Session persistence',
          'Data analytics',
          'Customizable difficulty',
        ],
      },
    ],
  },
  // —— Professional tools / Nerd Monkeys era ——
  {
    id: 'scene-loader',
    priority: 20,
    tier: 'archive',
    headline: 'Async scene loading with pooling and progress hooks (Unity).',
    title: 'Advanced Scene Loader',
    description: 'Built a reusable Unity scene loading system with asynchronous loading, object pooling, and progress tracking to support smoother transitions and more controlled memory usage. Part of BaboonWorks.',
    shortDescription: 'Async loading, pooling, and progress tracking for smoother level transitions.',
    thumbnail: '/projects/nerd-monkeys.png',
    category: 'Unity',
    tags: ['Tool Development', 'Performance', 'Memory Management'],
    projectType: 'Professional',
    role: 'Tools / Systems',
    company: 'Nerd Monkeys',
    systems: [
      {
        name: 'Scene Management System',
        description: 'Async scene loading and management with pooling and progress hooks.',
        techStack: ['Unity', 'C#', 'Async Operations'],
        features: [
          'Asynchronous scene loading',
          'Object pooling system',
          'Memory management',
          'Loading screen integration',
          'Progress tracking',
          'Scene transition effects',
        ],
      },
    ],
  },
  {
    id: 'scriptable-reset',
    priority: 21,
    tier: 'archive',
    headline: 'Build-time ScriptableObject reset tool (Unity editor).',
    title: 'Scriptable Object Reset Tool',
    description: 'Editor tool for tracking and resetting ScriptableObject values at build time so dev and production builds behave consistently without manual cleanup.',
    shortDescription: 'Build-time ScriptableObject reset for consistent dev/prod behavior.',
    thumbnail: '/projects/nerd-monkeys.png',
    category: 'Unity',
    tags: ['Editor Tools', 'Workflow', 'Build Management'],
    projectType: 'Professional',
    role: 'Tools Programmer',
    company: 'Nerd Monkeys',
    systems: [
      {
        name: 'Value Management System',
        description: 'Tracking and resetting ScriptableObject values with configurable rules.',
        techStack: ['Unity Editor', 'C#', 'ScriptableObjects'],
        features: [
          'Value persistence tracking',
          'Build-time value reset',
          'Custom reset configurations',
          'Editor integration',
          'Value history management',
          'Batch processing',
        ],
      },
    ],
  },
  {
    id: 'editor-snapping',
    priority: 22,
    tier: 'archive',
    headline: 'Floor/surface snapping for faster blockout (Unity editor).',
    title: 'Editor Snapping Tool',
    description: 'Level-design tool for the Unity Editor: floor snapping, surface alignment, and grid placement to speed up blockout and object placement.',
    shortDescription: 'Floor/surface snapping and grid placement for faster level blockout.',
    thumbnail: '/projects/nerd-monkeys.png',
    category: 'Unity',
    tags: ['Editor Tools', 'Level Design', 'Workflow'],
    projectType: 'Professional',
    role: 'Tools Programmer',
    company: 'Nerd Monkeys',
    systems: [
      {
        name: 'Snapping System',
        description: 'Object placement and alignment in the editor with configurable snap options.',
        techStack: ['Unity Editor', 'C#', 'Editor Tools'],
        features: [
          'Floor snapping',
          'Surface alignment',
          'Grid-based placement',
          'Custom snap points',
          'Editor integration',
          'Multi-object alignment',
        ],
      },
    ],
  },
  {
    id: 'proximity-chat',
    priority: 23,
    tier: 'archive',
    headline: 'Distance-based voice chat on Photon (Unity).',
    title: 'Photon Proximity Chat',
    description: 'Spatial voice chat for a multiplayer prototype using Photon: distance-based attenuation and integration with the existing netcode.',
    shortDescription: 'Spatial voice chat with distance-based attenuation; Photon integration.',
    thumbnail: '/projects/nerd-monkeys.png',
    category: 'Unity',
    tags: ['Multiplayer', 'Networking', 'Voice Chat'],
    projectType: 'Professional',
    role: 'Gameplay / Networking',
    company: 'Nerd Monkeys',
    systems: [
      {
        name: 'Proximity Voice System',
        description: 'Real-time voice with distance-based attenuation in a networked context.',
        techStack: ['Photon', 'Unity', 'Voice SDK'],
        features: [
          'Spatial voice chat',
          'Distance-based audio',
          'Multiplayer integration',
          'Custom voice filters',
        ],
      },
    ],
    githubUrl: 'https://github.com/NerdMonkeys/photon-third-person-mp.git',
  },
  {
    id: 'broken-glass',
    priority: 24,
    tier: 'archive',
    headline: 'Narrative PSA game with a PSX look (Unreal).',
    title: 'Broken Glass',
    description: 'Anti-drug PSA game in Unreal: branching narrative and PSX-style presentation. Explores substance abuse and consequences; includes content warnings and careful tone handling.',
    shortDescription: 'Unreal narrative game; branching story, PSX aesthetic, serious subject matter.',
    thumbnail: '/projects/broken-glass-web.jpg',
    category: 'Unreal Engine',
    tags: ['Serious Games', 'Visual Novel', 'PSX Style'],
    projectType: 'Personal',
    systems: [
      {
        name: 'Narrative System',
        description: 'Branching narrative with emotional beats and content handling.',
        techStack: ['Unreal Engine', 'Blueprints'],
        features: [
          'Branching dialogue',
          'Emotional storytelling',
          'PSX-style graphics',
          'Content warning system',
        ],
      },
    ],
    demoUrl: 'https://sketchwright.itch.io/broken-glass',
  },
  {
    id: 'scalien',
    priority: 25,
    tier: 'archive',
    headline: 'GMTK 2024 jam: scale animals to solve physics puzzles.',
    title: 'Scalien - GMTK Game Jam 2024',
    description: 'GMTK 2024 entry: scale animals to object sizes to solve physics-based puzzles. Built in Unreal with Blueprints under tight time constraints.',
    shortDescription: 'Scale animals to objects; physics puzzles. GMTK 2024.',
    thumbnail: '/projects/scalien.jpg',
    category: 'Unreal Engine',
    tags: ['Game Jam', 'Physics', 'Puzzle'],
    projectType: 'Game Jam',
    systems: [
      {
        name: 'Scaling System',
        description: 'Physics-based scaling of characters and objects for puzzle design.',
        techStack: ['Unreal Engine', 'Blueprints'],
        features: [
          'Dynamic scaling mechanics',
          'Physics interactions',
          'Reference-based puzzles',
          'Quick iteration system',
        ],
      },
    ],
    demoUrl: 'https://itch.io/jam/gmtk-2024/rate/2915721',
  },
  {
    id: 'five-nights-furbys',
    priority: 26,
    tier: 'archive',
    headline: 'Jam horror game with Furby AI and behavior trees.',
    title: 'Five Nights at Furbys',
    description: 'Hagenberg Game Jam horror game: Furbys in a Five Nights–style setup. Implemented AI pathfinding and behavior trees for tension and variety.',
    shortDescription: 'FNAF-style horror with Furby AI; pathfinding and behavior trees.',
    thumbnail: '/projects/furbys-web.jpg',
    category: 'Unreal Engine',
    tags: ['Horror', 'Game Jam', 'AI Behavior'],
    projectType: 'Game Jam',
    systems: [
      {
        name: 'AI Behavior System',
        description: 'AI for Furby movement and behavior with configurable difficulty.',
        techStack: ['Unreal Engine', 'Blueprints'],
        features: [
          'Pathfinding AI',
          'Behavior trees',
          'Dynamic difficulty',
          'Horror mechanics',
        ],
      },
    ],
    githubUrl: 'https://github.com/sketchwright/Five-Nights-At-Furbys.git',
  },
];

// Secret projects (Konami code)
export const secretProjects: Project[] = [
  {
    id: 'baboonworks-package',
    priority: 50,
    title: 'BaboonWorks Unity Package',
    description: 'Internal Unity package bundling scene loading, editor utilities, and audio systems for reuse across projects.',
    shortDescription: 'Bundled scene loader, editor tools, and sound system for reuse.',
    thumbnail: '/projects/baboonworks.svg',
    category: 'Unity',
    tags: ['Unity Package', 'Tool Development', 'Game Systems', 'Editor Tools'],
    projectType: 'Tool',
    isSecret: true,
    systems: [
      {
        name: 'Advanced Scene Loader',
        description: 'Async loading, pooling, and progress tracking.',
        techStack: ['Unity', 'C#', 'Async Operations'],
        features: [
          'Asynchronous scene loading',
          'Object pooling system',
          'Memory management',
          'Loading screen integration',
          'Progress tracking',
        ],
      },
      {
        name: 'Scriptable Object Reset Tool',
        description: 'Build-time ScriptableObject value reset.',
        techStack: ['Unity Editor', 'C#', 'ScriptableObjects'],
        features: [
          'Value persistence tracking',
          'Build-time value reset',
          'Custom reset configurations',
          'Editor integration',
          'Value history management',
        ],
      },
      {
        name: 'Editor Snapping Tool',
        description: 'Precision placement and snapping in the editor.',
        techStack: ['Unity Editor', 'C#', 'Editor Tools'],
        features: [
          'Floor snapping',
          'Surface alignment',
          'Grid-based placement',
          'Custom snap points',
          'Editor integration',
        ],
      },
      {
        name: 'Dynamic Sound System',
        description: 'Audio management with dynamic mixing and spatial audio.',
        techStack: ['Unity', 'C#', 'Audio System'],
        features: [
          'Dynamic audio mixing',
          'Spatial audio implementation',
          'Interactive sound effects',
          'Audio pooling',
          'Custom audio package development',
        ],
      },
    ],
  },
];

const DEFAULT_PRIORITY = 999;

/** Sort by explicit priority (lower = higher placement). No alphabetical fallback. */
export function sortByPriority(projectList: Project[]): Project[] {
  return [...projectList].sort((a, b) => (a.priority ?? DEFAULT_PRIORITY) - (b.priority ?? DEFAULT_PRIORITY));
}

/** Split into sections: flagship cards → compact "also built" tiles → collapsed archive. */
export function getProjectsBySection(projectList: Project[]): {
  featured: Project[];
  professional: Project[];
  additional: Project[];
} {
  const sorted = sortByPriority(projectList);
  return {
    featured: sorted.filter((p) => p.tier === 'flagship'),
    professional: sorted.filter((p) => p.tier === 'also'),
    additional: sorted.filter((p) => !p.tier || p.tier === 'archive'),
  };
}

/** @deprecated Use sortByPriority or getProjectsBySection. Kept for compatibility. */
export function getSortedProjects(projectList: Project[]): Project[] {
  return sortByPriority(projectList);
}
