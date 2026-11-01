# Construction Workbench

A Blazor WebAssembly sandbox for semantic-construction-grammar research. Stage 1 explores editable wall pieces, spatial placement, and optional snapping on an XZ construction plane. The renderer uses browser-native WebGPU; wall state is independent of GPU resources.

## Run locally

Requires the .NET 10 SDK and a browser with WebGPU support. From the repository root:

```sh
dotnet run --project sandboxes/modular-apartment-playground/ModularApartmentPlayground.csproj
```

For a Release build:

```sh
dotnet build sandboxes/modular-apartment-playground/ModularApartmentPlayground.csproj --configuration Release
```

WebGPU requires a secure context, such as `localhost` or HTTPS. Plain HTTP at a LAN IP is not a secure context; use localhost or HTTPS when testing WebGPU. The page reports insecure contexts, unsupported WebGPU, initialization errors, and device loss. **Retry graphics** attempts to restore the renderer without discarding in-memory walls.

If running the app on a different machine from the VS Code client, keep the server bound to loopback and use the repository's [local testing skill](../../.github/skills/local-testing-deployment/SKILL.md) to forward a port. Port `5290` is the standard local test port and is configured for VS Code Remote auto-forwarding and restoration. If it is occupied, use and forward a free alternate port.

## Construction controls

- **Place wall** starts a preview. Move the pointer over the plane and click to place; the preview-rotation buttons change its direction. Escape or **Cancel** abandons the preview.
- Click a wall to select it. Use the inspector to move, rotate, duplicate, or delete it. **Move** and **Duplicate** use a preview and a second click on the plane.
- **Undo** and **Redo** cover wall additions, moves, rotations, and deletions. Camera and grid settings are not wall edits.
- The grid can be shown or hidden independently of snapping. Grid spacing defaults to 0.5 units and ranges from 0.1 to 5; rotation increments default to 90 degrees and range from 1 to 360. With snapping off, placement is free and the inspector accepts an arbitrary rotation angle. Invalid values produce feedback and restore the last accepted setting.
- Drag to orbit around the ground point under the cursor. Right-drag or Shift-drag pans across XZ; scroll zooms; double-click resets the camera without resetting walls.
- A viewport click is applied after about half a second so a double-click can reset the camera without also editing a wall.

The fixed wall type is 2 units long, 2.4 high, and 0.14 thick. Its pivot is at the center of its base; Y is vertical and the XZ construction plane is at Y=0. Positive rotation is about Y, with a wall initially extending along X.

Manual wall overlaps and crossings are allowed but produce a warning. Ordinary shared end-to-end joints are not warned. Near-touching ends are not automatically joined or treated as a closed boundary. These experimental manual-editing rules do not change the project's collision requirements for generated construction.

## Current scope and limitations

- Walls are independent and editable, but the scene exists only in memory. Reloading or closing the page discards it.
- The visible ground and grid are construction guides, not generated room floors. Automatic floor/ceiling generation, lights, wall variants, persistence, and semantic grammar execution remain later work.
- WebGL2 remains deferred unless testing demonstrates a compatibility need.
- See [CONSTRUCTION_WORKBENCH_BRIEF.md](CONSTRUCTION_WORKBENCH_BRIEF.md) for the staged research direction and open questions.

## Validation and publishing

Run the dependency-free JavaScript tests from the repository root:

```sh
node --experimental-default-type=module --test sandboxes/modular-apartment-playground/tests/*.test.mjs
```

The automated graphics-diagnostic and retry tests simulate insecure contexts, unavailable WebGPU, initialization failures, and device loss. They do not establish that every failure and recovery path has been exercised on an affected browser or device.

The sandbox also has a GitHub Actions build-validation workflow. Publishing is intentionally separate: run the repository's **Publish modular apartment playground** workflow manually from the Actions tab. The repository's Settings → Pages → Build and deployment source must be set to **GitHub Actions** before the first deployment.
