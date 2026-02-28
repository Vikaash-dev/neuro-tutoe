# NeuroTutor AI - Project TODO

## Phase 1: Core Infrastructure & Setup
- [x] Generate and configure app logo/branding
- [x] Update app.config.ts with app name and branding
- [x] Set up theme colors (Deep Blue, Emerald Green, etc.)
- [ ] Create base navigation structure (tab bar with icons)
- [x] Set up local storage (AsyncStorage) for user preferences and learning data
- [x] Create TypeScript types for learning concepts, memory states, and user data

## Phase 2: Essential Screens
- [x] Build Onboarding screen (learning style, depth level, baseline knowledge)
- [x] Build Home/Dashboard screen (learning streak, progress, recommendations)
- [ ] Build Topic Selection screen (search, filter, difficulty levels)
- [ ] Build AI Tutor Chat screen (conversation interface, message display)
- [ ] Build Settings screen (preferences, notifications, data management)

## Phase 3: Learning Engine
- [x] Implement Feynman Technique logic (4-step teaching approach)
- [x] Integrate AI tutor with Gemini API for explanations
- [x] Build misconception detection system
- [x] Create context-aware follow-up question generator
- [x] Implement step-by-step problem solving explanations

## Phase 4: Memory & Spaced Repetition
- [x] Create memory state tracking system (STM vs LTM)
- [x] Implement spaced repetition scheduler (1-day, 3-day, 7-day, 21-day intervals)
- [ ] Build Memory Dashboard screen (STM/LTM visualization)
- [x] Create concept mastery level calculator
- [x] Implement memory consolidation logic

## Phase 5: Active Recall & Assessment
- [x] Build Active Recall Quiz screen
- [x] Create quiz question generator (multiple choice, fill-in-blank, explain)
- [x] Implement adaptive quiz difficulty based on performance
- [x] Build quiz performance tracking
- [x] Create misconception detection from quiz answers

## Phase 6: Knowledge Graph
- [x] Design knowledge graph data structure (nodes, edges, relationships)
- [x] Build Knowledge Graph Visualization screen
- [x] Implement interactive graph rendering (zoom, pan, tap)
- [x] Create prerequisite and dependency tracking
- [x] Link concepts to related topics

## Phase 7: Teach-Back Feature
- [x] Build Teach-Back screen (explanation input)
- [x] Implement explanation analysis (accuracy, gaps, misconceptions)
- [x] Create corrected explanation generator
- [x] Track teach-back performance

## Phase 8: Progress & Analytics
- [x] Build Progress & Mastery screen (charts, milestones)
- [x] Create learning statistics (concepts mastered, study time, streaks)
- [ ] Implement achievement system
- [ ] Build progress visualization (charts over time)

## Phase 9: Polish & Optimization
- [ ] Add haptic feedback to interactions
- [ ] Implement smooth animations and transitions
- [ ] Optimize performance (lazy loading, caching)
- [ ] Add error handling and user feedback
- [ ] Test on iOS and Android devices

## Phase 10: Testing & Delivery
- [ ] End-to-end user flow testing
- [ ] Accessibility audit (WCAG compliance)
- [ ] Performance testing
- [ ] Bug fixes and refinements
- [ ] Create checkpoint and prepare for publishing

## Features by Priority

### Must-Have (MVP)
- [x] Project initialization
- [ ] Onboarding and home screens
- [ ] AI tutor chat with Feynman Technique
- [ ] Basic spaced repetition scheduling
- [ ] Active recall quizzes
- [ ] Memory dashboard (STM/LTM tracking)

### Should-Have
- [ ] Knowledge graph visualization
- [ ] Teach-back feature
- [ ] Progress tracking and analytics
- [ ] Settings and preferences
- [ ] Misconception detection

### Nice-to-Have
- [ ] Achievements and gamification
- [ ] Study streak notifications
- [ ] Export learning data
- [ ] Dark mode optimization
- [ ] Advanced analytics

## Technical Debt & Notes
- Use Gemini API for AI tutor responses (via server backend)
- Store all learning data locally with AsyncStorage initially
- Plan for future backend sync if needed
- Keep knowledge graph data structure flexible for expansion
- Document API contracts for AI tutor integration
