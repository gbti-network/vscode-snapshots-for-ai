# Snapshots for AI

Create perfect code context for AI interactions! This powerful extension helps you generate well-formatted markdown snapshots of your code, making it easier to share context with AI assistants like ChatGPT, Claude, and others.

![Snapshot Demo](https://github.com/gbti-network/vscode-snapshots-for-ai/raw/HEAD/resources/marketplace/demo.gif)

## ✨ Key Features

### 📸 One-Click Snapshots
- Create snapshots instantly using the camera icon in your editor
- Automatically formats code with proper syntax highlighting
- Includes file structure and relevant context

### 🎯 Smart Selection
- Choose specific files or include entire project structure
- Real-time file list updates as you work
- Intelligent filtering of binary and irrelevant files
- Quick select/deselect all functionality

### 🎨 Perfect Formatting
- Generates clean, well-structured markdown
- Proper syntax highlighting for all languages
- Hierarchical project structure visualization
- Optimized for AI consumption

### ⚡ AI-Ready Output
- Creates context-rich snapshots
- Perfect for RAG (Retrieval Augmented Generation)
- Works with all major AI assistants
- Maintains code structure and relationships

## 🚀 Getting Started

1. Install the extension
2. Open any file in your project
3. Click the camera icon in the editor title bar
4. Select files to include in your snapshot
5. Add an optional prompt or description
6. Your snapshot is ready to share with AI!

## 📋 Usage Examples

### Creating a Basic Snapshot
1. Open your main code file
2. Click the camera icon
3. Select related files
4. Your snapshot includes:
   - Selected file contents
   - Project structure
   - Proper markdown formatting

### Project Overview Snapshot
1. Open your project
2. Click the camera icon
3. Enable "Include Project Structure"
4. Get a complete overview of your codebase

### Focused Code Context
1. Open specific files
2. Select only relevant code
3. Perfect for targeted AI assistance

## ⚙️ Configuration

Customize your snapshots through `.snapshots/config.json`:
```json
{
  "default": {
    "default_prompt": "",
    "default_include_entire_project_structure": false,
    "default_include_all_files": false
  },
  "excluded_patterns": [
    "node_modules",
    ".git"
  ],
  "included_patterns": []
}
```

## 💡 Pro Tips

1. Use selective file inclusion for focused context
2. Include project structure for broader understanding
3. Add descriptive prompts for better AI context
4. Configure exclusion patterns for cleaner snapshots



## 🤝 Support

### Join to GBTI Network!!! 🙏🙏🙏
The GBTI Network is a community of developers who are passionate about open source and community-driven development. Members enjoy access to exclussive tools, resources, a private MineCraft server, a listing in our members directory, co-op opportunities and more.

- Support our work by becoming a [GBTI Network member](https://gbti.network/membership/).

### Other ways to Support:

- 🌟 Star us on [GitHub](https://github.com/gbti-network/vscode-snapshots-for-ai)
- 🐛 Report issues on our [Issue Tracker](https://github.com/gbti-network/vscode-snapshots-for-ai/issues)
- 💡 Contribute through [Pull Requests](https://github.com/gbti-network/vscode-snapshots-for-ai/pulls)
- ⭐ Rate us on [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=GBTI.snapshots-for-ai&ssr=false#review-details)

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

**Note**: For development and contribution guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md)
