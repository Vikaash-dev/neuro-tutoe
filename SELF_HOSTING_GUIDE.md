# NeuroTutor AI - Self-Hosting Guide

## Overview

NeuroTutor AI is a **completely self-hosted mobile app** with no external dependencies or cloud services required. Everything runs locally on your device:

- ✅ Frontend and backend integrated in single app
- ✅ User provides their own Gemini 3.1 Pro API key
- ✅ All learning data stored locally on device
- ✅ No cloud sync or external services
- ✅ Privacy-first: your data never leaves your device

---

## Getting Started

### Step 1: Get Your Gemini 3.1 Pro API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **"Get API Key"** in the left sidebar
3. Create a new API key or copy an existing one
4. Keep this key safe - you'll need it to run the app

### Step 2: Install the App

#### Option A: Using Expo Go (Easiest for Testing)

1. Install [Expo Go](https://expo.dev/go) on your phone
2. Clone/download the NeuroTutor AI repository
3. Run: `pnpm install && pnpm dev`
4. Scan the QR code with Expo Go
5. The app will load on your phone

#### Option B: Build for Production (Android/iOS)

```bash
# For Android APK
eas build --platform android --local

# For iOS IPA
eas build --platform ios --local
```

### Step 3: Configure API Key

1. Open NeuroTutor AI on your phone
2. You'll see the **API Setup Screen**
3. Paste your Gemini 3.1 Pro API key
4. Tap **"Save & Continue"**
5. Your key is saved locally - never shared or transmitted

---

## Features

### Core Learning Engine

- **Feynman Technique**: Break concepts into simplest components
- **10-Level Adaptive Depth**: From elementary to expert researcher level
- **Spaced Repetition**: SM-2 algorithm with 1, 3, 7, 21-day intervals
- **Active Recall Quizzes**: Adaptive difficulty based on performance
- **Knowledge Graphs**: Visualize concept relationships and prerequisites

### AI Tutoring

- **Socratic Dialogue**: AI guides through questions, never directly answers
- **Multi-Agent System**: Explainer, Questioner, Evaluator, Socratic agents
- **Misconception Detection**: Identifies and corrects learning gaps
- **Personalized Explanations**: Adapts to your learning style and depth preference

### Memory Management

- **STM/LTM Tracking**: Short-term to long-term memory consolidation
- **Mastery Progression**: Novice → Intermediate → Proficient → Expert
- **Theory of Mind**: Understands your mental models for better teaching
- **LSTM Knowledge Tracing**: Predictive mastery modeling

### Analytics

- **Learning Dashboard**: Progress tracking and insights
- **Mastery Analytics**: Concept mastery distribution and trends
- **Study Statistics**: Time spent, accuracy, streaks
- **Data Export**: Export learning data as JSON for backup

---

## Local Data Storage

All your learning data is stored locally using **AsyncStorage**:

- Concepts and learning history
- Quiz attempts and performance
- Student profile and preferences
- Study sessions and analytics

### Backup Your Data

```bash
# Export all data (in Settings screen)
1. Open Settings
2. Tap "Export Learning Data"
3. Save the JSON file to your computer
```

### Restore Your Data

```bash
# Import data (in Settings screen)
1. Open Settings
2. Tap "Import Learning Data"
3. Select a previously exported JSON file
```

---

## API Usage & Costs

### Gemini 3.1 Pro API

- **Cost**: Pay-as-you-go (typically $0.075 per 1M input tokens)
- **Usage**: Depends on how much you use the AI tutor
- **Estimate**: 
  - Light usage (1-2 sessions/day): ~$1-5/month
  - Heavy usage (4-5 sessions/day): ~$10-20/month

### Monitoring Usage

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Check your Gemini API usage
3. Set billing alerts if desired

---

## Troubleshooting

### API Key Not Working

- ✅ Verify the key is correct (copy-paste carefully)
- ✅ Check that Gemini 3.1 Pro API is enabled in Google Cloud
- ✅ Ensure you have billing enabled for the API

### App Crashes or Errors

- ✅ Clear app cache: Settings → Apps → NeuroTutor → Clear Cache
- ✅ Reinstall the app
- ✅ Check browser console (web version) for error messages

### Data Not Saving

- ✅ Ensure app has storage permissions
- ✅ Check device storage space
- ✅ Try exporting and importing data to refresh

### Slow Performance

- ✅ Close other apps to free up memory
- ✅ Clear app cache
- ✅ Reduce the number of stored concepts
- ✅ Check internet connection for API calls

---

## Architecture

### Frontend

- **Framework**: React Native with Expo
- **UI**: NativeWind (Tailwind CSS for React Native)
- **State Management**: React Context + AsyncStorage
- **Styling**: Deep Blue (#0a7ea4) and Emerald Green theme

### Backend (Client-Side)

- **API Integration**: Gemini 3.1 Pro API
- **Learning Engine**: 
  - Feynman Technique implementation
  - 10-level adaptive depth system
  - Socratic dialogue mode
  - Multi-agent tutor system
  - LSTM knowledge tracing
- **Data Persistence**: AsyncStorage (local only)

### Services

```
lib/services/
├── gemini-client.ts          # Gemini API integration
├── learning-engine.ts        # Core learning logic
├── adaptive-depth-10-level.ts # 10-level depth system
├── socratic-dialogue.ts       # Socratic questioning
├── multi-agent-tutor.ts       # Multi-agent system
├── lstm-knowledge-tracing.ts  # LSTM-based tracing
├── local-storage.ts           # Local data persistence
└── __tests__/                 # Comprehensive tests
```

---

## Development

### Build & Run

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Type check
pnpm check

# Lint
pnpm lint
```

### Project Structure

```
app/
├── (tabs)/                    # Tab navigation
│   ├── index.tsx             # Home/Dashboard
│   ├── topic-selection.tsx   # Browse topics
│   ├── memory-dashboard.tsx  # STM/LTM tracking
│   ├── progress-mastery.tsx  # Analytics
│   └── settings.tsx          # Preferences
├── api-setup.tsx             # API key configuration
├── tutor-chat.tsx            # AI tutoring interface
├── active-recall-quiz.tsx    # Quiz system
├── knowledge-graph.tsx       # Concept visualization
├── teach-back.tsx            # Feynman teach-back
└── analytics-dashboard.tsx   # Learning insights

lib/
├── services/                 # Business logic
├── types/                    # TypeScript types
├── hooks/                    # React hooks
└── utils/                    # Utilities

components/
├── screen-container.tsx      # SafeArea wrapper
└── ui/                       # UI components
```

---

## Privacy & Security

### Your Data

- ✅ **Stored Locally**: All learning data stays on your device
- ✅ **No Cloud Sync**: No automatic uploads or backups
- ✅ **No Tracking**: No analytics or user tracking
- ✅ **No Ads**: Completely ad-free

### API Key

- ✅ **Stored Securely**: Saved in device secure storage
- ✅ **Never Transmitted**: Only used for Gemini API calls
- ✅ **You Control**: You can delete/rotate anytime
- ✅ **HTTPS Only**: All API calls encrypted

---

## Support & Troubleshooting

### Common Issues

**Q: "API key not valid" error**
A: Check that your API key is correct and Gemini 3.1 Pro is enabled in Google Cloud.

**Q: App won't load**
A: Try clearing cache, reinstalling, or checking your internet connection.

**Q: Data disappeared**
A: Export your data regularly as backup. Use the import feature to restore.

**Q: Slow responses from AI**
A: Check your internet connection and API quota. Reduce explanation depth level.

### Getting Help

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
3. Check the [design.md](./design.md) for UI/UX documentation

---

## Deployment

### For Personal Use

1. Build the app using Expo
2. Install on your phone
3. Use your own Gemini API key
4. All data stays on your device

### For Family/Friends

1. Build the app for each person
2. Each person provides their own Gemini API key
3. Each person's data is completely separate
4. No shared backend or server needed

### For Classroom/Institution

1. Deploy Expo app to shared device
2. Each student logs in with their own account
3. Each student's data stored separately
4. Optionally add a shared backend for teacher dashboard

---

## License

NeuroTutor AI is open-source and free to use for personal, educational, and commercial purposes.

---

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a pull request

---

**Happy Learning! 🧠✨**
