# Command Runner

![commandrunner](https://github.com/user-attachments/assets/85e6c901-2df9-483a-b113-72b6869c22b2)

A VS Code extension to intelligently manage and run custom npm commands with advanced package.json discovery capabilities.

## Features

### Intelligent Package.json Discovery
- **Recursive Search**: Automatically finds package.json files throughout your workspace
- **Multi-level Traversal**: Searches both up and down the directory tree from any starting point
- **Smart Detection**: Intelligently identifies the most relevant package.json for your current context
- **Workspace Awareness**: Understands VS Code workspace boundaries and common project structures

### Project Context Awareness
- **Monorepo Support**: Detects and handles monorepo structures (Lerna, Nx, Rush, Yarn/npm workspaces)
- **Framework Detection**: Recognizes React, Vue, Angular, Next.js, Nuxt, Express, NestJS, and more
- **Contextual Suggestions**: Provides intelligent command suggestions based on detected project type
- **Automatic Selection**: Auto-selects the most appropriate package.json when possible

### Memory & Persistence
- **Remember Selections**: Saves your package.json preferences across sessions
- **Usage History**: Tracks recently used package.json files
- **Workspace Change Detection**: Automatically adapts when workspace folders change
- **Smart Caching**: Caches discovery results for improved performance

### Enhanced User Interface
- **Package.json Selector**: Easy-to-use interface for selecting between multiple package.json files
- **Context Information**: Shows project type, location, and relevance scores
- **Status Bar Integration**: Shows current package.json in the status bar
- **Visual Indicators**: Clear icons and descriptions for different project types

## Usage

### Basic Usage
1. Open the Command Runner sidebar from the activity bar
2. The extension will automatically detect and select the best package.json file
3. Add custom commands using the "+" button in the sidebar
4. Run commands directly from the sidebar by clicking on them
5. Monitor the current package.json in the status bar

### Package.json Selection
1. Click the package icon in the sidebar to select a different package.json
2. Choose from discovered package.json files with context information
3. The extension remembers your selection for future sessions
4. Automatic detection when opening package.json files in the editor

### Default Commands
The extension automatically adds common npm commands when first activated:
- `npm install` - Install npm dependencies
- `npm run dev` - Run development server
- `npm run build` - Build project for production
- `npm test` - Run tests

### Contextual Commands
- Commands run in the correct directory context based on the selected package.json
- The extension suggests commands based on available scripts in your package.json
- Workspace change detection automatically updates the package.json selection

## Commands

### Core Commands
- `Command Runner: Add Command` - Add a new custom command
- `Command Runner: Edit Command` - Edit an existing command
- `Command Runner: Delete Command` - Delete a command
- `Command Runner: Run Command` - Run a command in the appropriate directory

### Package.json Management
- `Command Runner: Select Package.json` - Choose which package.json to use
- `Command Runner: Show Package.json Info` - Display detailed information about the current package.json
- `Command Runner: Refresh Package.json Discovery` - Re-scan for package.json files

## Project Structure Detection

The extension automatically detects various project types and structures:

### Supported Project Types
- **React**: Detects src/, public/, package.json structure
- **Vue**: Identifies Vue.js projects with vue.config.js
- **Angular**: Recognizes angular.json and typical Angular structure
- **Next.js**: Detects Next.js projects with next.config.js
- **Nuxt**: Identifies Nuxt projects with nuxt.config.js
- **Express**: Detects Node.js/Express server projects
- **NestJS**: Recognizes NestJS projects with nest-cli.json

### Monorepo Support
- **Lerna**: Detects lerna.json configuration
- **Nx**: Recognizes nx.json and workspace structure
- **Rush**: Identifies rush.json configuration
- **Yarn Workspaces**: Detects yarn.lock and packages structure
- **npm Workspaces**: Recognizes npm workspace configurations

### Smart Detection Features
- **Distance-based scoring**: Prioritizes package.json files closer to your current context
- **Workspace root preference**: Gives higher priority to workspace root package.json files
- **Project file detection**: Identifies project directories by common configuration files
- **Automatic context switching**: Updates selection when workspace folders change

## Configuration

The extension provides intelligent defaults with minimal configuration needed:

- **Automatic package.json selection**: Chooses the most relevant package.json based on context
- **Persistent selections**: Remembers your package.json preferences across sessions
- **Workspace change detection**: Automatically adapts when workspace folders change
- **Smart caching**: Caches discovery results for improved performance

## Installation

1. Install the extension from the VS Code marketplace
2. Open the Command Runner sidebar from the activity bar
3. The extension will automatically discover package.json files in your workspace
4. Default commands will be added automatically for quick start

## Requirements

- VS Code 1.83.0 or higher
- Node.js project with package.json (for npm command functionality)

## Extension Settings

This extension works with intelligent defaults and requires minimal configuration. The following settings are available for advanced users:

- `commandRunner.autoSelectPackageJson`: Enable automatic package.json selection (default: true)
- `commandRunner.maxSearchDepth`: Maximum depth for package.json discovery (default: 5)
- `commandRunner.showSuggestions`: Show contextual command suggestions (default: true)

## Key Features

### Automatic Detection
- Detects package.json files throughout your workspace
- Automatically selects the most relevant package.json based on your current context
- Provides status bar integration showing the current package.json

### Smart Context Switching
- Automatically prompts to switch when opening different package.json files
- Remembers your selections across VS Code sessions
- Adapts to workspace folder changes

### Default Commands
- Automatically adds common npm commands (install, dev, build, test)
- Commands run in the correct directory context
- Easy command management with add, edit, and delete functionality

## Known Issues

- Large workspaces with many package.json files may experience slower initial discovery
- Some complex monorepo configurations may require manual package.json selection

## Release Notes

### 0.0.1

- Initial release with intelligent package.json discovery
- Multi-level directory traversal with distance-based scoring
- Smart project detection and workspace awareness
- Enhanced UI with package.json selection and status bar integration
- Memory and persistence features
- Automatic default command setup
- Workspace change detection and automatic context switching

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
