/**
 * WebdriverIO configuration for Tauri E2E testing
 * 
 * This tests the FULL Tauri app (Rust backend + React frontend) using:
 * - tauri-driver: Wraps the native WebDriver (must be started separately or via hook)
 * - msedgedriver: Microsoft Edge WebDriver (Windows)
 * 
 * Prerequisites:
 * 1. Install tauri-driver: cargo install tauri-driver (on PATH)
 * 2. Edge WebDriver: downloaded automatically via devDependency `edgedriver` into e2e-webdriver/
 *    (override CDN with EDGEDRIVER_CDNURL if needed)
 * 3. Build the app: bun run tauri build
 * 
 * Run tests:
 *   bun run test:e2e
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { waitForAppReady } from './e2e-webdriver/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the built Tauri app
const tauriAppPath = path.join(__dirname, 'src-tauri', 'target', 'release', 'Wingosy Launcher.exe');

const edgeDriverDir = path.join(__dirname, 'e2e-webdriver');
const edgeDriverPath = path.join(edgeDriverDir, 'msedgedriver.exe');

let tauriDriver;

export const config = {
  // Use local runner
  runner: 'local',
  
  // Test files - run in order: setup first, then core features
  specs: [
    './e2e-webdriver/setup-wizard.spec.js',
    './e2e-webdriver/app.spec.js',
    './e2e-webdriver/immersive.spec.js',
    './e2e-webdriver/rom-download.spec.js',
    './e2e-webdriver/settings.spec.js',
    './e2e-webdriver/emulator-sensing.spec.js',
    './e2e-webdriver/emulator-download.spec.js',
    './e2e-webdriver/retroarch-cores.spec.js',
    './e2e-webdriver/game-launch.spec.js',
    './e2e-webdriver/game-launch-gba.spec.js',
    './e2e-webdriver/coverage-analysis.spec.js',
  ],
  
  // Exclude patterns
  exclude: [],
  
  // Max instances - must be 1 for Tauri (single app instance)
  maxInstances: 1,
  
  // Capabilities - connect to tauri-driver on port 4444
  capabilities: [{
    browserName: 'wry',
    'tauri:options': {
      application: tauriAppPath,
    },
  }],
  
  // Log level
  logLevel: 'info',
  
  // Bail after failures (0 = run all tests)
  bail: 0,
  
  // Base URL (not used for Tauri)
  baseUrl: '',
  
  // Default timeout for waitFor commands - increased significantly
  waitforTimeout: 30000,
  
  // Connection to tauri-driver
  hostname: 'localhost',
  port: 4444,
  path: '/',
  
  // Connection retry - increased
  connectionRetryTimeout: 180000,
  connectionRetryCount: 5,
  
  // Disable automatic driver management - we use tauri-driver
  automationProtocol: 'webdriver',
  
  // Framework
  framework: 'mocha',
  
  // Reporters
  reporters: ['spec'],
  
  // Mocha options
  mochaOpts: {
    ui: 'bdd',
    timeout: 300000, // 5 minutes for download tests
  },
  
  // Start tauri-driver before tests
  onPrepare: async function () {
    const { download } = await import('edgedriver');
    console.log('Ensuring msedgedriver.exe in e2e-webdriver/...');
    await download(undefined, edgeDriverDir);
    console.log(`EdgeDriver path: ${edgeDriverPath}`);

    console.log('Starting tauri-driver with EdgeDriver...');
    console.log(`App path: ${tauriAppPath}`);
    
    // Start tauri-driver pointing to msedgedriver
    tauriDriver = spawn('tauri-driver', ['--native-driver', edgeDriverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    
    tauriDriver.stdout.on('data', (data) => {
      console.log(`[tauri-driver] ${data.toString().trim()}`);
    });
    
    tauriDriver.stderr.on('data', (data) => {
      console.error(`[tauri-driver stderr] ${data.toString().trim()}`);
    });
    
    tauriDriver.on('error', (err) => {
      console.error(`[tauri-driver] Failed to start: ${err.message}`);
    });
    
    tauriDriver.on('close', (code) => {
      console.log(`[tauri-driver] Exited with code ${code}`);
    });
    
    // Wait longer for tauri-driver to start
    console.log('Waiting for tauri-driver to start (5 seconds)...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('tauri-driver should be ready');
  },
  
  // Stop tauri-driver after tests
  onComplete: async function () {
    console.log('Stopping tauri-driver...');
    if (tauriDriver) {
      tauriDriver.kill('SIGTERM');
      // Wait a bit for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  },
  
  // Before test suite - wait for app shell (avoid partial-text selectors that hit <title>)
  before: async function () {
    await browser.pause(2000);

    try {
      const handles = await browser.getWindowHandles();
      if (handles.length > 1) {
        for (const handle of handles) {
          await browser.switchToWindow(handle);
          const url = await browser.getUrl().catch(() => 'unknown');
          if (url !== 'about:blank') break;
        }
      }
    } catch (err) {
      console.log(`[wdio before] window handles: ${err.message}`);
    }

    const ready = await waitForAppReady(45);
    if (!ready) {
      try {
        const source = await browser.getPageSource();
        console.log(`[wdio before] Page source length: ${source.length}`);
        console.log(`[wdio before] Preview: ${source.substring(0, 600)}`);
      } catch (err) {
        console.log(`[wdio before] Could not get page source: ${err.message}`);
      }
    }
  },
  
  // After each test
  afterTest: async function (test, context, { error, passed }) {
    if (!passed) {
      console.log(`Test failed: ${test.title}`);
    }
    // Small pause between tests to let UI settle
    await browser.pause(500);
  },
};
