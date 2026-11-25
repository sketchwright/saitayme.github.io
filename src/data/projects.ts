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
}

export const projects: Project[] = [
  // —— Tier 1: Featured / Professional ——
  {
    id: 'mayhem-a-la-carte',
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
    tags: ['Game Marketing', 'Social Media', 'Creator Outreach', 'Web', 'Trailer VO'],
    projectType: 'Professional',
    role: 'Marketing Engineer',
    company: 'Ingame Studios',
    timeframe: '2026–now',
    featured: true,
    priority: 1.5,
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
    title: 'IGS Outreach',
    description: 'A creator-outreach platform I designed and built for Ingame Studios. Every streamer and YouTuber we work with lives in one searchable database that hydrates itself daily from the Twitch and YouTube APIs, so follower counts and stats are always current. It plugs into Outlook through Microsoft Entra: it sends personalised HTML mail campaigns with tokens and multiple copy variants, throttles sends in irregular steps with per-minute, hour and day caps to stay out of spam folders, detects replies and asks you to rate them. After a campaign it asks what the creator actually made and stores the links, and that feedback powers recommendations for similar creators.',
    shortDescription: 'Influencer CRM + mail engine: live Twitch/YouTube data, throttled personalised campaigns, reply tracking, recommendations.',
    thumbnail: '/projects/igs-outreach.svg',
    category: 'Marketing',
    tags: ['Marketing Engineering', 'Twitch API', 'YouTube API', 'Microsoft Graph', 'Full-stack'],
    projectType: 'Tool',
    role: 'Marketing Engineer',
    company: 'Ingame Studios',
    timeframe: '2026',
    featured: true,
    priority: 2.5,
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
    title: 'Recipe Data Pipeline',
    description: 'In Mayhem À La Carte every dish is a chain of steps: bun, bun + patty, bun + patty + tomato, and so on. Design keeps all recipes in a Confluence table. I built the Unreal tooling that takes the exported CSV and generates the recipe data assets, including every intermediate step, with one click. The game’s whole cooking logic runs on the assets this pipeline creates.',
    shortDescription: 'One-click CSV → Unreal recipe assets, generating every intermediate cooking step automatically.',
    thumbnail: '/projects/mayhem/shot-03.jpg',
    category: 'Unreal Engine',
    tags: ['Tools', 'Data Pipeline', 'Data Assets', 'C++', 'Editor Scripting'],
    projectType: 'Professional',
    role: 'Tools Programmer',
    company: 'Ingame Studios · Mayhem À La Carte',
    timeframe: '2026',
    featured: true,
    priority: 3.2,
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
    priority: 7,
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
    title: 'Agentic Content Pipeline',
    description: 'An AI-assisted content workflow I built with Claude: it transcribes multi-hour livestreams, samples frames every few seconds, and finds the strongest moments from what is said and what is on screen. I review the picks in a queue; approved clips get platform-specific copy written and are scheduled and posted automatically. The human directs and reviews, the pipeline does the grind.',
    shortDescription: 'Stream → clips → copy → scheduled posts. AI does the grind, a human approves every step.',
    thumbnail: '/projects/agentic-pipeline.svg',
    category: 'Marketing',
    tags: ['AI Agents', 'Automation', 'Speech-to-text', 'Social Media'],
    projectType: 'Tool',
    role: 'Marketing Engineer',
    timeframe: '2026',
    priority: 7.5,
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
    title: 'Crime Boss ModKit Docs',
    description: 'Built and wrote the public documentation site for the official Crime Boss: Rockay City ModKit: guides for missions, teammates and bosses, Rockay Rumble maps and equipment, linked to my tutorial video series.',
    shortDescription: 'The public ModKit documentation site, plus the tutorial series it links to.',
    thumbnail: '/projects/crimeboss-modkit.png',
    category: 'Marketing',
    tags: ['Docs', 'Community', 'Modding', 'Web'],
    projectType: 'Professional',
    role: 'Author',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    priority: 8,
    impact: ['Public modding guide for the ModKit', 'Paired with 11+ tutorial videos'],
    demoUrl: 'https://igstudios.atlassian.net/wiki/spaces/CBMK',
    systems: [
      {
        name: 'ModKit Documentation',
        description: 'Step-by-step guides for modders without source access.',
        techStack: ['Confluence', 'Video tutorials'],
        features: ['Mission creation', 'Custom bosses & teammates', 'Rockay Rumble maps', 'Weapons & skins'],
      },
    ],
  },
  {
    id: 'network-session-kit',
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
    featured: true,
    priority: 3.6,
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
    title: 'Crime Boss: Rockay City',
    description: 'Worked as a Gameplay Programmer on Crime Boss: Rockay City, fixing gameplay, UI, and replication issues across a large Unreal codebase. Contributed over 50 bug fixes included in Update 20.',
    shortDescription: 'Gameplay programmer on shipped Unreal title; 50+ bug fixes in Update 20, replication and UI work.',
    thumbnail: '/projects/crimeboss.png',
    category: 'Unreal Engine',
    tags: ['Gameplay Programming', 'Bug Fixing', 'Replication', 'UI', 'Production'],
    projectType: 'Professional',
    role: 'Gameplay Programmer',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    featured: true,
    priority: 1,
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
    title: 'Crime Boss Official Modkit',
    description: 'Contributed to the official Crime Boss modkit by refactoring gameplay systems to be Blueprint-extensible and DataTable-driven, enabling meaningful mod support without source code access.',
    shortDescription: 'Refactored gameplay for Blueprint/DataTable moddability; Rockay Rumble and custom boss support.',
    thumbnail: '/projects/crimeboss-modkit.png',
    category: 'Unreal Engine',
    tags: ['Modding', 'Tools', 'Blueprint Architecture', 'Data-Driven Design'],
    projectType: 'Professional',
    role: 'Gameplay / Systems Programmer',
    company: 'Ingame Studios',
    timeframe: '2025–2026',
    featured: true,
    priority: 2,
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
    title: 'Unreal Multiplayer Framework',
    description: 'Designed and implemented the reusable multiplayer subsystem behind Mayhem À La Carte’s 4-player co-op, built on EOS. It wraps session creation, lobby flow, player registration and dedicated server workflows into gameplay-facing Unreal subsystems.',
    shortDescription: 'The EOS multiplayer subsystem behind Mayhem À La Carte’s co-op: sessions, lobbies, dedicated servers.',
    thumbnail: '/projects/mayhem/shot-04.jpg',
    category: 'Unreal Engine',
    tags: ['Multiplayer', 'EOS', 'Networking', 'Subsystems', 'C++'],
    projectType: 'Professional',
    role: 'Systems Programmer',
    company: 'Ingame Studios · Mayhem À La Carte',
    timeframe: '2025–2026',
    featured: true,
    priority: 3,
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
    title: 'NOK - Advanced Sound System',
    description: 'Built a reusable sound system for NOK (physics-based sandbox hidden object game) with dynamic mixing, spatial audio, and interactive effects—later folded into the BaboonWorks package for use across projects.',
    shortDescription: 'Dynamic mixing, spatial audio, and interactive SFX; part of BaboonWorks package.',
    thumbnail: '/projects/nok.png',
    category: 'Unity',
    tags: ['Audio Programming', 'Game Development', 'Unity Package'],
    projectType: 'Professional',
    role: 'Gameplay / Tools',
    company: 'Nerd Monkeys',
    featured: true,
    priority: 4,
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
    title: 'Cognition - Red Cross Project',
    description: 'Implemented puzzle and session logic for an educational title commissioned by the Portuguese Red Cross, aimed at cognitive training and elderly care. Shipped custom pipe puzzle mechanics and session tracking.',
    shortDescription: 'Educational title for Portuguese Red Cross; puzzle design and session tracking.',
    thumbnail: '/projects/cognition.jpg',
    category: 'Unity',
    tags: ['Educational', 'Healthcare', 'Puzzle Design'],
    projectType: 'Professional',
    role: 'Gameplay Programmer',
    company: 'Nerd Monkeys',
    featured: true,
    priority: 5,
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
    priority: 8.5,
    title: 'Advanced Scene Loader',
    description: 'Built a reusable Unity scene loading system with asynchronous loading, object pooling, and progress tracking to support smoother transitions and more controlled memory usage. Part of BaboonWorks.',
    shortDescription: 'Async loading, pooling, and progress tracking for smoother level transitions.',
    thumbnail: '/projects/nerd-monkeys.png',
    category: 'Unity',
    tags: ['Tool Development', 'Performance', 'Memory Management'],
    projectType: 'Professional',
    role: 'Tools / Systems',
    company: 'Nerd Monkeys',
    featured: true,
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
    priority: 7,
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
    priority: 8,
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
    priority: 9,
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
    priority: 10,
    title: 'Broken Glass',
    description: 'Anti-drug PSA game in Unreal: branching narrative and PSX-style presentation. Explores substance abuse and consequences; includes content warnings and careful tone handling.',
    shortDescription: 'Unreal narrative game; branching story, PSX aesthetic, serious subject matter.',
    thumbnail: '/projects/broken-glass.jpg',
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
    priority: 11,
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
    priority: 12,
    title: 'Five Nights at Furbys',
    description: 'Hagenberg Game Jam horror game: Furbys in a Five Nights–style setup. Implemented AI pathfinding and behavior trees for tension and variety.',
    shortDescription: 'FNAF-style horror with Furby AI; pathfinding and behavior trees.',
    thumbnail: '/projects/furbys.jpg',
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

/** Split into sections for narrative order: Featured → Professional → Additional. */
export function getProjectsBySection(projectList: Project[]): {
  featured: Project[];
  professional: Project[];
  additional: Project[];
} {
  const sorted = sortByPriority(projectList);
  const featured: Project[] = [];
  const professional: Project[] = [];
  const additional: Project[] = [];
  for (const p of sorted) {
    const pri = p.priority ?? DEFAULT_PRIORITY;
    if (pri < 7) featured.push(p);
    else if (pri < 10) professional.push(p);
    else additional.push(p);
  }
  return { featured, professional, additional };
}

/** @deprecated Use sortByPriority or getProjectsBySection. Kept for compatibility. */
export function getSortedProjects(projectList: Project[]): Project[] {
  return sortByPriority(projectList);
}
