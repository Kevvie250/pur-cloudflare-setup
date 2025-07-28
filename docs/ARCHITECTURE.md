# Architecture Overview

## Project Structure

The PurAir Cloudflare Setup tool is built with a modular architecture for maintainability and extensibility.

### Core Components

#### 1. CLI Interface (`setup.js`)
- Main entry point for the application
- Handles command parsing using Commander.js
- Orchestrates the flow between different modules
- Provides user feedback with chalk and ora

#### 2. Prompt Manager (`src/modules/prompts.js`)
- Manages all interactive prompts using Inquirer.js
- Provides type-specific prompts based on project type
- Handles user input collection and initial validation

#### 3. Configuration Manager (`src/modules/configManager.js`)
- Handles saving/loading project configurations
- Manages configuration storage in `~/.pur-cloudflare-setup/`
- Supports import/export functionality
- Validates configurations before saving

#### 4. Validation Utilities (`src/utils/validation.js`)
- Provides validation functions using Joi
- Ensures data integrity throughout the application
- Includes sanitization functions for user inputs

### Data Flow

1. **User Input** → CLI parses commands and options
2. **Prompts** → Collect missing information interactively
3. **Validation** → Ensure all inputs are valid
4. **Configuration** → Save/load configurations as needed
5. **Template Engine** → (Future) Generate project files
6. **Output** → Provide feedback and next steps

### Extension Points

The architecture is designed to be easily extended:

1. **Template System** - Add new templates in the `templates/` directory
2. **Project Types** - Extend the `projectTypes` array in prompts
3. **Validation Rules** - Add new schemas in validation.js
4. **Commands** - Add new commands in setup.js

### Configuration Storage

Configurations are stored as JSON in the user's home directory:
```
~/.pur-cloudflare-setup/
└── configs.json
```

Each configuration includes:
- Project settings
- Metadata (created, updated timestamps)
- Version information for compatibility

### Future Enhancements

1. **Template Engine Integration**
   - Handlebars/EJS for template processing
   - Dynamic file generation based on configuration

2. **API Integration**
   - Cloudflare API for automatic deployment
   - GitHub API for repository creation

3. **Plugin System**
   - Allow third-party extensions
   - Custom project types and templates

4. **State Management**
   - Track deployment status
   - Rollback capabilities