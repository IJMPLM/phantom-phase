Project Init:

1. Clone repo
2. npm install //install all dependencies

Workflow:

1. Complete .env and manifest.json for bp and rp
2. Write scripts/other bp and rp modifications
3. Run build and package to create main.js and copy packs to directory specified in .env

Debugging Init:

1. Start debugging in vs code to open the port
2. Open Minecraft and enter a world where the scripts are enabled then enter /script debugger connect

For Dementia:

- npm run build for scripts in package.json
- npx just-scripts for scripts in just.config.ts
- node script.js for any other script
- tsc script.ts for direct tranpilation
