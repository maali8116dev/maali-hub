# Maintenance Mode

The application includes a maintenance mode feature that allows you to display a user-friendly maintenance screen when the application is under maintenance.

## How to Enable Maintenance Mode

To enable maintenance mode, set the following environment variable in your `.env` file:

```env
VITE_MAINTENANCE_MODE=true
```

## Optional Configuration

You can customize the maintenance screen with additional environment variables:

```env
# Enable maintenance mode
VITE_MAINTENANCE_MODE=true

# Custom message (optional)
VITE_MAINTENANCE_MESSAGE="We're currently performing scheduled maintenance to improve your experience."

# Estimated completion time (optional)
VITE_MAINTENANCE_ESTIMATED_TIME="2:00 PM EST"

# Contact email for support (optional)
VITE_MAINTENANCE_CONTACT_EMAIL="support@example.com"
```

## How It Works

1. When `VITE_MAINTENANCE_MODE=true` is set, the maintenance screen will be displayed instead of the normal application routes.
2. All routes are blocked and users will only see the maintenance screen.
3. The maintenance screen includes:
   - A clear "Under Maintenance" message
   - An optional custom message
   - An optional estimated completion time
   - An optional contact email link
   - Professional styling with animations

## Disabling Maintenance Mode

To disable maintenance mode, simply remove the environment variable or set it to `false`:

```env
VITE_MAINTENANCE_MODE=false
```

Or remove the line entirely from your `.env` file.

## Implementation Details

- **Component**: `src/components/MaintenanceMode.tsx`
- **Configuration**: `src/lib/maintenanceMode.ts`
- **Integration**: `src/App.tsx`

The maintenance mode check happens at the application root level, before any routes are rendered, ensuring all users see the maintenance screen when enabled.

## Notes

- Environment variables must be prefixed with `VITE_` to be accessible in the Vite build
- Changes to environment variables require a restart of the development server or a rebuild in production
- The maintenance mode completely blocks access to all routes, including admin and reviewer routes
