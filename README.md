# PurAir Cloudflare Setup Tool

An automated setup tool for creating and configuring Cloudflare projects with PurAir's best practices.

## Features

- 🚀 Interactive CLI for project setup
- 💾 Save and reuse project configurations
- 🔧 Support for multiple project types (site, api, app)
- ✅ Input validation and sanitization
- 🎨 Beautiful CLI interface with colors and spinners
- 📦 Modular architecture for easy extension

## Installation

```bash
npm install -g pur-cloudflare-setup
```

Or run locally:

```bash
npm install
npm start
```

## Usage

### Interactive Mode

Simply run the command and follow the prompts:

```bash
pur-cloudflare-setup
```

### Command Line Options

```bash
pur-cloudflare-setup --name my-project --domain example.com --type site
```

Options:
- `-n, --name <name>` - Project name
- `-d, --domain <domain>` - Domain name
- `-t, --type <type>` - Project type (site, api, app)
- `-c, --config <path>` - Path to configuration file
- `--no-interactive` - Run in non-interactive mode
- `--save-config` - Save configuration for reuse

### Commands

#### Initialize a new project
```bash
pur-cloudflare-setup init
```

#### Manage configurations
```bash
# List saved configurations
pur-cloudflare-setup config --list

# Show configuration details
pur-cloudflare-setup config --show my-config

# Delete a configuration
pur-cloudflare-setup config --delete my-config
```

## Project Types

### Static Website (`site`)
- Cloudflare Pages deployment
- Optional build step
- Static asset optimization

### API Service (`api`)
- Cloudflare Workers
- Optional KV storage
- Optional Durable Objects

### Full Stack Application (`app`)
- Framework support (React, Vue, Next.js, etc.)
- Cloudflare Pages deployment
- API integration

## Configuration

Configurations are saved in `~/.pur-cloudflare-setup/configs.json`.

Example configuration:
```json
{
  "projectName": "my-app",
  "domain": "example.com",
  "projectType": "app",
  "features": ["error-pages", "redirects", "env-vars"],
  "environment": "development",
  "useWrangler": true,
  "framework": "react",
  "usePages": true
}
```

## Project Structure

```
pur-cloudflare-setup/
├── setup.js              # Main CLI entry point
├── src/
│   ├── modules/
│   │   ├── prompts.js    # Interactive prompts
│   │   └── configManager.js # Configuration management
│   └── utils/
│       └── validation.js # Input validation
├── templates/           # Project templates (future)
├── config/             # Configuration files
├── docs/               # Documentation
├── scripts/            # Utility scripts
└── examples/           # Example configurations
```

## Development

```bash
# Install dependencies
npm install

# Run the CLI
npm start

# Run with debug output
DEBUG=true npm start
```

## Future Enhancements

- Template system for generating project files
- Cloudflare API integration for automatic deployment
- GitHub integration for repository creation
- CI/CD pipeline generation
- Custom template support
- Plugin system for extensions

## License

MIT