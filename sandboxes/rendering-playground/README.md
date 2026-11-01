# Rendering Sandbox

A separate sandbox for rendering research, starting with the editable wall-placement scene from the [Construction Grammar Sandbox](../modular-apartment-playground/README.md). The walls provide a useful construction-grammar test scene; this sandbox's focus is understanding and comparing rendering techniques.

## Renderer modes

Choose between four renderers in **Shader experiment**:

- **Triangle mesh + surface shader** is the editable wall scene. The wall boxes become triangles, and the optional vent grill is still a flat per-fragment pattern. It does not change geometry, collision, or lighting normals.
- **Ray-marched SDF vent wall** draws two fixed reference walls with mathematical signed-distance functions (SDFs). Each wall is a box field; the vent is cut through it with a subtraction operation; the frame and horizontal slats are unions of box fields. Rays are marched through the field, and normals are estimated from nearby distance samples for lighting. Turning off **Carve vent opening through wall** restores a solid wall; disabling **Add math-defined slats** exposes the through-opening.
- **Ray-marched maintenance bay** draws a separate single-wall work area. The wall, floor, panel, pipes, fixed high work light, and concealed electrical arc are signed-distance functions evaluated by the ray marcher; no scene surface is modeled as triangles. A full-screen carrier triangle only launches camera rays. Capsule-shaped pipe runs leave a reach-through opening at the panel and several project into the room to cast shadows onto the wall and floor. The panel screen and red/white indicators are emissive but do not light nearby surfaces. The work light is stationary; the blue-white fault arc uses a deterministic burst pattern, can be disabled, and has an adjustable brightness. Four-sample tetrahedral normals remain view-independent while orbiting. Lower **Render resolution** if the scene is slow on the current device.
- **Matching triangles + shadow maps** generates the same reference hatch/vent assemblies as actual triangle surfaces with analytic face normals. Box subtraction creates the wall openings and hatch pockets; exposed union faces are split at intersections to avoid internal faces and coplanar overlap. Moving fixture geometry stays separate from the static union so its motion does not require remeshing the walls. It shares the SDF renderer's material colors, direct lighting, ambient fill, emission, floor, and optional SDF AO.

Both hatch-reference modes deliberately show the side-by-side comparison, not every editable wall, construction grid, or placement preview. The maintenance bay is a separate SDF-only scene. Construction data is unchanged and remains visible in the original triangle mode. All modes use the same orbit/zoom camera. Only the two hatch-reference modes are comparable performance scenes; the original editable scene and maintenance bay are not benchmark counterparts.

### Matched comparison controls

**Render resolution** selects 100%, 75%, or 50% of the existing pixel ratio (capped at DPR 2). Half width/height means one quarter of the pixels; the CSS viewport and camera aspect stay unchanged apart from pixel rounding. The setting applies to all modes and survives mode switches and graphics retries.

**Extra greebles per wall** selects 0, 8, 32, or 128 raised rectangular details along the upper wall, entirely inside the existing envelope. Both reference modes use the same deterministic grid and dimensions. The SDF computes the nearest repeated cell rather than looping through every extra box; the triangle mode regenerates its mesh only on geometry changes.

**Generated shadow-map size** selects 256, 512, or 1024 square depth pixels per light. The mesh mode uses an orthographic directional-light map and a 170-degree perspective map covering the overhead source's downward hemisphere. These are generated GPU depth resources, not painted/imported textures. This is not a general omnidirectional point-light/cube-map implementation.

The overhead map excludes its own fixture, matching the SDF visibility rule. The main map includes it. Both maps refresh when lamp movement changes their blockers/source, or geometry changes; camera movement, light-size filtering, and brightness-only flicker reuse them. Disabled lights skip their map passes and update stale occlusion when enabled again. Mesh shadows use depth bias and a nine-comparison filtered kernel (up to four texels of radius), retaining the 0.18 visibility floor. Their softness is intentionally not identical to the SDF angular-distance approximation; broad directional occlusion also replaces the SDF's four-unit trace cutoff. Map aliasing/bias and lower local-map angular resolution remain quality tradeoffs.

