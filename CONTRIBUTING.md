# Contributing to Snapshots for AI

Thank you for your interest in contributing to Snapshots for AI! We welcome contributions from the community to help make this extension even better.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Submit a pull request

## Development Setup

1. Install Node.js and npm
2. Clone the repository
3. Run `npm install` to install dependencies
4. Open the project in VS Code
5. Press F5 to start debugging

## Building from Source

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Visual Studio Code (for testing)

### Build Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/gbti/vscode-snapshots-for-ai.git
   cd vscode-snapshots-for-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the extension:
   ```bash
   npm run compile
   ```

### Deployment Commands

For extension maintainers, the following deployment commands are available:

```bash
# Local Development (no publish)
npm run deploy        # Increment patch version without publishing
npm run deploy:patch  # Same as above, explicit patch version

# Publishing Commands
npm run deploy:minor  # Increment minor version and publish
npm run deploy:major  # Increment major version and publish
```

Each deployment command will:
1. Increment the version number according to semantic versioning
2. Clean the output directories
3. Install dependencies
4. Compile TypeScript
5. Package the extension
6. Publish to the marketplace (only for minor and major versions)

**Note:** To publish the extension, you need to set up the following environment variables:
- `VSCODE_PUBLISHER_ID`: Your VS Code marketplace publisher ID
- `VSCE_PAT`: Personal Access Token for the VS Code marketplace

You can copy `.env.example` to `.env` and fill in these values.

### Testing in Different Editors

#### VS Code
- Press F5 in VS Code to launch a development instance
- The extension will be automatically loaded

#### WindSurf
1. Package the extension:
   ```bash
   npx @vscode/vsce package
   ```
2. Install the generated `.vsix` file in WindSurf

#### Cursor
1. Package the extension as above
2. Install the `.vsix` file in Cursor
3. Test functionality in Cursor's environment

## Testing

```bash
npm run test
```

## Coding Guidelines

- Write clear commit messages
- Follow the existing code style
- Add appropriate comments and documentation
- Update the README.md if necessary
- Add tests for new features

## Pull Request Process

1. Update the README.md with details of changes if needed
2. Update the version number following semantic versioning
3. The PR will be merged once you have the sign-off of a maintainer

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project, you agree to abide by its terms.
