/**
 * Variant Configuration
 *
 * Defines how to ADD functionality to the base template via variants.
 * Follows open-closed principle: base is minimal, variants ADD features.
 *
 * Two types of additions:
 * - SECTIONS: Code snippets inserted into base template files (via {{MARKERS}})
 * - FILES: Complete files/folders copied to the project
 */

const VARIANT_CONFIG = {
  backend: {
    base: 'backend/base',
    sectionsDir: 'backend/variants/sections',
    filesDir: 'backend/variants/files',

    variants: {
      // Multi-tenant variant: Adds project/workspace support
      'multi-tenant': {
        // Complete files/folders to copy
        files: [
          'src/modules/domain/projects',           // Entire projects module
          'src/modules/domain/ai/services/project-config.service.ts', // Project config service
          'src/guards/project-ownership.guard.ts', // Project ownership guard (header-based)
          'src/guards/project-param.guard.ts',     // Project param guard (route-based)
          'src/modules/auth/auth.service.ts',      // Auth service with multi-tenant support
          'src/modules/auth/auth.controller.ts',   // Auth controller with multi-tenant support
          'src/modules/users/users.service.ts',    // Users service with multi-tenant support
          'src/modules/users/users.controller.ts', // Users controller with multi-tenant support
          'src/modules/users/create-user.dto.ts'   // CreateUserDto with businessId
        ],

        // Code sections to insert into base template files
        sections: {
          'src/main.ts': [
            'PROJECT_IMPORTS',              // Add project-related imports
            'PROJECT_CUSTOM_DOMAINS',       // Add custom domains query
            'PROJECT_CUSTOM_DOMAINS_CORS',  // Add custom domains to CORS
            'PROJECT_GUARD'                 // Add ProjectOwnershipGuard registration
          ],
          'src/modules/app/app.module.ts': [
            'PROJECTS_MODULE_IMPORT',       // Add ProjectsModule import
            'PROJECTS_MODULE'               // Add ProjectsModule to imports array
          ],
          'src/modules/auth/auth.module.ts': [
            'MULTI_TENANT_IMPORTS',         // Add Project entity import
            'MULTI_TENANT_TYPEORM'          // Add Project to TypeOrmModule
          ],
          'src/modules/users/user.entity.ts': [
            'PROJECTS_RELATIONSHIP_IMPORT', // Add Project entity import
            'PROJECTS_RELATIONSHIP'         // Add projects relationship
          ],
          'src/modules/users/users.module.ts': [
            'MULTI_TENANT_IMPORTS',          // Add Projects-related imports
            'MULTI_TENANT_ENTITIES',         // Add Project entities to TypeORM
            'MULTI_TENANT_MODULE_IMPORTS',   // Add ProjectsModule to imports
            'MULTI_TENANT_PROVIDERS'         // Add multi-tenant providers
          ]
        }
      },

      // B2B2C variant: Adds regular_user support (for single-tenant only)
      'b2b2c': {
        // Complete files to copy
        files: [
          'src/modules/users/user-business.entity.ts',  // Business-to-user linking entity
        ],

        // Code sections to insert
        sections: {
          'src/modules/users/user.entity.ts': [
            'B2B2C_IMPORTS',           // Add UserBusiness import
            'B2B2C_USER_ROLE',         // Add REGULAR_USER enum value
            'B2B2C_RELATIONSHIPS'      // Add userBusinesses relationship
          ],
          'src/modules/users/users.module.ts': [
            'B2B2C_IMPORTS',           // Add UserBusiness import
            'B2B2C_ENTITIES'           // Add UserBusiness to TypeORM
          ]
        }
      },

      // B2B2C + Single-tenant combination variant (NEW)
      'b2b2c_single-tenant': {
        // Complete files to copy (B2B2C features without multi-tenant projects)
        files: [
          'src/guards/business-scoping.guard.ts',                         // Business scoping guard
          'src/modules/domain/business/business.controller.ts',           // Business lookup controller
          'src/modules/domain/business/business.service.ts',              // Business lookup service
          'src/modules/domain/business/business.module.ts',               // Business module
          'src/modules/domain/business/entities/business.entity.ts',      // Business entity
          'src/modules/domain/business/dto/business-response.dto.ts',     // Business response DTO
          'src/modules/domain/business/dto/create-business.dto.ts',       // Business create DTO
          'src/database/migrations/1766688416362-CreateBusinessesTable.ts', // Businesses table migration
          'src/modules/domain/items/items.controller.ts',                 // Items with business scoping
          'src/modules/domain/items/items.service.ts',                    // Items service with business scoping
          'src/modules/domain/items/item.entity.ts',                      // Item entity with businessId
          'src/modules/domain/items/dto/create-item.dto.ts',              // Create item DTO
          'src/modules/domain/items/dto/update-item.dto.ts',              // Update item DTO
          'src/modules/auth/auth.module.ts',                              // Auth module with Business entity
          'src/modules/auth/auth.controller.ts',                          // Auth controller with magic-link (B2B2C)
          'src/modules/auth/auth.service.ts',                             // Auth service with magic-link (B2B2C)
          'src/modules/auth/jwt-auth.guard.ts',                           // JWT authentication guard
          'src/modules/users/user-business.entity.ts',                    // Business-to-user linking entity
          'src/modules/users/users.module.ts',                            // Users module with Business entity
          'src/modules/users/users.controller.ts',                        // Users controller (B2B2C)
          'src/modules/users/users.service.ts',                           // Users service (B2B2C)
          'src/modules/users/create-user.dto.ts'                          // CreateUserDto with businessId
        ],

        sections: {
          'src/modules/app/app.module.ts': [
            'BUSINESS_MODULE_IMPORT',    // Import BusinessModule
            'BUSINESS_MODULE'             // Add BusinessModule to imports
          ],
          'src/modules/users/user.entity.ts': [
            'BUSINESS_RELATIONSHIP_IMPORT', // Import Business entity
            'BUSINESS_RELATIONSHIP'         // Add business relationship
          ]
        }
      },

      // B2B2C + Multi-tenant combination variant (RENAMED from multi-tenant_b2b2c)
      'b2b2c_multi-tenant': {
        // Complete files to copy (has both multi-tenant and B2B2C features)
        files: [
          'src/modules/users/user-business.entity.ts',         // Business-to-user linking entity
          'src/modules/auth/auth.service.ts',                  // Combined auth service
          'src/modules/auth/auth.controller.ts',               // Combined auth controller
          'src/modules/users/users.service.ts',                // Combined users service
          'src/modules/users/users.controller.ts',             // Combined users controller
          'src/modules/domain/projects/projects.module.ts'     // Projects module with UserBusiness
        ],

        // No sections needed - complete files already have all features
        sections: {}
      }
    },

    // Variant selection prompts
    prompts: {
      tenancy: {
        message: 'Will your application have multiple workspaces/projects per user?',
        choices: [
          {
            name: 'Single-tenant (one instance per user) - Simpler data model',
            value: 'single-tenant',
            description: 'Each user has one instance. Simpler architecture without project isolation.',
            isDefault: true  // Base template is single-tenant
          },
          {
            name: 'Multi-tenant (workspaces/projects) - Users can create multiple projects',
            value: 'multi-tenant',
            description: 'Each user can create multiple isolated workspaces. Data is scoped by project context.'
          }
        ],
        default: 'single-tenant'
      },

      userModel: {
        message: 'Who will use your application?',
        choices: [
          {
            name: 'B2B (Business users only) - Organization employees manage the system',
            value: 'b2b',
            description: 'Only business users (your customers) access the system. No end-user portal.',
            isDefault: true  // Base template is B2B
          },
          {
            name: 'B2B2C (Business + End customers) - Business users manage their customers',
            value: 'b2b2c',
            description: 'Business users manage their end customers (regular_user type). Adds customer relationships.'
          }
        ],
        default: 'b2b'
      }
    }
  },

  // Admin portal inherits tenancy choice from backend
  'admin-portal': {
    base: 'admin-portal/base',
    sectionsDir: 'admin-portal/variants/sections',
    filesDir: 'admin-portal/variants/files',

    variants: {
      'multi-tenant': {
        // Complete files to copy (multi-tenant only components)
        files: [
          'src/components/projects/ProjectsSelect.tsx',      // Project selector dropdown
          'src/components/projects/NewProject.tsx',          // Create project dialog
          'src/pages/FirstProject.tsx',                      // Onboarding page
          'src/api/projectRequests.ts',                      // Project API calls
          'src/components/ProjectFrontendLink.tsx',          // Project navigation link
          'src/components/settings/CustomDomain.tsx'         // Custom domain settings (multi-tenant only)
        ],

        // Code sections to insert into base template files
        sections: {
          'src/redux/user/userSlice.ts': [
            'TYPES_IMPORT',             // Add Project type to imports
            'PROJECTS_STATE',           // Add projects state to interface
            'PROJECTS_STATE_INITIAL',   // Initialize projects in initial state
            'PROJECTS_INITIALIZATION',  // Initialize projects on profile fetch
            'PROJECTS_REDUCERS',        // Add setSelectedProject reducer
            'PROJECTS_EXPORTS',         // Export setSelectedProject action
            'PROJECTS_SELECTOR'         // Export selectSelectedProject selector
          ],
          'src/api/client.ts': [
            'STORE_IMPORT',             // Import Redux store
            'PROJECT_HEADER'            // Add X-Project-Id header to requests
          ],
          'src/components/Layout.tsx': [
            'PROJECT_STATE',            // Extract project state from Redux
            'FIRST_PROJECT_CHECKS'      // Add loading state for missing project
          ],
          'src/components/ui/SaMenu.tsx': [
            'PROJECTS_SELECT_IMPORT',   // Import ProjectsSelect component
            'PROJECTS_SELECT_COMPONENT' // Render ProjectsSelect in sidebar
          ],
          'src/pages/auth/Login.tsx': [
            'ROUTER_IMPORTS'            // Add useNavigate, useSearchParams to imports
          ],
          'src/pages/auth/SignUp.tsx': [
            'REACT_IMPORTS'                // Add useState to React imports
          ],
          'src/pages/Settings.tsx': [
            'MULTI_TENANT_SETTINGS_IMPORTS',  // Import CustomDomain
            'MULTI_TENANT_SETTINGS_TABS',     // Add Custom Domain tab
            'MULTI_TENANT_SETTINGS_CONTENT'   // Render CustomDomain
          ],
          'src/App.tsx': [
            'SET_SELECTED_PROJECT_IMPORT', // Import setSelectedProject action
            'FIRST_PROJECT_IMPORT',        // Import FirstProject component
            'FIRST_PROJECT_ROUTE_GUARD',   // Add FirstProjectRoute guard
            'USER_ROUTE_VARIABLES',        // Add user and location variables for onboarding
            'USER_ROUTE_ONBOARDING_CHECK', // Redirect to /first-project
            'PROJECT_QUERY_PARAM_HANDLER', // Handle ?project= query param
            'FIRST_PROJECT_ROUTE'          // Add /first-project route
          ],
          'src/types/index.ts': [
            'PROJECTS_FIELD'            // Add projects field to User interface
          ]
        }
      },

      'b2b2c': {
        files: [
          'src/pages/Users.tsx'         // Users page for managing end customers
        ],

        sections: {
          'src/components/Layout.tsx': [
            'B2B2C_USER_ICON_IMPORT',   // Import UserIcon for Users menu
            'B2B2C_USERS_MENU'          // Add Users menu item for customer management
          ],
          'src/App.tsx': [
            'B2B2C_USERS_IMPORT',       // Import Users page component
            'B2B2C_USERS_ROUTE'         // Add /users route
          ]
        }
      },

      'b2b2c_single-tenant': {
        files: [
          'src/api/businessRequests.ts',  // Business API requests
          'src/pages/Business.tsx'        // Business onboarding page
        ],

        sections: {
          'src/App.tsx': [
            'BUSINESS_IMPORT',             // Import Business component
            'USER_ROUTE_VARIABLES',        // Add user and location variables
            'USER_ROUTE_ONBOARDING_CHECK', // Business onboarding redirect logic
            'BUSINESS_ROUTE'               // Add /business route
          ]
        }
      }
    },

    linkedTo: 'backend.tenancy'
  },

  // Customers portal (B2B2C only - no pure B2B use case)
  'customers-portal': {
    base: 'customers-portal/base',  // B2B2C + Single-tenant base
    sectionsDir: 'customers-portal/variants/sections',
    filesDir: 'customers-portal/variants/files',

    variants: {
      'single-tenant': {
        // Single-tenant uses section overrides for business endpoints
        files: [],
        sections: {
          'src/api/tenantContext.ts': [
            'TENANT_CONFIG'  // Override tenant config for business endpoints
          ]
        }
      },

      'multi-tenant': {
        // Complete file replacement for multi-tenant variant
        files: [
          'src/App.tsx',                          // Project resolution logic
          'src/api/config.ts',                    // x-project-id header
          'src/api/types.ts',                     // Project type
          'src/api/projectRequests.ts',           // Project API calls
          'src/api/hooks/useProject.ts',          // Project hook
          'src/store/useProjectStore.ts'          // Project state
        ],
        sections: {}
      }
    },

    linkedTo: 'backend.tenancy',

    // Only deploy customers-portal if B2B2C is selected
    shouldInclude: (choices) => choices.userModel === 'b2b2c'
  },

  // Infrastructure (Docker Compose orchestration)
  infrastructure: {
    base: 'infrastructure/base',
    sectionsDir: 'infrastructure/variants/sections',
    filesDir: 'infrastructure/variants/files',

    variants: {
      // B2B2C variant: Adds customers-portal service to docker-compose files
      'b2b2c': {
        files: [],

        sections: {
          'docker-compose.yml': [
            'B2B2C_CUSTOMERS_PORTAL_SERVICE'
          ],
          'docker-compose.dev.yml': [
            'B2B2C_CUSTOMERS_PORTAL_SERVICE',
            'B2B2C_CUSTOMERS_PORTAL_VOLUMES'
          ],
          'docker-compose.prod.yml': [
            'B2B2C_CUSTOMERS_PORTAL_SERVICE'
          ]
        }
      }
    },

    linkedTo: 'backend.userModel'
  }
};

