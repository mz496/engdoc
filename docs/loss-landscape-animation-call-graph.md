---
create-date: 2026-10-16, 11:40:46
type: plan
tags: [loss-landscape, animation, architecture, call-graph]
status: draft
branch: main
---

# Add an animation of the training path to the loss landscape code

- **This doc shows which functions call which functions, before and after the animation work.** The first figure is the last commit. The second figure is the working tree.
- **Green is added and amber is changed.** No function is removed, so nothing is red.

**Status:** Draft 2026-10-16. Nothing is committed. The work is in the working tree.

## Summary

- **A new `animate.py` draws the video.** It reads a saved sweep file, reuses the plot pieces, and runs the network through two new modules.
- **Two new modules run the network at each training step.** `snapshot_metrics.py` gets the loss and accuracy of each snapshot. `snapshot_surfaces.py` gets the loss grid around each snapshot.
- **`plot.py` is split, not rewritten.** `plot_2d_contour` now calls smaller pieces that the animation reuses. The static plots come out pixel for pixel the same.
- **`lib.py` gains `plane_base`.** It builds the shifted plane that the surface evaluation uses.
- **A new recipe runs it.** The `justfile` gets `loss-landscape-animate`.

## What happens today

### Three recipes start three programs, and only `plot.py` draws pictures.

- **The compute step builds the sweep file.** `main` in `compute_surface.py` loads the weights, builds the directions, and runs the network over a grid.
- **The plot step reads that file.** `main` in `plot.py` checks the schema version, then calls `draw_1d` or `draw_2d`.
- **One function draws the whole contour plot.** `plot_2d_contour` makes the figure, the contour, the path and the markers in one body. That is why it is amber.
- **There is no animation.**

```box box/before wide
alt: >-
  Groupings left to right: the justfile with two recipes, compute_surface.py with main, plot.py with main, draw_1d, draw_2d,
  plot_1d, plot_2d_contour, plot_2d_surface and sample_grid, lib.py with four functions, file_io_utils.py with two, and other
  modules with evaluate and four loaders. Each recipe calls the main of its program. plot_2d_contour is amber.
diff:
  mod:
    - plot_2d_contour
nodes:
  - id: just
    label: justfile
    children:
      - id: r_compute
        label: loss-landscape-compute
      - id: r_plot
        label: loss-landscape-plot
  - id: cs
    label: compute_surface.py
    children:
      - id: cs_main
        label: main
  - id: plot
    label: plot.py
    children:
      - id: plot_main
        label: main
      - id: draw_1d
        label: draw_1d
      - id: draw_2d
        label: draw_2d
      - id: plot_1d
        label: plot_1d
      - id: plot_2d_contour
        label: plot_2d_contour
      - id: plot_2d_surface
        label: plot_2d_surface
      - id: sample_grid
        label: sample_grid
  - id: lib
    label: lib.py
    children:
      - id: create_dir
        label: create_random_direction
      - id: get_pca
        label: get_pca_directions_for_snapshots
      - id: project
        label: project_snapshots_onto_pca_directions
      - id: unflatten
        label: unflatten_like
  - id: io
    label: file_io_utils.py
    children:
      - id: check_schema
        label: check_schema_version
      - id: read_str
        label: read_str
  - id: other
    label: other modules
    children:
      - id: evaluate
        label: evaluate
      - id: load_snapshots
        label: load_training_snapshots
      - id: load_checkpoint
        label: load_checkpoint
      - id: get_dataloaders
        label: get_dataloaders
      - id: get_device
        label: get_device
edges:
  - from: r_compute
    to: cs_main
  - from: r_plot
    to: plot_main
  - from: cs_main
    to: load_checkpoint
  - from: cs_main
    to: load_snapshots
  - from: cs_main
    to: get_dataloaders
  - from: cs_main
    to: get_device
  - from: cs_main
    to: evaluate
  - from: cs_main
    to: create_dir
  - from: cs_main
    to: get_pca
  - from: cs_main
    to: project
  - from: cs_main
    to: unflatten
  - from: plot_main
    to: check_schema
  - from: plot_main
    to: read_str
  - from: plot_main
    to: draw_1d
  - from: plot_main
    to: draw_2d
  - from: draw_1d
    to: read_str
  - from: draw_1d
    to: plot_1d
  - from: draw_2d
    to: read_str
  - from: draw_2d
    to: plot_2d_contour
  - from: draw_2d
    to: plot_2d_surface
  - from: draw_2d
    to: sample_grid
```

## After

### The animation reuses the plot pieces and runs the network in two new places.

