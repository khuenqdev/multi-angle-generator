# 🍌 Nano Banana Multi-Angle Image Generator

A lightweight, local-first React web application that generates multi-angle image variations from a single reference image. Powered by Google AI Studio's **Nano Banana API** (Gemini 3 Pro Image / Gemini 2.5 Flash Image).

---

## ✨ Features

* 📸 **Single Reference Image Input:** Upload a single subject photo to serve as the visual base.
* 📝 **Prompt Manager (CRUD):** Fully customizable predefined prompts with inline view, add, edit, and delete controls.
* 🏷️ **Label Template Parser:** Parses prompts formatted as `[Label] Prompt text...` to track progress and automatically name generated image files.
* ⏳ **Sequential Queue Processing:** Processes prompts one by one to give you real-time visual progress updates.
* 🛑 **Instant Task Cancellation:** Stop image generation at any time with an integrated `AbortController` that cancels active network requests and breaks cooldown loops.
* 🛡️ **Rate Limit & Quota Protection:** Built-in auto-retry logic with countdown timers to respect Google AI Studio rate limits and prevent `HTTP 429` quota errors.
* 🖼️ **Gallery Display:** Interactive grid gallery showcasing completed images with their respective labels.
* 📦 **Batch Download:** Archive all generated images into a single `.zip` file with safe, label-based file naming.
* 🔍 **Rich Console Logging:** Color-coded, structured browser console output for effortless local debugging.

---

## 🛠️ Tech Stack

* **Frontend:** React 18+
* **Build Tool:** Vite
* **Styling:** Tailwind CSS v4
* **Archiving & Downloads:** JSZip + FileSaver.js
* **API Integration:** Google Gemini API / AI Studio REST API

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local machine:
* [Node.js](https://nodejs.org/) (v18.0 or higher)
* `npm` or `yarn`
* A **Google AI Studio API Key** (with Billing enabled for high-tier models)

---

### Installation & Setup

1. **Clone or navigate to the project directory:**
```bash
cd multi-angle-generator
```
2. **Install project dependencies:**
```bash
npm install
```
3. **Configure Environment Variables:**
Create a .env file in the root directory of the project:
```bash
touch .env
```
4. **Open .env and add your Google AI Studio API key:**
```Env
VITE_NANO_BANANA_API_KEY="your_google_ai_studio_api_key_here"
```
5. **Start the local development server:**
```bash
npm run dev
```
6. **Open in browser:**
Navigate to http://localhost:5173 in your web browser.

---

## Project Structure

```text
multi-angle-generator/
├── public/
├── src/
│   ├── App.jsx            # Main App component & API queue logic
│   ├── index.css          # Tailwind CSS v4 directives
│   ├── main.jsx           # React DOM entrypoint
│   └── prompts.json       # Predefined default prompt array
├── .env                   # Local environment file (ignored by git)
├── .gitignore             # Git ignore rules
├── package.json           # App dependencies & scripts
├── tailwind.config.js     # Tailwind setup
├── vite.config.js         # Vite configuration & plugins
└── README.md              # Project documentation
```

## Prompt Syntax Template

Prompts inside src/prompts.json or added via the UI follow this template structure:

```text
[ Label Name ] Actual prompt description sent to the AI model...
```

### Example Prompts:

```json
[
  "[Front View] High quality front view of the subject, studio lighting",
  "[Side Profile] High quality left side profile view of the subject",
  "[Top Down] High quality overhead top-down view of the subject"
]
```

- **Label ([Side Profile]):** Extracted for progress tracking, UI gallery tag, and saved file naming (side_profile.jpg).
- **Prompt Text:** The actual prompt text sent in the API request body.

## ⚙️ Model Selection & API Configuration

By default, the application is set to use the high-quality Nano Banana Pro model (gemini-3-pro-image-preview).

If you prefer maximum generation speed over fine visual detail, you can edit the endpoint URL inside src/App.jsx:

```JavaScript
// High Quality (Nano Banana Pro)
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

// High Speed (Nano Banana Flash)
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
```

## 💻 Available Scripts

- `npm run dev`: Starts the local Vite development server with hot-module replacement.
- `npm run build`: Compiles and optimizes the React app for production output in /dist.
- `npm run preview`: Locally previews the production build.

## License

This project is open-source and available under the MIT License.