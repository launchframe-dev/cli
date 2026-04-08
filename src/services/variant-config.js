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
          'src/domain/projects',                    // Entire projects module
          'src/core/guards/project-ownership.guard.ts', // Project ownership guard (header-based)
          'src/core/guards/project-param.guard.ts',     // Project param guard (route-based)
          'src/core/users/users.service.ts',        // Users service with multi-tenant support
          'src/core/users/users.controller.ts',     // Users controller with multi-tenant support
          'src/core/users/create-user.dto.ts'       // CreateUserDto with businessId
        ],

        // Code sections to insert into base template files
        // Note: main.ts uses PRIMARY_DOMAIN env var for dynamic CORS - no sections needed
        sections: {
          'src/core/app/app.module.ts': [
            'PROJECTS_MODULE_IMPORT',       // Add ProjectsModule import
            'PROJECTS_MODULE'               // Add ProjectsModule to imports array
          ],
          'src/core/auth/auth.module.ts': [
            'MULTI_TENANT_IMPORTS',         // Add Project entity import
            'MULTI_TENANT_TYPEORM'          // Add Project to TypeOrmModule
          ],
          'src/core/users/user.entity.ts': [
            'PROJECTS_RELATIONSHIP_IMPORT', // Add Project entity import
            'PROJECTS_RELATIONSHIP'         // Add projects relationship
          ],
          'src/core/users/users.module.ts': [
            'MULTI_TENANT_IMPORTS',          // Add Projects-related imports
            'MULTI_TENANT_ENTITIES',         // Add Project entities to TypeORM
            'MULTI_TENANT_MODULE_IMPORTS',   // Add ProjectsModule to imports
            'MULTI_TENANT_PROVIDERS'         // Add multi-tenant providers
          ]
        }
      },

      // B2B2C variant: Adds regular_user support with separate customer auth
      'b2b2c': {
        // Complete files to copy
        files: [
          'src/core/users/user-business.entity.ts',           // Business-to-user linking entity
          'src/core/auth/auth-customer.ts',                   // Customer auth config (regular_user, customer_ cookie)
          'src/core/auth/better-auth-customer.controller.ts', // Customer auth controller (/api/auth/customer)
          'src/core/auth/auth.module.ts',                     // Auth module with customer controller
          'src/core/auth/better-auth.guard.ts',               // Guard handling both auth instances
        ],

        // Code sections to insert
        sections: {
          'src/core/users/user.entity.ts': [
            'B2B2C_IMPORTS',           // Add UserBusiness import
            'B2B2C_USER_ROLE',         // Add REGULAR_USER enum value
            'B2B2C_RELATIONSHIPS'      // Add userBusinesses relationship
          ],
          'src/core/users/users.module.ts': [
            'B2B2C_IMPORTS',           // Add UserBusiness import
            'B2B2C_ENTITIES'           // Add UserBusiness to TypeORM
          ],
          'src/core/database/migrations/1764300000001-CreateSessionsTable.ts': [
            'B2B2C_TENANT_COLUMN'      // Add tenant_id column for session scoping
          ]
        }
      },

      // B2B2C + Single-tenant combination variant (NEW)
      'b2b2c_single-tenant': {
        // Complete files to copy (B2B2C features without multi-tenant projects)
        files: [
          'src/core/guards/business-scoping.guard.ts',                         // Business scoping guard
          'src/domain/business/business.controller.ts',           // Business lookup controller
          'src/domain/business/business.service.ts',              // Business lookup service
          'src/domain/business/business.module.ts',               // Business module
          'src/domain/business/entities/business.entity.ts',      // Business entity
          'src/domain/business/dto/business-response.dto.ts',     // Business response DTO
          'src/domain/business/dto/create-business.dto.ts',       // Business create DTO
          'src/core/database/migrations/1766688416362-CreateBusinessesTable.ts', // Businesses table migration
          'src/core/auth/auth.ts',                                     // Better Auth config with Business entity
          'src/core/users/user-business.entity.ts',                    // Business-to-user linking entity
          'src/core/users/users.module.ts',                            // Users module with Business entity
          'src/core/users/users.controller.ts',                        // Users controller (B2B2C)
          'src/core/users/users.service.ts',                           // Users service (B2B2C)
          'src/core/users/create-user.dto.ts'                          // CreateUserDto with businessId
        ],

        sections: {
          'src/core/app/app.module.ts': [
            'BUSINESS_MODULE_IMPORT',    // Import BusinessModule
            'BUSINESS_MODULE'             // Add BusinessModule to imports
          ],
          'src/core/users/user.entity.ts': [
            'BUSINESS_RELATIONSHIP_IMPORT', // Import Business entity
            'BUSINESS_RELATIONSHIP'         // Add business relationship
          ]
        }
      },

      // B2B2C + Multi-tenant combination variant (RENAMED from multi-tenant_b2b2c)
      'b2b2c_multi-tenant': {
        // Complete files to copy (has both multi-tenant and B2B2C features)
        files: [
          'src/core/users/user-business.entity.ts',         // Business-to-user linking entity
          'src/core/auth/auth.ts',                          // Combined Better Auth config
          'src/core/users/users.service.ts',                // Combined users service
          'src/core/users/users.controller.ts',             // Combined users controller
          'src/domain/projects/projects.module.ts'          // Projects module with UserBusiness
        ],

        // No sections needed - complete files already have all features
        sections: {}
      },

      // RBAC variant: Adds role-based permission system
      'rbac': {
        files: [
          'src/core/auth/auth.ts',
          'src/core/auth/permissions.enum.ts',
          'src/core/auth/permissions.seeder.ts',
          'src/core/auth/guards/permission.guard.ts',
          'src/core/auth/decorators/requires-permission.decorator.ts',
          'src/core/roles/role.entity.ts',
          'src/core/roles/permission.entity.ts',
          'src/core/roles/roles.module.ts',
          'src/core/roles/roles.controller.ts',
          'src/core/roles/roles.service.ts',
          'src/core/team/team.module.ts',
          'src/core/team/team.controller.ts',
          'src/core/team/team.service.ts',
          'src/core/team/entities/user-role-assignment.entity.ts',
          'src/core/team/entities/team-invitation.entity.ts',
          'src/core/team/dtos/invite-team-member.dto.ts',
          'src/core/team/dtos/finalize-invite.dto.ts',
          'src/core/database/migrations/1767100000000-CreateRbacTables.ts',
        ],
        sections: {
          'src/core/users/user.entity.ts': ['RBAC_COLUMNS'],
          'src/core/auth/auth.module.ts': ['RBAC_GUARDS_IMPORT', 'RBAC_GUARDS'],
          'src/core/app/app.module.ts': ['RBAC_MODULE_IMPORT', 'RBAC_MODULE'],
          'src/core/admin/admin.module.ts': [
            'RBAC_ADMIN_IMPORTS',
            'RBAC_ADMIN_TYPEORM',
            'RBAC_ADMIN_PROVIDERS',
            'RBAC_ADMIN_CONTROLLERS',
          ],
          'src/core/users/users.controller.ts': [
            'RBAC_RETURN_ISOWNER',             // Add isOwner and businessId to profile response
          ],
          'src/core/users/dtos/user-query.dto.ts': [
            'RBAC_BUSINESS_ID',
            'RBAC_IS_NOT_EMPTY_VALIDATOR'
          ]
        },
      },

      // RBAC + Multi-tenant: adds projectId to assignments and project-scoped guard
      'rbac_multi-tenant': {
        files: [
          'src/core/auth/guards/permission.guard.ts',
          'src/core/team/entities/user-role-assignment.entity.ts',
          'src/core/team/team.service.ts',
          'src/core/team/team.controller.ts',
          'src/core/database/migrations/1767100000001-AddProjectIdToUserRoleAssignments.ts',
        ],
        sections: {
          'src/domain/projects/services/projects.service.ts': [
            'RBAC_DATASOURCE_IMPORT',           // Add DataSource import
            'RBAC_DATASOURCE_CONSTRUCTOR',       // Inject DataSource into constructor
            'RBAC_ACCESSIBLE_PROJECTS_METHOD',   // Add getAccessibleProjectsForMember method
          ],
          'src/core/users/users.controller.ts': [
            'RBAC_MT_GET_PROJECTS',             // Override to use accessible projects for invited members
          ],
        },
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
      },
      permissions: {
        message: 'Do you need role-based access control (RBAC) for team members?',
        choices: [
          {
            name: 'Basic — single role per user, no team management',
            value: 'basic',
            description: 'Each user has one role. No team invitations or per-route permission guards.',
            isDefault: true,
          },
          {
            name: 'RBAC — roles, permissions, team invitations',
            value: 'rbac',
            description: 'Full RBAC: superadmin defines roles, owners invite team members, PermissionGuard protects routes.',
          },
        ],
        default: 'basic',
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
          'src/pages/Customers.tsx'      // Customers page for managing end customers
        ],

        sections: {
          'src/components/Layout.tsx': [
            'B2B2C_CUSTOMER_ICON_IMPORT',   // Import UserIcon for Customers menu
            'B2B2C_CUSTOMERS_MENU'          // Add Customers menu item for customer management
          ],
          'src/App.tsx': [
            'B2B2C_CUSTOMERS_IMPORT',       // Import Customers page component
            'B2B2C_CUSTOMERS_ROUTE'         // Add /customers route
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
      },

      'rbac': {
        files: [
          'src/admin/pages/AdminRoles.tsx',
          'src/admin/pages/AdminPermissions.tsx',
          'src/pages/Team.tsx',
          'src/pages/AcceptInvite.tsx',
        ],
        sections: {
          'src/App.tsx': [
            'RBAC_ADMIN_ROLES_IMPORT',
            'RBAC_ADMIN_PERMISSIONS_IMPORT',
            'RBAC_ADMIN_ROUTES',
            'RBAC_TEAM_IMPORT',
            'RBAC_TEAM_ROUTE',
            'RBAC_INVITE_IMPORT',
            'RBAC_INVITE_ROUTE',
            { name: 'RBAC_B2B2C_ONBOARDING_CHECK', optional: true },  // Only for b2b2c single-tenant
          ],
          'src/components/Layout.tsx': [
            'RBAC_ADMIN_MENU_ITEMS',
            'RBAC_TEAM_MENU_ITEM',
          ],
          'src/types/index.ts': [
            'ISOWNER_FIELD',               // Add isOwner to User interface
          ],
        },
      },

      'rbac_multi-tenant': {
        files: [
          'src/pages/Team.tsx',
        ],
        sections: {
          'src/App.tsx': [
            'RBAC_MT_ONBOARDING_CHECK',    // Override: only redirect owners to /first-project
          ],
        },
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
      'b2b2c_single-tenant': {
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
      },

      'b2b2c': {
        // B2B2C uses separate auth endpoint for customer sessions
        files: [
          'src/lib/auth-client.ts'                // Auth client with /api/auth/customer basePath
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
    choices['admin-portal'].permissions = backendChoices.permissions;
  }

  // Special case: customers-portal inherits BOTH tenancy and userModel
  if (choices['customers-portal']) {
    choices['customers-portal'].userModel = backendChoices.userModel;
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

  const isRbac = choices.permissions === 'rbac';

  if (isRbac && isMultiTenant) {
    variantsToApply.push('rbac');
    variantsToApply.push('rbac_multi-tenant');
  } else if (isRbac) {
    variantsToApply.push('rbac');
  }

  return variantsToApply;
}

module.exports = {
  VARIANT_CONFIG,
  getVariantConfig,
  getVariantPrompts,
  resolveVariantChoices,
  getVariantsToApply
};