/**
 * Get variant configuration for a service
 * @param {string} serviceName - Service name (backend, admin-portal, etc.)
 * @returns {object|null} Service variant configuration
 */
function getVariantConfig(serviceName) {
  return VARIANT_CONFIG[serviceName] || null;
}

/**
 * Get variant prompts for user selection
 * @returns {object} Prompts configuration
 */
function getVariantPrompts() {
  return VARIANT_CONFIG.backend.prompts;
}

/**
 * Resolve variant choices for all services
 * @param {object} backendChoices - User's choices for backend variants
 * @returns {object} Variant choices for all services
 */
function resolveVariantChoices(backendChoices) {
  const choices = {
    backend: backendChoices
  };

  // Resolve linked services
  Object.keys(VARIANT_CONFIG).forEach(serviceName => {
    if (serviceName === 'backend') return;

    const serviceConfig = VARIANT_CONFIG[serviceName];
    if (serviceConfig.linkedTo) {
      // Parse linkedTo (e.g., "backend.tenancy")
      const [linkedService, linkedDimension] = serviceConfig.linkedTo.split('.');
      choices[serviceName] = {
        [linkedDimension]: backendChoices[linkedDimension]
      };
    }
  });

  // Special case: admin-portal inherits BOTH tenancy and userModel
  if (choices['admin-portal']) {
    choices['admin-portal'].userModel = backendChoices.userModel;
  }

  // Special case: infrastructure needs BOTH tenancy and userModel for proper variant resolution
  if (choices['infrastructure']) {
    choices['infrastructure'].tenancy = backendChoices.tenancy;
  }

  return choices;
}

