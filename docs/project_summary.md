
# ReviewPackets – Beginner Friendly Architecture & Technical Summary

## 🧠 What this project is
This project is a **desktop application** that helps teams automatically review large Excel/CSV files and generate review comments.  
Instead of manually checking spreadsheets, the app automates the workflow:

1. Upload issue dump  
2. Select fields to validate  
3. Generate preview  
4. Auto-create comments  
5. Export CSV  

It saves time and ensures consistent review results.

---

## 🧩 Tech Stack Overview

- **Angular** → User Interface  
- **Electron** → Desktop runtime  
- **Python (FastAPI + pandas)** → Data processing  

---

## 🏗 High Level Architecture

```mermaid
flowchart LR
User --> AngularUI
AngularUI -->|HTTP API| PythonBackend
PythonBackend --> FileSystem
Electron --> AngularUI
Electron --> PythonBackend
```

### Explanation
- Angular handles UI
- Python processes Excel files
- Electron runs both as desktop app
- Data stays local on machine

---

## 🖥 Component Architecture

```mermaid
flowchart TD
subgraph Desktop App
    ElectronMain
    AngularRenderer
    PythonBackend
end

AngularRenderer -->|API Calls| PythonBackend
ElectronMain --> AngularRenderer
ElectronMain --> PythonBackend
PythonBackend --> LocalFiles
```

---

## 🔄 App Startup Flow

```mermaid
sequenceDiagram
participant User
participant Electron
participant Python
participant Angular

User->>Electron: Launch app
Electron->>Python: Start backend
Electron->>Angular: Load UI
Angular->>Python: Check API
Python-->>Angular: Ready
```

---

## 📥 File Upload Flow

```mermaid
sequenceDiagram
Angular->>Python: Upload file
Python->>Python: Read Excel with pandas
Python-->>Angular: Return columns
Angular->>User: Show selectable fields
```

---

## 🔍 Preview Generation Flow

```mermaid
sequenceDiagram
User->>Angular: Click preview
Angular->>Python: Send selected fields
Python->>Python: Filter rows
Python->>Python: Check missing fields
Python-->>Angular: Preview data
Angular->>User: Show table
```

---

## 📤 Export Flow

```mermaid
sequenceDiagram
User->>Angular: Click export
Angular->>Python: Request CSV
Python->>Python: Build CSV
Python-->>Angular: File stream
Angular->>User: Download file
```

---

## 🧱 Layered Architecture

```mermaid
flowchart TD
UI[Angular UI Layer]
Desktop[Electron Layer]
API[FastAPI Backend]
Logic[Business Logic]
Data[File System]

UI --> API
Desktop --> UI
Desktop --> API
API --> Logic
Logic --> Data
```

---

## 🔐 Security Design

```mermaid
flowchart LR
Renderer -->|Safe bridge| Preload
Preload --> ElectronMain
ElectronMain --> Backend
Backend --> Files
```

- Context isolation enabled  
- Node integration disabled  
- Localhost API only  

---

## 📊 Data Flow

```mermaid
flowchart TD
UserInput --> AngularForm
AngularForm --> APIRequest
APIRequest --> PythonProcessor
PythonProcessor --> DataFrame
DataFrame --> Validation
Validation --> Result
Result --> UI
UI --> CSVExport
```

---

## 🚀 Why this architecture?

| Need | Solution |
|------|---------|
Desktop app | Electron |
Rich UI | Angular |
Excel processing | Python pandas |
Offline use | Local backend |
Easy install | Electron builder |

---

## ⚠ Current Limitations
- Single user only  
- In-memory storage  
- Large files may slow  
- No auto-restart backend  

---

## 🔮 Future Improvements
- Pagination for large files  
- Better error recovery  
- Backend health checks  
- Modular UI components  
- Performance optimization  

---

## 🧑‍💻 How new developers should understand it

1. Angular → UI logic  
2. Electron → startup + packaging  
3. Python → main processing  

Most new features will go into **Python backend**.

---

## 🧾 One‑line summary
A desktop tool that reads Excel issue dumps, validates selected fields, generates review comments, and exports results using Angular, Electron, and Python.

