"""Portfolio content, taken from Ahmad Naeem's CV (Nov 2026). Shared by every concept."""

PERSON = {
    "name": "Ahmad Naeem",
    "short": "ahmad",
    "role": "Senior Software Engineer",
    "focus": "Full-stack and React Native",
    "location": "Lahore, Pakistan",
    "email": "mankhokhar1@gmail.com",
    "linkedin": "https://www.linkedin.com/in/ahmadnaeemk",
    "linkedin_label": "linkedin.com/in/ahmadnaeemk",
    "github": "https://github.com/AhmadNaeemK",
    "github_label": "github.com/AhmadNaeemK",
    "cv": "Ahmad_Naeem_CV.pdf",
    "intro": (
        "I take mobile and web products for startups from idea to production, "
        "and I work as the client's technical point of contact along the way."
    ),
}

ABOUT = [
    "I'm a senior full-stack engineer with more than five years of shipping React Native and web products. "
    "I like being the person who turns a fuzzy requirement into a plan, then a release, and I'm usually the one "
    "the client calls when scope, trade-offs or architecture need a decision. I work AI-first.",
    "Away from the editor I sketch people, write the occasional bit of Urdu poetry, and play a lot of games. "
    "My favourite game of all time is Sekiro: Shadows Die Twice. Dying, learning the pattern and trying again "
    "is also roughly how I debug.",
    "Talk to me about spirituality, life, or tell me a story.",
]

FACTS = [
    ("5+", "years shipping products"),
    ("4", "React Native apps on both stores"),
]

EXPERIENCE = [
    {
        "title": "Senior Software Engineer",
        "org": "Arbisoft",
        "start": "Jul 2024",
        "end": "Present",
        "points": [
            "Built an AI development workflow in Claude Code where planner, builder, tester and reviewer agents take code through gated plan, build, test and commit steps, with a person approving each gate.",
            "Lead developer and client-facing technical contact on Gumdrop, Lola and Crush, turning client requirements into technical plans and releases.",
            "Shipped four React Native apps to the App Store and Google Play, plus a Next.js and Django SaaS product.",
            "Set up testing, CI/CD and code review on Lola and Gumdrop, and mentored a trainee developer on the Lola team.",
        ],
    },
    {
        "title": "Software Engineer",
        "org": "Arbisoft",
        "start": "Jul 2021",
        "end": "Jul 2024",
        "points": [
            "Built and released React Native apps for US startup clients. Promoted to Senior Software Engineer in July 2024.",
        ],
    },
]

EDUCATION = {
    "degree": "Bachelor of Engineering in Software Engineering",
    "school": "National University of Sciences and Technology (NUST), SEECS",
    "place": "Islamabad, Pakistan",
    "start": "Sep 2017",
    "end": "Jul 2021",
}

PROJECTS = [
    {
        "id": "gumdrop", "name": "Gumdrop", "mono": "G", "color": "tomato",
        "blurb": "AI-powered meeting scheduling and analytics platform.",
        "role": "Full-stack engineer", "dates": "Jun 2025 – Present",
        "points": [
            "Internal LLM prompt-testing tool for models, agents, prompts and transcripts, with live WebSocket results.",
            "Stripe subscription billing end to end, with webhooks made safe against duplicate and out-of-order delivery.",
            "Group scheduling polls, from voting grids to booking the chosen time.",
            "Cut CI from 30 to 6 minutes with sharding, added Playwright E2E tests, and removed 51K lines of dead code.",
        ],
        "tech": ["Next.js", "TypeScript", "TanStack Query", "MUI", "Django", "Celery", "Stripe", "AWS"],
    },
    {
        "id": "lola", "name": "Lola", "mono": "L", "color": "plum",
        "blurb": "Dating app built around post-date feedback.",
        "role": "Frontend lead, team of four", "dates": "Apr 2023 – Apr 2025",
        "points": [
            "App foundation on Redux Toolkit and React Navigation, with an Axios layer that refreshes an expired CSRF token, replays the request and coalesces duplicates.",
            "Real-time chat over Server-Sent Events with typing indicators, plus push notifications.",
            "CodePush over-the-air updates with a forced-update check; analytics through Segment, Amplitude and Branch.io.",
            "Audit-logged admin tools in the Go and gRPC backend so support could fix user details without engineers.",
        ],
        "tech": ["React Native", "TypeScript", "Redux Toolkit", "Firebase", "Go", "gRPC", "Vue"],
    },
    {
        "id": "crush", "name": "Crush", "mono": "C", "color": "marigold",
        "blurb": "Anonymous matching with people in your phone contacts.",
        "role": "Sole developer", "dates": "Oct 2023 – Jul 2024",
        "points": [
            "Built the core iOS and Android product in two months and shipped three releases.",
            "Matching logic in Firebase Cloud Functions: a Firestore trigger detects mutual likes and notifies both people.",
            "Contact syncing with phone-number normalization, so people match however a number is saved.",
        ],
        "tech": ["React Native", "TypeScript", "Firebase Cloud Functions", "Node.js"],
    },
    {
        "id": "funcontact", "name": "FunContact", "mono": "F", "color": "teal",
        "blurb": "QR codes for sharing your contact details.",
        "role": "Main developer", "dates": "Mar 2022 – Mar 2025",
        "points": [
            "QR code creation for name, email, phone, address and social profiles, from the first project setup.",
            "Maintained and released the app on the App Store and Google Play.",
        ],
        "tech": ["React Native"],
    },
    {
        "id": "reki", "name": "Reki TV", "mono": "R", "color": "cobalt",
        "blurb": "Social recommendations for movies and shows.",
        "role": "Mobile developer", "dates": "May 2022 – Dec 2024",
        "points": [
            "Friends' recommendation lists with comments, sharing and saving to your own list.",
            "Screen animations, and large screens split into smaller components to cut re-renders.",
        ],
        "tech": ["React Native"],
    },
]

SKILLS = [
    ("Languages", ["TypeScript", "JavaScript", "Python", "Go", "SQL"]),
    ("Mobile and web", ["React Native", "Expo", "React", "Next.js", "Redux Toolkit", "TanStack Query", "Tailwind CSS", "Vue"]),
    ("Backend", ["Node.js", "Django", "Django REST Framework", "Celery", "PostgreSQL", "Redis", "gRPC"]),
    ("Integrations", ["Stripe", "WebSockets", "Server-Sent Events", "Firebase", "Segment", "Amplitude"]),
    ("Testing and delivery", ["Jest", "React Testing Library", "Playwright", "pytest", "GitHub Actions", "AWS", "App Store Connect"]),
    ("AI tools", ["Claude Code", "Cursor"]),
]

NAV = [("about", "About"), ("work", "Work"), ("projects", "Projects"), ("skills", "Skills"), ("contact", "Contact")]

LIVERY_ORDER = ["metro", "bullet", "steam", "heritage", "toy"]
LIVERY_NAMES = {"metro": "Metro", "bullet": "Bullet train", "steam": "Steam engine", "heritage": "Crimson express", "toy": "Toy train"}

# A short line about what I'm into right now. Edit freely; the ticker repeats it to fill the width.
NOW = [
    ("Playing", "Marvel's Spider-Man Remastered"),
    ("Building", "this train-themed portfolio"),
]
