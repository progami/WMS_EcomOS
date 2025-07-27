## Lyra's Instructions for Implementation AI: Repository Cleanup and Restructuring - Phase 1

**Goal:** Begin the process of streamlining the WMS repository by removing clearly redundant logging-related files and consolidating `package.json` scripts. This phase focuses on low-risk removals and reorganizations.

---

### 1. Remove Redundant Logging Wrappers

With the introduction of `log-runner.js` and the updated `package.json` scripts, several older logging-related files are now redundant and can be safely removed.

**Action:** Delete the following files from the project root:

*   `/Users/jarraramjad/Documents/ecom_os/WMS/capture-all-logs.sh`
*   `/Users/jarraramjad/Documents/ecom_os/WMS/run-dev-with-full-logging.js`
*   `/Users/jarraramjad/Documents/ecom_os/WMS/run-with-full-logging.js`

---

### 2. Consolidate `package.json` Scripts

The `package.json` contains several redundant or legacy `dev` and `start` script entries that are no longer needed with the `log-runner.js` setup.

**Action:** Modify `/Users/jarraramjad/Documents/ecom_os/WMS/package.json` to remove the following script entries:

*   `"dev:old": "node scripts/log-runner.js dev",`
*   `"dev:original": "node scripts/dev/dev-with-port.js",`
*   `"start:original": "NODE_ENV=production node server.js",`

**Note:** The `dev` and `start` scripts should now correctly point to `scripts/log-runner.js`. The `dev:logged` and `start:prod` scripts will be retained for now, as they directly invoke `server.js` and might be used in specific contexts not covered by `log-runner.js`.

---

### Verification (After Phase 1)

After completing this phase, run the following commands to ensure no regressions:

1.  **Clean and Build:**
    ```bash
    npm run clean && npm run build
    ```
    Ensure the build completes successfully.

2.  **Run Development Server with Logging:**
    ```bash
    npm run dev
    ```
    Verify that the server starts without errors and `logs/full-output.log` is created and populated with expected output.

3.  **Run Tests:**
    ```bash
    npm test
    ```
    Ensure all tests pass.