- **`main` in `animate.py` runs three steps.** It loads the sweep, evaluates the network, then previews or renders the video.
- **The two evaluation modules both read the training snapshots.** `evaluate_snapshots` uses the existing `evaluate`. `evaluate_surfaces` sends the whole data set through the network at once for each grid point, so it does not call `evaluate`.
- **`build_scene` reuses the plot pieces.** It calls the new background and overlay functions, so a frame looks like the static plot.
- **`set_frame` is the one function that changes between frames.** It redraws the contour and updates the dots and the label. Preview, render and the checks all go through it.
- **The preview checks call `plot_2d_contour` once.** They compare the last frame with the static plot when the contour is frozen.

```box box/after wide
alt: >-
  The same groupings plus three new green ones: animate.py, snapshot_metrics.py and snapshot_surfaces.py. A new recipe calls
  main in animate.py, which calls load_sweep, build_scene, the two evaluation functions, run_preview and render_video. In plot.py,
  three new green functions are called by build_scene and by plot_2d_contour, which is amber. lib.py gains plane_base.
diff:
  add:
    - animate
    - metrics
    - surfaces
    - r_animate
    - contour_levels
    - draw_background
    - draw_overlay
    - plane_base
    - r_animate~an_main
    - an_main~load_sweep
    - an_main~eval_snapshots
    - an_main~eval_surfaces
    - an_main~frame_counts
    - an_main~build_scene
    - an_main~run_preview
    - an_main~render_video
    - load_sweep~check_schema
    - load_sweep~read_str
    - build_scene~contour_levels
    - build_scene~draw_background
    - build_scene~draw_overlay
    - build_scene~sample_grid
    - build_scene~set_frame
    - set_frame~draw_contour
    - set_frame~frame_label
    - render_video~set_frame
    - run_preview~read_state
    - run_preview~check_states
    - run_preview~check_images
    - run_preview~set_frame
    - read_state~set_frame
    - check_states~contour_levels
    - check_states~sample_grid
    - check_images~bg_pixels
    - check_images~set_frame
    - check_images~plot_2d_contour
    - bg_pixels~set_frame
    - eval_snapshots~get_dataloaders
    - eval_snapshots~evaluate
    - eval_snapshots~load_snapshots
    - eval_snapshots~get_device
    - eval_surfaces~get_pca
    - eval_surfaces~plane_base
    - eval_surfaces~direction_error
    - eval_surfaces~load_eval
    - eval_surfaces~load_snapshots
    - eval_surfaces~get_device
    - direction_error~project
    - load_eval~get_dataloaders
    - plot_2d_contour~draw_background
    - plot_2d_contour~draw_overlay
    - draw_background~contour_levels
  mod:
    - plot_2d_contour
nodes:
  - id: just
    label: justfile
    children:
      - id: r_compute
        label: loss-landscape-compute
      - id: r_plot
        label: loss-landscape-plot
      - id: r_animate
        label: loss-landscape-animate
  - id: cs
    label: compute_surface.py
    children:
      - id: cs_main
        label: main
  - id: plot
    label: plot.py
    children:
      - id: plot_main
        label: main
      - id: draw_1d
        label: draw_1d
      - id: draw_2d
        label: draw_2d
      - id: plot_1d
        label: plot_1d
      - id: plot_2d_contour
        label: plot_2d_contour
      - id: plot_2d_surface
        label: plot_2d_surface
      - id: sample_grid
        label: sample_grid
      - id: contour_levels
        label: contour_levels
      - id: draw_background
        label: draw_contour_background
      - id: draw_overlay
        label: draw_trajectory_overlay
  - id: animate
    label: animate.py
    children:
      - id: an_main
        label: main
      - id: load_sweep
        label: load_sweep
      - id: frame_counts
        label: frame_counts
      - id: build_scene
        label: build_scene
      - id: set_frame
        label: set_frame
      - id: draw_contour
        label: draw_contour
      - id: frame_label
        label: frame_label
      - id: render_video
        label: render_video
      - id: run_preview
        label: run_preview
      - id: read_state
        label: read_frame_state
      - id: check_states
        label: check_states
      - id: check_images
        label: check_images
      - id: bg_pixels
        label: background_pixels
  - id: metrics
    label: snapshot_metrics.py
    children:
      - id: eval_snapshots
        label: evaluate_snapshots
  - id: surfaces
    label: snapshot_surfaces.py
    children:
      - id: eval_surfaces
        label: evaluate_surfaces
      - id: direction_error
        label: direction_error
      - id: load_eval
        label: load_eval_tensors
  - id: lib
    label: lib.py
    children:
      - id: create_dir
        label: create_random_direction
      - id: get_pca
        label: get_pca_directions_for_snapshots
      - id: project
        label: project_snapshots_onto_pca_directions
      - id: unflatten
        label: unflatten_like
      - id: plane_base
        label: plane_base
  - id: io
    label: file_io_utils.py
    children:
      - id: check_schema
        label: check_schema_version
      - id: read_str
        label: read_str
  - id: other
    label: other modules
    children:
      - id: evaluate
        label: evaluate
      - id: load_snapshots
        label: load_training_snapshots
      - id: load_checkpoint
        label: load_checkpoint
      - id: get_dataloaders
        label: get_dataloaders
      - id: get_device
        label: get_device
edges:
  - from: r_compute
    to: cs_main
  - from: r_plot
    to: plot_main
  - from: cs_main
    to: load_checkpoint
  - from: cs_main
    to: load_snapshots
  - from: cs_main
    to: get_dataloaders
  - from: cs_main
    to: get_device
  - from: cs_main
    to: evaluate
  - from: cs_main
    to: create_dir
  - from: cs_main
    to: get_pca
  - from: cs_main
    to: project
  - from: cs_main
    to: unflatten
  - from: plot_main
    to: check_schema
  - from: plot_main
    to: read_str
  - from: plot_main
    to: draw_1d
  - from: plot_main
    to: draw_2d
  - from: draw_1d
    to: read_str
  - from: draw_1d
    to: plot_1d
  - from: draw_2d
    to: read_str
  - from: draw_2d
    to: plot_2d_contour
  - from: draw_2d
    to: plot_2d_surface
  - from: draw_2d
    to: sample_grid
  - from: r_animate
    to: an_main
  - from: an_main
    to: load_sweep
  - from: an_main
    to: eval_snapshots
  - from: an_main
    to: eval_surfaces
  - from: an_main
    to: frame_counts
  - from: an_main
    to: build_scene
  - from: an_main
    to: run_preview
  - from: an_main
    to: render_video
  - from: load_sweep
    to: check_schema
  - from: load_sweep
    to: read_str
  - from: build_scene
    to: contour_levels
  - from: build_scene
    to: draw_background
  - from: build_scene
    to: draw_overlay
  - from: build_scene
    to: sample_grid
  - from: build_scene
    to: set_frame
  - from: set_frame
    to: draw_contour
  - from: set_frame
    to: frame_label
  - from: render_video
    to: set_frame
  - from: run_preview
    to: read_state
  - from: run_preview
    to: check_states
  - from: run_preview
    to: check_images
  - from: run_preview
    to: set_frame
  - from: read_state
    to: set_frame
  - from: check_states
    to: contour_levels
  - from: check_states
    to: sample_grid
  - from: check_images
    to: bg_pixels
  - from: check_images
    to: set_frame
  - from: check_images
    to: plot_2d_contour
  - from: bg_pixels
    to: set_frame
  - from: eval_snapshots
    to: get_dataloaders
  - from: eval_snapshots
    to: evaluate
  - from: eval_snapshots
    to: load_snapshots
  - from: eval_snapshots
    to: get_device
  - from: eval_surfaces
    to: get_pca
  - from: eval_surfaces
    to: plane_base
  - from: eval_surfaces
    to: direction_error
  - from: eval_surfaces
    to: load_eval
  - from: eval_surfaces
    to: load_snapshots
  - from: eval_surfaces
    to: get_device
  - from: direction_error
    to: project
  - from: load_eval
    to: get_dataloaders
  - from: plot_2d_contour
    to: draw_background
  - from: plot_2d_contour
    to: draw_overlay
  - from: draw_background
    to: contour_levels
```

## What each mark means

| Box | Mark | What changed |
|---|---|---|
| `animate.py` | added | The new program that draws the video and its preview checks. |
| `snapshot_metrics.py` | added | Runs the network at each training snapshot. |
| `snapshot_surfaces.py` | added | Runs the network on a grid around each snapshot. |
| `contour_levels` | added | Works out the contour levels and colors. Moved out of `plot_2d_contour`. |
| `draw_contour_background` | added | Draws the figure, the contour and the star. Moved out of `plot_2d_contour`. |
| `draw_trajectory_overlay` | added | Draws the path, its colorbar, the markers and the legend. Moved out of `plot_2d_contour`. |
| `plane_base` | added | Shifts the PCA plane so it passes through one snapshot. |
| `loss-landscape-animate` | added | The recipe that runs `main` in `animate.py`. |
| `plot_2d_contour` | changed | Calls the new pieces instead of drawing everything itself. |

## Not shown

- **Small helpers are left out to keep the figures readable.** That covers argument parsing, the title helpers, the number helpers in `animate.py`, the file path helpers and the random direction helpers.
