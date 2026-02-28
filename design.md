# NeuroTutor AI - Mobile App Design Document

## Overview

NeuroTutor AI is a neuroscience-backed AI tutor mobile app designed to help students achieve **superunderstanding** of topics through evidence-based learning principles. The app integrates:

- **Feynman Technique**: Teaching concepts in simple language to identify knowledge gaps
- **Spaced Repetition & Active Recall**: Strategic review intervals to strengthen long-term memory
- **Knowledge Graphs**: Visual representation of concept relationships and connections
- **Memory Separation**: Distinct tracking of short-term and long-term memory states
- **OpenHands Theory of Mind**: Adaptive tutoring that understands student mental models
- **DeepTutor Framework**: Multi-agent problem solving with step-by-step explanations

## Core Learning Science Principles

### 1. Feynman Technique (4 Steps)
- **Choose Concept**: Student selects a topic to learn
- **Teach Simply**: Student explains the concept in plain language
- **Identify Gaps**: AI identifies misconceptions and missing connections
- **Refine**: AI provides targeted explanations to fill gaps

### 2. Spaced Repetition Schedule
- **Initial Review**: 1 day after learning
- **Second Review**: 3 days after initial review
- **Third Review**: 7 days after second review
- **Long-term**: 21+ days for consolidation

### 3. Active Recall Mechanisms
- **Concept Quizzes**: AI generates questions based on learned material
- **Teach-Back**: Student explains concepts to AI tutor
- **Application Problems**: Real-world scenarios requiring concept application
- **Misconception Detection**: AI identifies and corrects false beliefs

### 4. Memory Systems
- **Short-term Memory (STM)**: Current session learning, concept definitions, immediate facts
- **Long-term Memory (LTM)**: Consolidated knowledge, deep understanding, transferable skills
- **Memory Consolidation**: Spaced repetition moves knowledge from STM → LTM

### 5. Knowledge Graph
- **Nodes**: Individual concepts (e.g., "photosynthesis", "ATP", "chloroplast")
- **Edges**: Relationships (e.g., "uses", "produces", "is-part-of")
- **Prior Knowledge**: Existing concepts student already understands
- **New Connections**: Links between new and known concepts

## Screen Architecture

### 1. **Onboarding Screen**
- **Purpose**: Establish baseline knowledge and learning preferences
- **Content**:
  - Welcome message explaining NeuroTutor's approach
  - Learning style preference (visual, verbal, kinesthetic)
  - Depth level selector (beginner → advanced)
  - Prior knowledge assessment (quick quiz on foundational concepts)
- **Functionality**:
  - Save preferences to local storage
  - Initialize knowledge graph with baseline concepts

### 2. **Home Screen (Dashboard)**
- **Purpose**: Central hub for learning activities
- **Content**:
  - Learning streak counter (consecutive days)
  - Today's learning goal progress
  - Recommended topics (based on spaced repetition schedule)
  - Recent sessions overview
  - Quick stats: Topics mastered, Current streak, Total study time
- **Functionality**:
  - Navigation to all major features
  - Visual progress indicators

### 3. **Topic Selection Screen**
- **Purpose**: Browse and select topics to learn
- **Content**:
  - Search bar for topic discovery
  - Category filters (Math, Science, History, Languages, etc.)
  - Difficulty levels (Beginner, Intermediate, Advanced)
  - Topic cards showing:
    - Topic name and brief description
    - Estimated learning time
    - Mastery level (if previously studied)
    - Prerequisite topics
- **Functionality**:
  - Search and filter topics
  - View topic prerequisites
  - Start new learning session

### 4. **AI Tutor Chat Screen**
- **Purpose**: Main learning interaction with AI tutor
- **Content**:
  - Chat conversation history
  - AI tutor responses with:
    - Explanations using Feynman Technique
    - Step-by-step problem solving
    - Visual diagrams/knowledge graph snippets
    - Related concept suggestions
  - Input area for student questions/responses
  - Session controls (pause, save, reset)
- **Functionality**:
  - Real-time AI responses
  - Context-aware follow-up questions
  - Misconception detection and correction
  - Save conversation history

### 5. **Knowledge Graph Visualization Screen**
- **Purpose**: Visual representation of concept relationships
- **Content**:
  - Interactive graph showing:
    - Central topic node (highlighted)
    - Connected concepts (prerequisite, related, advanced)
    - Color coding: Known (green), Learning (yellow), Mastered (blue)
    - Edge labels showing relationship types
  - Zoom and pan controls
  - Node details panel (tap to view concept summary)
- **Functionality**:
  - Tap nodes to jump to related topics
  - View concept prerequisites and dependencies
  - Understand concept relationships

### 6. **Memory Dashboard Screen**
- **Purpose**: Track short-term and long-term memory states
- **Content**:
  - **Short-term Memory Section**:
    - Concepts learned today
    - Concepts from current session
    - Estimated retention (%)
  - **Long-term Memory Section**:
    - Mastered concepts (consolidated)
    - Spaced repetition schedule
    - Next review dates
  - **Consolidation Progress**:
    - Timeline showing STM → LTM transition
    - Concepts ready for next review
- **Functionality**:
  - View memory state for each concept
  - See next review schedule
  - Trigger manual review sessions

### 7. **Active Recall Quiz Screen**
- **Purpose**: Test knowledge through active recall
- **Content**:
  - AI-generated questions based on:
    - Recently learned concepts
    - Spaced repetition schedule
    - Misconceptions detected in previous sessions
  - Question types:
    - Multiple choice
    - Fill-in-the-blank
    - Explain-in-your-own-words
    - Application problems
  - Feedback on answers
  - Explanation of correct answers
