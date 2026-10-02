@AGENTS.md

## Claude Code specifics
- `/farm <idea or slug>` (skill in `.claude/skills/farm`) runs the pipeline loop for you.
- In cloud sessions the network policy may block `expo.dev`, `api.appstoreconnect.apple.com` and `api.vercel.com`:
  do release/App Store Connect work through the GitHub Actions workflows (GitHub MCP `actions_run_trigger`).
  Chromium is at `/opt/pw-browsers` (found automatically); `ffmpeg` is installed.
- Headless runs: `npm run farm -- auto <slug> --agent claude` spawns `claude -p` for agent stages
  (`FARM_CLAUDE_PERMISSION_MODE`, `FARM_CLAUDE_MODEL` env to tune).
