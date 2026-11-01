---
name: local-testing-deployment
description: 'Run a sandbox locally on the agent host and open it in the VS Code integrated browser on a different machine through SSH port forwarding. Use when: running, previewing, serving, or browser-testing a sandbox; local testing; checking WebGPU or WebGL2 in a browser; dev server, localhost, port forwarding, or SSH tunnel setup; stopping a running sandbox server.'
argument-hint: 'Sandbox project to run, e.g. sandboxes/modular-apartment-playground'
---

# Local testing deployment

Run a sandbox's development server on the machine where the agent executes, and let the user view it from the VS Code client on a **different machine** through an SSH port forward.

## Why port forwarding

- The agent host and the user's VS Code window run on different machines. The integrated browser runs on the user's machine, so its `localhost` is not the agent host.
- WebGPU requires a secure context: `localhost` or HTTPS. A plain-HTTP LAN address such as `http://192.168.x.x:5290` is not secure, so WebGPU appears unavailable even on capable hardware.
- Forwarding a local port on the user's machine to the agent host makes the page load from `http://localhost:<port>`, which satisfies the secure-context requirement without certificates or open LAN ports.
- This workspace is configured to auto-forward and restore port `5290` for the Construction Workbench. Prefer that standard port when it is available; use the Ports panel or a separate manual tunnel only when automatic forwarding does not engage.

## Rules

- Bind the server to `127.0.0.1` only. Do not listen on `0.0.0.0` or change firewall settings unless the user explicitly requests LAN exposure; if they do, explain that WebGPU will not be a fair test over plain HTTP.
- Determine the host address and username at run time. Do not write IP addresses, usernames, or hostnames into repository files; the repository is public.
- Start the server with the bash tool in `async` mode with `detach: true` and a recognizable `shellId`, such as `sandbox-devserver`. Do not use `nohup`, `&`, or `disown`.
- Do not change project manifests or lockfiles to make the server start. Restoring existing dependencies is fine.
- Stop the server when testing is finished, unless the user wants it left running. Report whether it is still running when you hand back control.

## Procedure

1. **Choose the project and port.** For a Blazor sandbox, use the `.csproj` under the requested sandbox directory and its `http` port in `Properties/launchSettings.json` (5290 for the modular apartment playground). This standard port is configured for automatic forwarding and restoration in `.vscode/settings.json`. Check that the port is free:

   ```sh
   ss -tlnp | grep ':<port>\b'
   ```

   If something already listens, determine whether it is a previous sandbox server to reuse or stop. Do not stop unrelated processes; choose another free port and forward that port for this session instead.

2. **Build or restore if needed.** If a build fails with `NETSDK1112` (missing `Microsoft.NETCore.App.Runtime.Mono.browser-wasm` pack), restore the existing project's runtime pack, then retry:

   ```sh
   dotnet restore <project.csproj> --runtime browser-wasm
   ```

3. **Start the server on loopback.** From the repository root, run detached:

   ```sh
   ASPNETCORE_URLS=http://127.0.0.1:<port> ASPNETCORE_ENVIRONMENT=Development \
     dotnet run --project <project.csproj> --no-launch-profile --no-restore
   ```

   `--no-launch-profile` prevents `launchSettings.json` from overriding the URL or launching a browser on the host.

4. **Verify readiness and print connection details.** Wait for startup, then run the bundled [check script](./scripts/check-server.sh):

   ```sh
   bash .github/skills/local-testing-deployment/scripts/check-server.sh <port>
   ```

   It confirms the loopback listener and an HTTP 200 response, then prints the SSH forwarding command using this host's current LAN address and username. If the check fails, read the server output with `read_bash` before retrying.

5. **Use automatic forwarding first.** For port 5290, VS Code Remote should forward it automatically and restore the forward in later sessions. If it does not, check the **Ports** panel and forward the listening port. Only as a fallback, ask the user to start a manual SSH forward on the machine running VS Code:

   ```sh
   ssh -N -L <port>:localhost:<port> <user>@<host-ip>
   ```

   The command printed by the check script is for the VS Code/client machine, not a terminal on the agent host.

6. **Open the page in the integrated browser** after the user confirms the forward: search for the browser tools, then open `http://localhost:<port>`. Read or screenshot the page to report what renders, including any WebGPU or WebGL status messages. Distinguish verified browser behavior from build-only checks.

7. **Stop the server** when finished: use `stop_bash` with the server's `shellId`, then confirm the port no longer listens. If a manual SSH forward was used, tell the user they can end it with Ctrl+C.

## Troubleshooting

| Symptom | Likely cause and action |
|---|---|
| `NETSDK1112` during build or run | Missing WebAssembly runtime pack; restore with `--runtime browser-wasm` (step 2). |
| Server port already in use | A previous server is still running, or another process uses the port; reuse it, stop the sandbox server, or pick another port. |
| `bind: Address already in use` from `ssh -L` | The port is busy on the user's machine; forward a different local port, such as `-L 5391:localhost:5290`, and open that local port. |
| Page loads but WebGPU is unavailable | Confirm the URL is `localhost`, not the LAN IP. If it is `localhost`, the browser, flags, or GPU driver may lack WebGPU support; WebGL2 testing remains valid. |
| Integrated browser cannot connect | The SSH forward is not running, the server stopped, or it is bound to a different port; recheck with the script. |