- **Functionality**:
  - Generate adaptive quizzes
  - Track quiz performance
  - Identify weak areas
  - Update memory states based on performance

### 8. **Teach-Back Screen**
- **Purpose**: Student explains concepts to AI (Feynman Technique)
- **Content**:
  - Prompt: "Explain [concept] as if teaching a 10-year-old"
  - Text input area for student explanation
  - AI analysis of explanation:
    - Accuracy assessment
    - Missing key points
    - Misconceptions detected
    - Suggestions for improvement
  - Corrected explanation from AI
- **Functionality**:
  - Capture student explanations
  - Analyze for misconceptions
  - Provide targeted feedback
  - Update understanding assessment

### 9. **Progress & Mastery Screen**
- **Purpose**: Track learning progress and mastery levels
- **Content**:
  - Mastery levels for each topic:
    - Novice (0-25%)
    - Intermediate (25-50%)
    - Proficient (50-75%)
    - Expert (75-100%)
  - Progress charts:
    - Concepts mastered over time
    - Study time distribution
    - Quiz performance trends
  - Achievements and milestones
  - Comparative metrics (optional)
- **Functionality**:
  - Visualize learning progress
  - Set mastery goals
  - Track consistency

### 10. **Settings Screen**
- **Purpose**: Customize learning experience
- **Content**:
  - Learning preferences:
    - Learning style (visual, verbal, kinesthetic)
    - Communication tone (encouraging, neutral, formal)
    - Explanation depth
  - Spaced repetition settings:
    - Custom review intervals
    - Daily review goal
    - Notification preferences
  - Data management:
    - Export learning data
    - Clear history
    - Reset progress
  - About and help
- **Functionality**:
  - Update preferences
  - Manage notifications
  - Export/import data

## Key User Flows

### Flow 1: Learning a New Topic
1. User opens app → Home screen
2. Taps "Learn New Topic" → Topic Selection screen
3. Searches/selects topic (e.g., "Photosynthesis")
4. Taps "Start Learning" → AI Tutor Chat screen
5. AI introduces topic using Feynman Technique
6. User asks questions or AI guides through concept
7. AI identifies gaps and provides targeted explanations
8. User completes initial learning session
9. Concept added to Short-term Memory
10. Spaced repetition schedule initiated

### Flow 2: Active Recall Review
1. User opens app → Home screen
2. Sees "Ready for Review" notification
3. Taps "Review" → Active Recall Quiz screen
4. Completes quiz on scheduled concepts
5. AI provides feedback and explanations
6. High performance → Concept moves toward LTM
7. Low performance → Concept scheduled for earlier review

### Flow 3: Teach-Back Session
1. User opens app → Home screen
2. Taps "Teach-Back" → Teach-Back screen
3. AI prompts: "Explain [concept] simply"
4. User types explanation
5. AI analyzes for misconceptions
6. AI provides corrected explanation
7. User understanding updated

### Flow 4: Viewing Knowledge Graph
1. User opens app → Home screen
2. Taps "Knowledge Graph" → Knowledge Graph Visualization screen
3. Views concept relationships
4. Taps related concept → Navigates to AI Tutor Chat for that concept
5. Understands how concepts connect

## Design Principles

### Mobile-First (Portrait 9:16)
- Single-handed usage optimized
- Thumb-friendly tap targets (minimum 44pt)
- Vertical scrolling for content
- Bottom navigation for primary actions

### iOS-Native Feel
- Clean, minimalist interface
- Consistent spacing and typography
- Native iOS components (tab bar, navigation)
- Smooth transitions and haptic feedback

### Accessibility
- High contrast text (WCAG AA compliant)
- Large readable fonts (minimum 16pt body text)
- Clear visual hierarchy
- Descriptive labels for all interactive elements

### Cognitive Load Reduction
- One primary action per screen
- Progressive disclosure (show details on demand)
- Clear visual feedback for all interactions
- Consistent mental models across screens

## Color Palette

- **Primary Brand**: Deep Blue (#0A7EA4) - Trust, learning, intelligence
- **Accent**: Emerald Green (#22C55E) - Success, mastery, growth
- **Background**: White (#FFFFFF) / Dark Gray (#151718)
- **Surface**: Light Gray (#F5F5F5) / Dark (#1E2022)
- **Text**: Dark Gray (#11181C) / Light Gray (#ECEDEE)
- **Success**: Green (#22C55E)
- **Warning**: Amber (#F59E0B)
- **Error**: Red (#EF4444)

## Memory Visualization

### Short-term Memory (Session)
- Concepts learned in current session
- Visual indicator: Yellow/Amber
- Retention estimate: 50-70%
- Action: Review in 1 day

### Long-term Memory (Consolidated)
- Concepts passed spaced repetition tests
- Visual indicator: Green/Blue
- Retention estimate: 85%+
- Action: Periodic review (21+ days)

## Next Steps

1. Implement core screens (Onboarding, Home, Topic Selection, AI Tutor Chat)
2. Build AI tutor engine with Feynman Technique logic
3. Implement spaced repetition scheduler
4. Add knowledge graph visualization
5. Create active recall quiz generator
6. Add teach-back analysis
7. Implement memory tracking system
8. Polish UI and add animations
9. Test end-to-end user flows
10. Optimize performance and accessibility
