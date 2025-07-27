import { PermissionService } from '../src/lib/services/permission-service'

async function initializePermissions() {
  console.log('Initializing permissions system...')
  
  try {
    await PermissionService.initializePermissions()
    console.log('✅ Permissions initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize permissions:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  initializePermissions()
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Unexpected error:', error)
      process.exit(1)
    })
}