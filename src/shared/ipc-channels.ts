export const IPC = {
  PROJECTS_LIST: 'projects:list',
  PROJECT_ADD: 'project:add',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_TOGGLE_FAVORITE: 'project:toggle-favorite',
  PROJECT_CREATE: 'project:create',
  PROJECT_CREATE_PROGRESS_EVENT: 'project:create-progress',

  PROCESS_START: 'process:start',
  PROCESS_STOP: 'process:stop',
  PROCESS_RESTART: 'process:restart',
  PROCESS_KILL: 'process:kill',

  STATS_SNAPSHOT: 'stats:snapshot',
  STATS_UPDATE_EVENT: 'stats:update',

  LOGS_GET: 'logs:get',
  LOGS_CLEAR: 'logs:clear',
  LOGS_APPEND_EVENT: 'logs:append',

  DIALOG_PICK_DIRECTORY: 'dialog:pick-directory',
  DIALOG_PICK_REGISTRY_LOCATION: 'dialog:pick-registry-location',
  DIALOG_PICK_IMPORT_FILE: 'dialog:pick-import-file',
  FS_SCAN_DIRECTORY: 'fs:scan-directory',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  SHELL_OPEN_EXTERNAL: 'shell:open-external',
  CLIPBOARD_WRITE: 'clipboard:write',

  REGISTRY_GENERATE: 'registry:generate',
  REGISTRY_IMPORT: 'registry:import',

  CONFIG_GENERATE_AI_FILES: 'config:generate-ai-files',

  AI_INTEGRATION_STATUS: 'ai-integration:status',
  AI_INTEGRATION_REGENERATE_TOKEN: 'ai-integration:regenerate-token',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MAXIMIZED_EVENT: 'window:maximized-changed',

  PROJECT_STATUS_EVENT: 'project:status-changed',
  PROJECT_LAUNCH_NOTICE_EVENT: 'project:launch-notice'
} as const
