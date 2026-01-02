# Jarvis

Angular health tracking application with AWS Amplify backend.

## Prerequisites

- Node.js v18.13+ (use `nvm use 20`)
- AWS Account
- AWS Amplify CLI

## Local Development

```bash
npm install
npm start
```

Navigate to `http://localhost:4200/`.

## AWS Amplify Setup

### 1. Install Amplify CLI
```bash
npm install -g @aws-amplify/cli
```

### 2. Configure AWS Credentials
```bash
amplify configure
```

### 3. Start Local Backend (Sandbox)
```bash
npx ampx sandbox
```

This creates a cloud sandbox with your database and auth. It generates `amplifyconfiguration.json`.

### 4. Deploy to AWS

**Option A: Amplify Console (Recommended)**
1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your Git repository
4. Amplify auto-detects the `amplify.yml` build settings
5. Deploy!

**Option B: CLI Deploy**
```bash
npx ampx deploy
```

## Build

```bash
npm run build
```

Build artifacts are stored in `dist/jarvis/`.

