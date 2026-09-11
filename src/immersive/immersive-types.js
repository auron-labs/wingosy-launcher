/**
 * @typedef {Object} ImmersiveGame
 * @property {number|string} id
 * @property {string} name
 * @property {string} platform_id
 * @property {string} [file_path]
 * @property {string} [source]
 * @property {number|null} [romm_id]
 * @property {string|null} [summary]
 * @property {string|null} [cover_path]
 * @property {string[]} [screenshot_paths]
 * @property {boolean} [is_favorite]
 * @property {boolean} [is_hidden]
 * @property {string|null} [local_file_path]
 * @property {string} [sync_state]
 */

/**
 * @typedef {Object} ImmersivePlatform
 * @property {string} id
 * @property {string} name
 * @property {string|null} [short_name]
 */

/** @typedef {[ImmersivePlatform, number]} PlatformEntry */

/**
 * @typedef {Object} GamesPage
 * @property {ImmersiveGame[]} games
 * @property {number} total
 */

/**
 * @typedef {Object} AmbientAudioConfig
 * @property {boolean} [ambient_enabled]
 * @property {string|null} [ambient_path]
 * @property {boolean} [ambient_is_folder]
 * @property {boolean} [ambient_shuffle]
 * @property {number} [ambient_volume]
 */

/**
 * @typedef {Object} ImmersiveConfig
 * @property {{big_picture?: boolean, fullscreen?: boolean, controller_deadzone?: number, retroachievements_enabled?: boolean}} [display]
 * @property {AmbientAudioConfig} [audio]
 */

/**
 * @typedef {Object} LaunchResult
 * @property {boolean} success
 * @property {string} [error]
 * @property {unknown[]} [save_sync_messages]
 * @property {string[]} [save_sync_warnings]
 */

export {};
