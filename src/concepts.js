export const CONCEPTS = [
  {
    id: "docker-containers",
    name: "Docker Containers",
    category: "technology",
    difficulty: "beginner",
    description:
      "A lightweight way to package an application with its runtime, files, and dependencies so it can run consistently.",
    analogy:
      "A container is like a sealed lunchbox: the meal, utensils, and seasonings travel together, so lunch works the same at home, school, or work.",
    prerequisites: [],
    relatedConcepts: ["kubernetes-deployments", "devops-ci-cd"],
    keyPoints: [
      "Containers package an app with dependencies",
      "Images are templates and containers are running instances",
      "Containers share the host operating system kernel",
      "Port mapping exposes services from the container to the host",
      "Volumes persist data outside the container lifecycle",
    ],
    commonMisconceptions: [
      "Containers are the same as virtual machines",
      "Deleting a container always deletes every piece of data",
      "A Docker image changes automatically when a container changes",
    ],
    realWorldApplications: [
      "Local development environments",
      "Repeatable app deployments",
      "CI test runners",
      "Isolating service dependencies",
    ],
  },
  {
    id: "kubernetes-deployments",
    name: "Kubernetes Deployments",
    category: "technology",
    difficulty: "intermediate",
    description:
      "A Kubernetes object that declares how many copies of an app should run and how updates should roll out.",
    analogy:
      "A deployment is like a restaurant manager who keeps enough chefs on shift, replaces absent chefs, and changes the menu without closing the kitchen.",
    prerequisites: ["docker-containers"],
    relatedConcepts: ["devops-ci-cd"],
    keyPoints: [
      "A deployment manages replica sets and pods",
      "Desired state tells Kubernetes what should be running",
      "Rolling updates replace old pods gradually",
      "Health checks help Kubernetes restart unhealthy pods",
      "Services provide stable network access to changing pods",
    ],
    commonMisconceptions: [
      "A deployment is the same thing as a pod",
      "Kubernetes automatically fixes broken application code",
      "Scaling a deployment also scales the database safely",
    ],
    realWorldApplications: [
      "Zero-downtime web deployments",
      "Scaling stateless services",
      "Self-healing app infrastructure",
      "Progressive delivery",
    ],
  },
  {
    id: "devops-ci-cd",
    name: "CI/CD Pipelines",
    category: "technology",
    difficulty: "beginner",
    description:
      "An automated path that builds, tests, and deploys code changes so teams can ship reliably.",
    analogy:
      "A pipeline is like an airport security line for code: every change passes checkpoints before it reaches production.",
    prerequisites: [],
    relatedConcepts: ["docker-containers", "kubernetes-deployments"],
    keyPoints: [
      "Continuous integration runs checks whenever code changes",
      "Continuous delivery prepares safe releases",
      "Automated tests catch regressions early",
      "Artifacts are versioned build outputs",
      "Deployment gates reduce production risk",
    ],
    commonMisconceptions: [
      "CI/CD means every commit must go straight to production",
      "A passing pipeline proves the software has no bugs",
      "Manual testing is never needed after automation exists",
    ],
    realWorldApplications: [
      "GitHub Actions workflows",
      "Release automation",
      "Preview deployments",
      "Compliance evidence trails",
    ],
  },
  {
    id: "photosynthesis",
    name: "Photosynthesis",
    category: "science",
    difficulty: "intermediate",
    description:
      "The process plants use to convert light energy, water, and carbon dioxide into glucose and oxygen.",
    analogy:
      "A leaf is like a tiny solar kitchen: sunlight powers the recipe, carbon dioxide and water are ingredients, and glucose is the stored food.",
    prerequisites: ["light-energy", "glucose"],
    relatedConcepts: ["cellular-respiration", "chloroplast"],
    keyPoints: [
      "Photosynthesis happens mainly in chloroplasts",
      "It requires light energy, water, and carbon dioxide",
      "It produces glucose and oxygen",
      "Light-dependent reactions capture energy",
      "The Calvin cycle builds sugar molecules",
    ],
    commonMisconceptions: [
      "Plants get their energy from soil",
      "Photosynthesis and respiration are the same process",
      "Plants only need sunlight and do not need water",
    ],
    realWorldApplications: [
      "Crop growth",
      "Climate carbon cycles",
      "Biofuel research",
      "Artificial photosynthesis",
    ],
  },
  {
    id: "cellular-respiration",
    name: "Cellular Respiration",
    category: "science",
    difficulty: "intermediate",
    description:
      "The process cells use to break down glucose and capture usable energy as ATP.",
    analogy:
      "Cellular respiration is like slowly burning a log in a controlled stove instead of letting all the energy flash out at once.",
    prerequisites: ["glucose", "atp"],
    relatedConcepts: ["photosynthesis"],
    keyPoints: [
      "Cells break down glucose to release energy",
      "ATP stores usable energy for cell work",
      "Aerobic respiration uses oxygen",
      "Mitochondria perform much of aerobic respiration",
      "Glycolysis starts the process in the cytoplasm",
    ],
    commonMisconceptions: [
      "Only animals perform cellular respiration",
      "Respiration is the same as breathing",
      "All cellular respiration requires oxygen",
    ],
    realWorldApplications: [
      "Exercise physiology",
      "Metabolism",
      "Fermentation",
      "Mitochondrial disease",
    ],
  },
  {
    id: "light-energy",
    name: "Light Energy",
    category: "science",
    difficulty: "beginner",
    description:
      "Energy carried by electromagnetic radiation, including the visible light plants use.",
    analogy:
      "Light is like a stream of tiny packets that can deliver energy when something absorbs them.",
    prerequisites: [],
    relatedConcepts: ["photosynthesis"],
    keyPoints: [
      "Light behaves like waves and particles",
      "Different wavelengths carry different energies",
      "Visible light is one part of the electromagnetic spectrum",
      "Pigments absorb some wavelengths better than others",
    ],
    commonMisconceptions: [
      "All colors of light have the same energy",
      "Plants use every color of light equally",
      "Light is not a form of energy",
    ],
    realWorldApplications: ["Solar panels", "Plant grow lights", "Photography"],
  },
  {
    id: "glucose",
    name: "Glucose",
    category: "science",
    difficulty: "beginner",
    description:
      "A simple sugar that cells can break down to release energy.",
    analogy:
      "Glucose is like a rechargeable battery molecule that living things can store, move, and use.",
    prerequisites: [],
    relatedConcepts: ["photosynthesis", "cellular-respiration", "atp"],
    keyPoints: [
      "Glucose is a simple carbohydrate",
      "It has the formula C6H12O6",
      "Plants make glucose during photosynthesis",
      "Cells break down glucose during respiration",
    ],
    commonMisconceptions: [
      "All sugars behave exactly the same way",
      "Glucose is only found in fruit",
      "Glucose is always harmful",
    ],
    realWorldApplications: ["Blood sugar", "Sports nutrition", "Food webs"],
  },
  {
    id: "atp",
    name: "ATP",
    category: "science",
    difficulty: "intermediate",
    description:
      "Adenosine triphosphate, the small molecule cells use as a direct energy currency.",
    analogy:
      "ATP is like a rechargeable coin the cell spends for tiny jobs and recharges again and again.",
    prerequisites: ["glucose"],
    relatedConcepts: ["cellular-respiration"],
    keyPoints: [
      "ATP transfers energy inside cells",
      "Energy is released when a phosphate bond is broken",
      "ATP is constantly recycled",
      "Many cell processes require ATP",
    ],
    commonMisconceptions: [
      "ATP is used only once",
      "ATP is produced only in mitochondria",
      "Cells store all long-term energy as ATP",
    ],
    realWorldApplications: ["Muscle movement", "Active transport", "Nerve signaling"],
  },
  {
    id: "neural-networks",
    name: "Neural Networks",
    category: "technology",
    difficulty: "intermediate",
    description:
      "A machine learning model made of connected layers that learn patterns from examples.",
    analogy:
      "A neural network is like a team of filters: early filters notice simple clues, later filters combine those clues into bigger judgments.",
    prerequisites: [],
    relatedConcepts: ["devops-ci-cd"],
    keyPoints: [
      "Neural networks learn weights from data",
      "Layers transform inputs into useful representations",
      "Training reduces prediction error",
      "Overfitting happens when a model memorizes instead of generalizing",
      "Validation data estimates performance on new examples",
    ],
    commonMisconceptions: [
      "Neural networks think exactly like human brains",
      "More layers always make a model better",
      "High training accuracy always means the model is good",
    ],
    realWorldApplications: [
      "Image recognition",
      "Language models",
      "Recommendation systems",
      "Anomaly detection",
    ],
  },
];

export const CONCEPT_MAP = Object.fromEntries(CONCEPTS.map((concept) => [concept.id, concept]));

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function getConceptById(id) {
  return CONCEPT_MAP[id] || CONCEPTS[0];
}

export function createCustomConcept(topic) {
  const cleanTopic = String(topic || "New Topic").trim() || "New Topic";
  const id = `custom-${slugify(cleanTopic) || Date.now()}`;

  return {
    id,
    name: cleanTopic,
    category: "other",
    difficulty: "beginner",
    description: `${cleanTopic} is a custom topic. The tutor will help you break it into plain-language parts, examples, checks, and misconceptions.`,
    analogy:
      "Treat the topic like a machine on a table: first name the parts, then show how each part changes the next one.",
    prerequisites: [],
    relatedConcepts: [],
    keyPoints: [
      `Define ${cleanTopic} in one plain sentence`,
      "Name the main parts or steps",
      "Explain why it matters",
      "Give one real example",
    ],
    commonMisconceptions: [
      `Confusing the name ${cleanTopic} with true understanding`,
      "Skipping prerequisites",
      "Memorizing terms without examples",
    ],
    realWorldApplications: ["Problem solving", "Teaching another person", "Connecting ideas"],
    custom: true,
  };
}