**Overhead light casts shadows**, beside the overhead light switch, independently gates its shadow work in both reference modes. It defaults on to preserve existing lighting and requires the shared shadow switch and local illumination. Turning it off leaves overhead light/emission and main-light shadows unchanged: SDF skips its local shadow trace; triangles skip local depth-map updates and lookups. Re-enabling refreshes stale occlusion after movement. The value survives reference-mode switches and graphics retries; reload resets it. The flag occupies the unused camera `up.w` uniform component (float index 31).

**Add pipes and clutter near hatch light** adds stationary box-section conduits, two couplings and wall brackets across the upper recessed hatch in both reference modes. They sit below the lamp, projecting from the wall into its light path (maximum Z 0.24, within the existing 0.27 envelope), and cast both local and main-light shadows. Unlike the emitter housing, this clutter remains in the overhead visibility field/map. Toggle overhead shadows to compare blocked versus unblocked illumination; animate the lamp to move the shadows over the stationary pipes and panel. The pipes use a copper-colored non-emissive material, not imported assets or rounded cylinder geometry. Clutter can remain visible with the light, fixture, or hatch disabled. It defaults off, survives reference-mode switches/retries, and invalidates both mesh shadow maps when changed. Its uniform flag is camera `right.w` (float index 27); the matched benchmark keeps the selected clutter setting in both cases.

**Overhead brightness** selects 0 to 4 times the original intensity (default 1). It scales strip emission and overhead illumination together, multiplying the smooth flicker factor once per frame in `accentSettings.w` (float index 55). It does not brighten the main source or ambient fill. Zero skips local shadow rays/map updates and stops brightness-only flicker rendering; lamp movement can still continue. Nonzero brightness adjustments reuse existing depth maps unless source/blocker geometry changed. The intensity survives mode switches and graphics retries, resets on reload, and is held constant across matched benchmark cases.

**Run matched comparison** tests 0, 32, and 128 extra greebles per wall at the current camera, pixel resolution, light switches, shading, and shadow-map size. Each case has three warmup submissions followed by twelve measured submissions; each waits for `GPUQueue.onSubmittedWorkDone()`. Results report the median CPU-submit-to-GPU-completion latency, not pure GPU timestamp duration or display FPS. With movement enabled, both modes receive the same sequence of lamp positions; with flicker enabled, brightness samples match as well. Static cases reuse warmed maps; moving cases refresh them. Construction state, selected mode, detail count, lamp phase, and flicker time are restored afterward. Keep the tab visible and camera/settings/viewport unchanged; interruptions and shader errors report failure rather than partial success. Reset edited reference shaders before comparing.

The shared SDF AO deliberately remains available on triangles so contact shading can be compared without introducing another technique. Turn it off to isolate triangle/depth-map costs; this path is not yet a completely SDF-free renderer. Numerical versus analytic normals, shadow algorithms, and SDF hit tolerance remain expected visual differences. Normal-map/depth-impostor techniques and analytic accelerated ray casting are later phases, not implemented here.

### Initial tablet observations (2026-10-31)

One matched run in the user's shared Surface Go 2 browser, with both lights and shadows enabled, 512-square maps, default shaders, light size 0.125, and the same camera:

| Extra greebles / wall | SDF, 447 x 540 | Mesh + maps, 447 x 540 | SDF, 223 x 270 | Mesh + maps, 223 x 270 |
| --- | --- | --- | --- | --- |
| 0 | 72.10 ms | 19.60 ms | 20.40 ms | 6.55 ms |
| 32 | 90.10 ms | 23.65 ms | 22.55 ms | 9.05 ms |
| 128 | 96.80 ms | 21.20 ms | 23.60 ms | 8.70 ms |

These are median submission-to-GPU-completion intervals, not GPU timestamps. The full-resolution pair had AO on and movement off (cached maps); the half-resolution pair had AO off and movement on (refreshed maps). Compare renderers within each pair, not resolution alone across pairs. Twelve samples are an initial observation, not a hardware-wide performance guarantee.

