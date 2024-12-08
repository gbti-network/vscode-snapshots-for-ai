# Marketplace Assets Structure

## Directory Structure
```
resources/
├── marketplace/
│   ├── icon/
│   │   └── icon.png               (128x128 px, PNG with transparency)
│   │   └── icon@2x.png            (256x256 px, PNG with transparency, for high DPI)
│   ├── banner/
│   │   └── banner.png             (1280x263 px, PNG)
│   ├── screenshots/
│   │   ├── dialog.png             (1280x800 px min, PNG)
│   │   ├── file-selection.png     (1280x800 px min, PNG)
│   │   ├── snapshot-example.png   (1280x800 px min, PNG)
│   │   └── project-structure.png  (1280x800 px min, PNG)
│   └── features/
│       ├── workflow.png           (1024x768 px min, PNG)
│       ├── file-system.png        (1024x768 px min, PNG)
│       ├── structure.png          (1024x768 px min, PNG)
│       └── configuration.png      (1024x768 px min, PNG)
```

## Asset Requirements

### Icons
- `icon.png` (Required)
  - Resolution: 128x128 pixels
  - Format: PNG with transparency
  - Purpose: Main extension icon
  - Location: `marketplace/icon/icon.png`

- `icon@2x.png` (Recommended)
  - Resolution: 256x256 pixels
  - Format: PNG with transparency
  - Purpose: High DPI displays
  - Location: `marketplace/icon/icon@2x.png`

### Banner
- `banner.png` (Recommended)
  - Resolution: 1280x263 pixels
  - Format: PNG
  - Purpose: Marketplace header
  - Location: `marketplace/banner/banner.png`
  - Color scheme should match extension theme

### Screenshots
All screenshots should be at least 1280x800 pixels

1. `dialog.png`
   - Content: Snapshot creation dialog
   - Location: `marketplace/screenshots/dialog.png`
   - Shows: Dialog interface with prompt input and options

2. `file-selection.png`
   - Content: File selection interface
   - Location: `marketplace/screenshots/file-selection.png`
   - Shows: Checkbox list with file selection

3. `snapshot-example.png`
   - Content: Generated snapshot example
   - Location: `marketplace/screenshots/snapshot-example.png`
   - Shows: Final markdown output with code blocks

4. `project-structure.png`
   - Content: Project structure view
   - Location: `marketplace/screenshots/project-structure.png`
   - Shows: Tree view of project files

### Feature Images
All feature images should be at least 1024x768 pixels

1. `workflow.png`
   - Content: Snapshot creation workflow
   - Location: `marketplace/features/workflow.png`
   - Shows: Step-by-step process

2. `file-system.png`
   - Content: File selection system
   - Location: `marketplace/features/file-system.png`
   - Shows: File management interface

3. `structure.png`
   - Content: Project structure generation
   - Location: `marketplace/features/structure.png`
   - Shows: Structure generation process

4. `configuration.png`
   - Content: Configuration options
   - Location: `marketplace/features/configuration.png`
   - Shows: Settings and configuration UI

## Image Guidelines
- All screenshots should be taken with:
  - Clean VS Code theme (preferably dark)
  - No distracting elements
  - Clear, readable text
  - Highlighted relevant features
  - Consistent window size
  - High-quality scaling
