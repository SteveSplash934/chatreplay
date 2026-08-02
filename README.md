
# ChatReplay: WhatsApp Export Viewer and Replay Engine

ChatReplay is a web application built with FastAPI and vanilla JavaScript that transforms exported WhatsApp chat text files (`_chat.txt`) into an interactive replay experience.

Designed to process large chat histories exceeding 70,000 messages with minimal resource consumption, ChatReplay supports contact entity merging, advanced regex search with context highlighting, real-time timestamp customization, persistent browser storage, and mobile responsiveness.

---

## Key Features

### High-Performance Architecture
* **Asynchronous Backend:** Built on a Python backend that offloads CPU-bound regex parsing to worker thread pools, ensuring the event loop remains responsive during heavy processing.
* **Virtual Window Rendering:** Jumps to any message in extensive chat histories without memory leaks, CPU spikes, or browser thread lockups.
* **Bi-Directional Infinite Scroll:** Loads messages in manageable batches as you scroll upward into past history or downward into newer messages.

### Text Parsing Engine
* **Universal Format Parsing:** Parses both 12-hour (`[30/12/2024, 1:12:12 PM]`) and 24-hour (`[15/03/2024, 14:32:18]`) timestamp formats from Android and iOS chat exports.
* **Hidden Character Cleaning:** Strips directional Unicode control characters (such as left-to-right marks and narrow no-break spaces) before processing.
* **Multiline and System Message Support:** Retains multiline message structure and formats system events (such as encryption notices and disappearing message timer updates) into centered notifications.
* **Edited Message Detection:** Removes raw export tags for edited messages and displays a subtle edit indicator alongside the timestamp.

### Entity Merging and Identity Management
* **Your Aliases:** Map your own usernames to right-aligned bubbles, even if your display name changed across different export dates.
* **Contact Grouping:** Combine multiple usernames used by a single participant over time into a single unified display name.

### Contextual Search Engine
* **Search Options:** Perform search queries with configurable options for case sensitivity and whole word matching.
* **Slide-Out Results Drawer:** Search results open in a dedicated side panel without clearing or interrupting the main chat timeline.
* **Timeline Jumping:** Clicking any search result instantly scrolls the main chat view to that message and highlights it with a visual ring.

### Interface Personalization and Persistence
* **Timestamp Customization:** Toggle seconds on or off in real time, or display the full date inside message bubbles.
* **Persistent Storage:** Saves parsed chats to IndexedDB via LocalForage for instant reloading across browser sessions.
* **Data Management:** Includes a one-click action to clear stored data and log out.

### Mobile Responsive Layout
* **Adaptive Drawers:** Settings fold into a full-screen drawer on mobile screens.
* **Responsive Header:** Search and navigation controls adjust dynamically to fit smaller viewports.

---

## Upcoming Features

* **Modern Redesign:** Updated visual interface with refined layout components.
* **Media Support:** Capability to render attached media files, including images, audio, and video exports.
* **Docker Support:** Containerized setup for easier deployment and testing.
* **Live Web Version:** Hosted application instance for instant online access without local installation.

---

## Tech Stack

* **Backend:** Python 3.9+, FastAPI, Uvicorn, Asyncio, Threadpool Executors.
* **Frontend:** HTML5, Tailwind CSS v4, jQuery.
* **Libraries:** FilePond, Tom Select, Day.js, LocalForage, Lucide Icons, Tippy.js, Toastify, NProgress.

---

## Installation and Setup

### Prerequisites
* Python 3.9 or higher installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/stevesplash934/chatreplay.git
cd chatreplay
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

*`requirements.txt` contents:*
```text
fastapi==0.110.0
uvicorn==0.27.1
python-multipart==0.0.9
```

### 3. Start the Application
```bash
python main.py
```
*Alternatively, using Uvicorn directly:*
```bash
uvicorn main:app --reload --port 8000
```

### 4. Access the Application
Open your browser and navigate to:
```text
http://localhost:8000/static/index.html
```

---

## How to Use

1. **Export Chat:** Export your WhatsApp chat history without media from your mobile device, which generates a `_chat.txt` file.
2. **Upload File:** Drag and drop the `_chat.txt` file into the upload zone on the landing page.
3. **Select Your Aliases:** Open the settings panel and select all names associated with your identity so your messages align to the right.
4. **Group Other Participants:** Add custom contact rules to merge changing usernames of other participants under a single display name.
5. **Apply Settings:** Select Apply and Reload Chat to begin exploring your chat history.
6. **Search Messages:** Trigger the search icon in the header to find specific terms and jump directly to their position in the conversation.

---

## License

Distributed under the MIT License. See `LICENSE` for details.