With 128 extra greebles per wall (5,796 reference-mesh triangles), half resolution, AO off, and moving-light shadows, live cadence reached 60 frames/s for mesh + maps versus an observed 40.3 frames/s for SDF. Camera, resize, and brightness-only flicker reused the mesh maps; movement refreshed both affected maps. GPU probes independently checked hatch/seam depths, through-openings, materials, and front normals at all four greeble counts. Builds and dependency-free tests complement, rather than replace, that browser evidence.

### Access hatch comparison

The left wall has a flush panel with a narrow recessed seam; the right wall has a panel recessed 0.035 units below the wall face, a small screen and three buttons, and an overhead light. Each hatch, the control panel, and the fixture has its own switch. Disabling a hatch restores that wall's uncut surface. These are static box-SDF assemblies, not opening doors or interactive controls.

Each 2 by 2.4 wall and its details is constrained to an explicit local envelope (X: -1 to 1, Y: 0 to 2.4, Z: -0.07 to 0.27). Module centers sit at X = -1.3 and +1.3. The enclosing march sphere is radius 3 around (0, 1.2, 0). Material IDs travel with the nearest distance field so panel, control, and lamp colors follow actual geometry rather than position guesses.

**Make light strip luminous** controls the fixture's emissive appearance independently of **Illuminate surfaces from overhead light**. The latter adds a warm, downward-facing point-source approximation with distance falloff and optional SDF visibility limited to the source distance. It is not a sampled rectangular area light, bloom, or bounce lighting. Removing the fixture also removes its illumination. Normal-based lighting gates local illumination; emission remains visible without it. The soft-shadow switch and light-size slider affect both directional and local visibility. Control colors are ordinary surface materials, not additional lights.

The fixture is omitted only from its own downward light's visibility field, preventing emissive self-shadowing and penumbra bands. It remains visible, participates in surface normals and ambient occlusion, and casts directional shadows. Local visibility uses up to 64 smaller adaptive steps; the directional approximation retains its 24-step budget.

**Play moving lamp** animates the fixture and its point source together in a sinusoidal sideways sweep of +/-0.32 units inside the existing envelope. Speed ranges from 0.05 to 1 cycles per second. Pause freezes the current position; resuming continues from it. The other parts and main directional light remain stationary. The ray-marched baseline retains its existing shadow rays; the matching mesh mode uses refreshed depth maps. Neither mode uses reprojection or sampled area-light integration.

The readout measures animation frame cadence (frames/s and mean frame interval), not GPU execution time. Compare the same viewport and camera with shadows, AO, or normals toggled; cadence can be refresh-rate limited, so it does not establish GPU headroom. Continuous rendering stops when neither movement nor visible flicker is active, in triangle mode, with the fixture removed, or while the page is hidden. Motion does not catch up after suspension. Animation state and speed survive mode switches and graphics retries; page reload resets them.

**Main directional light on** and **Overhead hatch light on** independently enable the two sources. Switching off the overhead source removes both emission and local illumination, but keeps its fixture and the separate stage settings. Ambient fill, AO, and view-rim shading remain; **Normal-based lighting** still selects the existing unlit diagnostic view.

**Artistic overhead flicker** uses two smoothly interpolated deterministic pseudo-random signals, evaluated once per frame on the CPU. Brightness stays between 70% and 100%, with a mathematical rate bound below 0.30 brightness units per second: no abrupt pulses, blackout, or strobing. The same multiplier affects strip emission and local illumination, without additional shadow rays or shader compilation. Flicker continues with movement paused; its clock freezes when disabled, hidden, or unable to affect visible light. These controls retain their values across renderer-mode switches and graphics retries, and reset on reload.

The construction model remains independent of WebGPU resources. The scene and renderer are intentionally copied into this sandbox so rendering experiments can evolve without changing the construction workbench.

## Shader steps and live editing

The controls sit beside a sticky viewport on tablet-landscape and wider screens, with their own scroll area so the scene stays visible while tuning lights. Lights, animation, and shading-cost switches are grouped and expanded; geometry/debugging and emission-stage controls are collapsible. Construction tools start collapsed in reference mode, and the unrelated wall inspector is hidden there. On narrow screens the viewport appears first, followed by controls. The live WGSL editor starts collapsed, with compilation status always visible; expand it to edit or reset the source. Checkboxes and sliders have larger touch targets.

