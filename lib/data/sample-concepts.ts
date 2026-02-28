/**
 * Sample Concepts Data
 * Pre-loaded concepts for demonstration and testing
 */

import { Concept } from "@/lib/types/learning";

export const SAMPLE_CONCEPTS: Concept[] = [
  {
    id: "photosynthesis",
    name: "Photosynthesis",
    description:
      "The process by which plants convert light energy into chemical energy stored in glucose",
    category: "science",
    difficulty: "intermediate",
    prerequisites: ["cellular-respiration", "light-energy"],
    relatedConcepts: ["chloroplast", "glucose", "oxygen", "carbon-dioxide"],
    keyPoints: [
      "Occurs in chloroplasts",
      "Requires light energy, water, and carbon dioxide",
      "Produces glucose and oxygen",
      "Light-dependent and light-independent reactions",
      "Occurs mainly in leaves",
    ],
    commonMisconceptions: [
      "Plants get energy from soil",
      "Photosynthesis and respiration are the same",
      "Only leaves perform photosynthesis",
      "Plants only need sunlight, not water",
    ],
    realWorldApplications: [
      "Biofuel production",
      "Crop optimization",
      "Climate change mitigation",
      "Artificial photosynthesis research",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "cellular-respiration",
    name: "Cellular Respiration",
    description: "The process by which cells break down glucose to produce ATP energy",
    category: "science",
    difficulty: "intermediate",
    prerequisites: ["glucose", "atp"],
    relatedConcepts: ["mitochondria", "aerobic", "anaerobic", "photosynthesis"],
    keyPoints: [
      "Occurs in mitochondria",
      "Breaks down glucose for energy",
      "Produces ATP molecules",
      "Aerobic and anaerobic pathways",
      "Glycolysis, Krebs cycle, electron transport chain",
    ],
    commonMisconceptions: [
      "Only animals perform cellular respiration",
      "Respiration is the same as breathing",
      "Cells don't need energy",
      "All respiration requires oxygen",
    ],
    realWorldApplications: [
      "Understanding metabolism",
      "Exercise physiology",
      "Disease treatment",
      "Athletic performance",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "light-energy",
    name: "Light Energy",
    description: "Electromagnetic radiation that provides energy for photosynthesis",
    category: "science",
    difficulty: "beginner",
    prerequisites: [],
    relatedConcepts: ["photosynthesis", "wavelength", "photons"],
    keyPoints: [
      "Light travels in waves",
      "Different wavelengths have different energies",
      "Visible light spectrum",
      "Chlorophyll absorbs specific wavelengths",
      "Light energy is converted to chemical energy",
    ],
    commonMisconceptions: [
      "All light is the same",
      "Plants use all colors of light equally",
      "Light is not energy",
    ],
    realWorldApplications: [
      "Solar energy",
      "Lighting design",
      "Photography",
      "Renewable energy",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "glucose",
    name: "Glucose",
    description: "A simple sugar that serves as the primary energy source for cells",
    category: "science",
    difficulty: "beginner",
    prerequisites: [],
    relatedConcepts: ["carbohydrates", "cellular-respiration", "photosynthesis"],
    keyPoints: [
      "Simple monosaccharide sugar",
      "Primary energy source for cells",
      "Produced by photosynthesis",
      "Broken down by cellular respiration",
      "Chemical formula: C6H12O6",
    ],
    commonMisconceptions: [
      "Glucose is only in fruits",
      "All sugars are the same",
      "Glucose is bad for you in all amounts",
    ],
    realWorldApplications: [
      "Diabetes management",
      "Sports nutrition",
      "Food production",
      "Medical diagnostics",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "atp",
    name: "ATP (Adenosine Triphosphate)",
    description: "The primary energy currency of cells",
    category: "science",
    difficulty: "intermediate",
    prerequisites: ["glucose"],
    relatedConcepts: ["cellular-respiration", "energy", "mitochondria"],
    keyPoints: [
      "Molecule that stores and transfers energy",
      "Consists of adenosine and three phosphate groups",
      "Energy released when phosphate bonds break",
      "Recycled thousands of times per day",
      "Essential for all cellular processes",
    ],
    commonMisconceptions: [
      "ATP is produced only in mitochondria",
      "ATP is used only once",
      "All energy in cells comes from ATP",
    ],
    realWorldApplications: [
      "Understanding fatigue",
      "Athletic performance",
      "Disease mechanisms",
      "Drug development",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "mitochondria",
    name: "Mitochondria",
    description: "Cellular organelle responsible for energy production through respiration",
    category: "science",
    difficulty: "intermediate",
    prerequisites: ["cellular-respiration"],
    relatedConcepts: ["atp", "cellular-respiration", "chloroplast"],
    keyPoints: [
      "Powerhouse of the cell",
      "Contains inner and outer membranes",
      "Site of ATP production",
      "Has its own DNA",
      "Inherited maternally in humans",
    ],
    commonMisconceptions: [
      "Mitochondria are only in animal cells",
      "Mitochondria only produce ATP",
      "Mitochondria are always spherical",
    ],
    realWorldApplications: [
      "Genetic inheritance",
      "Mitochondrial diseases",
      "Aging research",
      "Energy metabolism",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "chloroplast",
    name: "Chloroplast",
    description: "Cellular organelle where photosynthesis occurs",
    category: "science",
    difficulty: "intermediate",
    prerequisites: ["photosynthesis"],
    relatedConcepts: ["photosynthesis", "light-energy", "chlorophyll"],
    keyPoints: [
      "Site of photosynthesis",
      "Contains chlorophyll pigment",
      "Double membrane structure",
      "Contains thylakoids and stroma",
      "Found in plant cells and some protists",
    ],
    commonMisconceptions: [
      "Only leaves have chloroplasts",
      "Chloroplasts are only green",
      "All plant cells have chloroplasts",
    ],
    realWorldApplications: [
      "Crop improvement",
      "Biofuel development",
      "Climate research",
      "Food production",
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const CONCEPT_MAP: Record<string, Concept> = SAMPLE_CONCEPTS.reduce(
  (map, concept) => {
    map[concept.id] = concept;
    return map;
  },
  {} as Record<string, Concept>
);