/**
 * Get variants to apply (exclude defaults)
 * @param {object} choices - User's variant selections
 * @returns {string[]} List of variant names to apply
 */
function getVariantsToApply(choices) {
  const variantsToApply = [];

  const isMultiTenant = choices.tenancy === 'multi-tenant';
  const isSingleTenant = choices.tenancy === 'single-tenant';
  const isB2B2C = choices.userModel === 'b2b2c';
  const isB2B = choices.userModel === 'b2b';

  // Handle variant combinations
  if (isMultiTenant && isB2B2C) {
    // B2B2C + Multi-tenant: Apply both variants then combo
    variantsToApply.push('multi-tenant');       // Apply multi-tenant first (for projects module, etc.)
    variantsToApply.push('b2b2c');              // Apply B2B2C sections (REGULAR_USER, userBusinesses)
    variantsToApply.push('b2b2c_multi-tenant'); // Then apply combo files (overwrites with combined versions)
  } else if (isSingleTenant && isB2B2C) {
    // B2B2C + Single-tenant: Apply B2B2C then single-tenant combo
    variantsToApply.push('b2b2c');              // Apply B2B2C sections first
    variantsToApply.push('b2b2c_single-tenant'); // Then apply single-tenant combo
  } else if (isMultiTenant && (isB2B || !choices.userModel)) {
    // B2B + Multi-tenant: Apply only multi-tenant
    variantsToApply.push('multi-tenant');
  } else if (isSingleTenant && !choices.userModel) {
    // Single-tenant only (e.g., customers-portal): Apply single-tenant variant
    variantsToApply.push('single-tenant');
  }
  // else: B2B + Single-tenant (base template, no variants)

  return variantsToApply;
}

module.exports = {
  VARIANT_CONFIG,
  getVariantConfig,
  getVariantPrompts,
  resolveVariantChoices,
  getVariantsToApply
};