The **Shader steps** controls are specific to the selected renderer. Triangle mode retains its lighting, frame, slots, edge-smoothing, and fake-depth switches. Ray-marched mode can visualize camera-ray directions, skip the SDF march, toggle opening subtraction, frame, and slats, skip numerical normal estimation, and enable or disable lighting, SDF soft shadows, and ambient occlusion.

The floor always uses its analytic upward normal. **Estimate surface normals** applies only to the SDF walls and details; disabling it uses camera-facing normals for those surfaces. Floor hits are identified explicitly, rather than inferred from height.

In ray-marched mode, **Approximate light size** adjusts shadow softness without recompiling the shader. Zero uses hard occlusion; larger values widen the approximate soft edge. The default, 0.125, preserves the original shadow formula. This is a dimensionless angular-size approximation using one shadow ray, not a physical area light or multi-ray sampling. It has no effect with soft shadows or lighting disabled. The value survives mode switches and graphics retries, but resets on page reload.

Main-light shadow rays are skipped when the unshadowed direct contribution is below 0.05 (including back-facing surfaces). That faint contribution is retained unshadowed; the cutoff is an intentional quality/cost tradeoff and may introduce a small transition as surface orientation changes. Main shadows multiply only direct lighting, not the 0.34 ambient fill; AO still applies separately. Both lights' shadow traces also return immediately when approximate visibility reaches the existing 0.18 minimum, because further samples cannot change the clamped result. Hard-hit shadows retain the same minimum. These constants and the named `mainLightContribution` step are editable in the WGSL source.

The **Live WGSL shader** editor switches between [`wwwroot/shaders/procedural-vent-grill.wgsl`](wwwroot/shaders/procedural-vent-grill.wgsl), [`wwwroot/shaders/raymarched-vent-wall.wgsl`](wwwroot/shaders/raymarched-vent-wall.wgsl), and the latter's shared shading combined with [`wwwroot/shaders/reference-mesh.wgsl`](wwwroot/shaders/reference-mesh.wgsl). Each file groups utility functions, named steps, and its shader entry point. Edits compile after a short pause; errors are reported while the last working shader remains active. **Reset to file** restores the selected renderer's checked-in source. The plain-text editor has no syntax highlighting, and edits are discarded when the page reloads.

## Other ideas to explore

These are unscheduled options, not requirements or a fixed sequence. We can add, reorder, combine, or drop them as we learn:

- Inspecting the generated light-space depth maps and their filtering/bias artifacts.
- Instanced repeated geometry compared with the current expanded triangle geometry.
- SDF/domain repetition compared with explicit geometry.
- Runtime-generated textures or cached fields.
- Impostors and aggregate geometry/LOD for repeated detail.

## Baseline

The triangle mode expands scene boxes into triangle geometry and applies simple directional diffuse shading. The ray-marched mode draws its reference walls with one fullscreen triangle and computes surface hits from the SDF; it does not generate a mesh or add physical construction geometry.

## Run locally

Requires the .NET 10 SDK and a browser with WebGPU support. This sandbox uses HTTP port `5291` (HTTPS `7110`), distinct from the Construction Grammar Sandbox on HTTP `5290` (HTTPS `7109`), so both can run concurrently. VS Code Remote is configured to forward both HTTP ports. From the repository root:

```sh
dotnet run --project sandboxes/rendering-playground/RenderingPlayground.csproj
```

WebGPU requires a secure context, such as `localhost` or HTTPS. Plain HTTP at a LAN IP is not a secure context.

## Validate

Run the sandbox's dependency-free JavaScript tests and .NET build from the repository root:

```sh
node --experimental-default-type=module --test sandboxes/rendering-playground/tests/*.test.mjs
dotnet build sandboxes/rendering-playground/RenderingPlayground.csproj --configuration Release
```

The renderer diagnostics tests simulate failure modes; they do not establish that every browser or device has been tested. See the [rendering-reuse research notes](../../research/gpu-procedural-reuse/README.md) for the current questions and non-decisions.
