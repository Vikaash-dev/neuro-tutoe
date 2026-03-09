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
- [x] Build Topic Selection screen (search, filter, difficulty levels)
- [x] Build AI Tutor Chat screen (conversation interface, message display)
- [x] Build Settings screen (preferences, notifications, data management)

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

## Phase 10: Topic Selection & Discovery
- [x] Build Topic Selection screen with category browsing
- [x] Implement topic search and filtering
- [x] Add prerequisite visualization
- [x] Create topic difficulty levels
- [x] Show topic mastery progress

## Phase 11: Settings & Preferences
- [x] Build Settings screen with tabs
- [x] Implement notification preferences
- [x] Add spaced repetition customization
- [x] Create data export functionality
- [x] Add user profile management

## Phase 12: Backend Integration
- [x] Set up database schema for learning data
- [x] Implement user authentication
- [x] Create API endpoints for data sync
- [x] Add cross-device synchronization
- [x] Implement data persistence

## Phase 13: Tab Navigation
- [x] Update tab bar with all screens
- [x] Add icon mappings for new screens
- [x] Implement navigation flow
- [x] Add deep linking support
- [x] Test all navigation paths

## Phase 14: Testing & Delivery
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


## Phase 15: User Authentication & Cloud Sync
- [x] Implement Manus OAuth login flow
- [x] Create login/logout screens
- [x] Set up secure token storage
- [x] Implement protected API routes
- [x] Add user profile management
- [x] Sync learning data to cloud database
- [x] Handle offline-first data sync

## Phase 16: Advanced Analytics Dashboard
- [x] Create analytics dashboard screen
- [x] Add learning velocity charts (Plotly/Chart.js)
- [x] Implement mastery progress visualization
- [x] Add concept difficulty heatmap
- [x] Create study time analytics
- [x] Build skill transfer analysis
- [x] Add export analytics as PDF/CSV

## Phase 17: Adaptive Difficulty Engine
- [x] Implement real-time performance tracking
- [x] Create adaptive quiz difficulty algorithm
- [x] Build concept prerequisite validation
- [x] Implement dynamic explanation depth
- [x] Add personalized learning paths
- [x] Create difficulty progression logic
- [x] Test with sample student data

## Phase 18: Enhanced AI Features
- [x] Improve misconception detection accuracy
- [x] Add context-aware follow-up questions
- [x] Implement Socratic dialogue system
- [x] Create personalized explanation generation
- [x] Add learning style adaptation
- [x] Implement error pattern recognition
- [x] Build knowledge gap analysis

## Phase 19: Gamification & Achievements
- [x] Design achievement system (badges, milestones)
- [x] Create achievement unlock logic
- [x] Build achievement display screen
- [x] Implement streak notifications
- [x] Add leaderboard (optional)
- [x] Create reward system
- [x] Add celebration animations

## Phase 20: Frontend Testing & Button Fixes
- [x] Diagnose unresponsive button issues
- [x] Fix Pressable/TouchableOpacity styling
- [x] Test all navigation buttons
- [x] Test form submissions
- [x] Test API integration buttons
- [x] Verify haptic feedback works
- [x] Test all interactive elements

## Phase 21: Web App Conversion
- [ ] Configure Expo Web build
- [ ] Test responsive design on desktop
- [ ] Fix web-specific issues
- [ ] Test all screens on web
- [ ] Verify API calls work on web
- [ ] Test local storage on web
- [ ] Deploy web app

## Phase 22: Mobile Testing & Optimization
- [ ] Build Android APK
- [ ] Build iOS IPA
- [ ] Test on physical devices
- [ ] Optimize performance (bundle size, load time)
- [ ] Fix platform-specific issues
- [ ] Test offline functionality
- [ ] Validate all user flows

## Phase 21: Final Polish & Deployment
- [ ] Code review and cleanup
- [ ] Security audit
- [ ] Performance profiling
- [ ] Accessibility testing
- [ ] Documentation update
- [ ] Create deployment guide
- [ ] Final checkpoint and publish


## CRITICAL ISSUES TO FIX

### Navigation & Routing
- [x] Fix tab bar navigation - buttons not working properly
- [x] Fix screen routing between all tabs
- [x] Ensure deep linking works correctly
- [x] Fix navigation stack issues

### Button & Interaction Issues
- [x] Fix "Start New Learning Session" button
- [x] Fix all quiz buttons (submit, next, etc)
- [x] Fix teach-back input and submission
- [x] Fix topic selection buttons
- [x] Fix settings toggle switches
- [x] Fix achievement unlock animations

### Deployment Issues
- [ ] Fix pnpm dependency conflicts
- [ ] Remove unused/conflicting packages
- [ ] Fix Docker build errors
- [ ] Ensure package.json is clean and minimal

### Architecture Issues
- [ ] Simplify screen components - too many features
- [ ] Remove mock data and use real AsyncStorage
- [ ] Fix API integration issues
- [ ] Ensure all services are properly exported

### Testing & Validation
- [ ] Run end-to-end tests on all screens
- [ ] Validate button clicks work
- [ ] Test navigation flow
- [ ] Test data persistence


## Phase 22: RAG Pipeline & Document Management
- [ ] Create document upload screen
- [ ] Implement file parsing (PDF, TXT, MD)
- [ ] Build vector embedding service
- [ ] Create semantic search functionality
- [ ] Implement citation tracking
- [ ] Add knowledge base management

## Phase 23: Web Search Integration
- [ ] Integrate web search API
- [ ] Build search query generator
- [ ] Implement result ranking
- [ ] Add source attribution
- [ ] Create search result caching

## Phase 24: Exam Question Mimicking
- [ ] Create exam paper upload screen
- [ ] Build question pattern analyzer
- [ ] Implement style-matching question generator
- [ ] Create difficulty level matching
- [ ] Add format preservation

## Phase 25: Expanded Multi-Agent System
- [ ] Implement dual-loop reasoning (Analysis + Solve loops)
- [ ] Add InvestigateAgent
- [ ] Add NoteAgent
- [ ] Add PlanAgent
- [ ] Add ManagerAgent
- [ ] Add SolveAgent
- [ ] Add CheckAgent
- [ ] Integrate with Feynman Technique

## Phase 26: Code Execution for STEM
- [ ] Build code editor component
- [ ] Implement Python sandbox execution
- [ ] Create code output display
- [ ] Add error handling
- [ ] Implement visualization support
- [ ] Add code example library
