---
create-date: 2026-10-16, 01:30:00
type: plan
tags: [loss-landscape, mnist, trajectory, plotting]
status: draft
branch: main
---

# Plot a window of the first training steps so the early loss drop shows

**Status:** Draft 2026-10-16. Nothing is built yet. Matthew chose the defaults in chat the same day.

## Summary

- **PR 1 is a restructure.** The plot script learns whether a sweep file is 1D or 2D from a `mode` key inside the file, not from the end of its name. Old files without the key are not handled.
- **PR 2 changes the image names.** Every plot run writes new images with a timestamp in the name. Nothing is ever replaced.
- **PR 3 adds the window.** A `--max-step` flag keeps only the first training snapshots, centers on the last one, and puts the window in the file name and the plot title.
- **The goal is to see the early drop.** The full run plot hides it. A window of about 600 steps should show it.

## What happens today

- **The sweep script writes one file per run and mode.** The name is the run id plus an ending of `_1d` or `_2d`.
- **The plot script reads the end of the file name to pick the plot.** A file with any other ending is an error.
- **Image names come from the sweep file name.** Plotting the same file twice writes the same paths, so the first picture is lost.
- **Trajectory mode uses every snapshot.** The PCA runs on all 860 snapshots and the center is the last one.
- **The early drop is invisible.** On the saved path, the first 200 steps cover 1.3 percent of its length. The drop happens around steps 200 to 400. Both sit in the flat top band of the contour.
- **The snapshot spacing is a local variable.** It lives in `train.py` and other code would have to guess it.

### The scripts and files as they stand.

- **Three scripts and three kinds of file.** Training writes the snapshots. The sweep script reads them and writes a sweep file. The plot script reads that file and writes images.
- **The file name carries the mode.** The plot script reads it back with a check on the ending, which is the part PR 1 removes.

```box box/today wide
alt: >-
  Three scripts and one files grouping. train.py holds the local snapshot spacing, the snapshot step and
  the snapshot save. compute_surface.py holds load snapshots, PCA, project, grid and save sweep.
  plot.py holds the file name ending check, plot_2d_contour and the image naming. Files holds the snapshot
  file, the sweep file and the image. Arrows run from the snapshot step to the spacing and to the save,
  from the save into the snapshot file, from load snapshots out of that file and through PCA, project and
  grid to save sweep, from save sweep into the sweep file, from the ending check out of the sweep file
  into plot_2d_contour, and from the image naming into the image.
nodes:
  - id: train
    label: train.py
    children:
      - id: spacing_local
        label: snapshot_spacing, a local variable
      - id: snapshot_step
        label: take a snapshot
      - id: save_snaps
        label: save_training_snapshots
  - id: compute
    label: compute_surface.py
    flow: down
    children:
      - id: load_snaps
        label: load_training_snapshots
      - id: pca
        label: PCA on all snapshots
      - id: project
        label: project onto the plane
      - id: grid
        label: 21 by 21 grid
      - id: save_sweep
        label: save the sweep
  - id: plot
    label: plot.py
    flow: down
    children:
      - id: suffix_check
        label: read the file name ending
      - id: draw_2d
        label: plot_2d_contour
      - id: name_png
        label: name the image from the file name
  - id: files
    label: Files
    children:
      - id: snap_file
        label: training_snapshot_vectors.npz
      - id: sweep_file
        label: RUN_2d.npz
      - id: png_file
        label: RUN_2d_loss_contour.png
edges:
  - from: snapshot_step
    to: spacing_local
    label: reads
  - from: snapshot_step
    to: save_snaps
  - from: save_snaps
    to: snap_file
    label: writes
  - from: load_snaps
    to: snap_file
    label: reads
  - from: load_snaps
    to: pca
  - from: pca
    to: project
  - from: project
    to: grid
  - from: grid
    to: save_sweep
  - from: save_sweep
    to: sweep_file
    label: writes
  - from: suffix_check
    to: sweep_file
    label: reads
  - from: suffix_check
    to: draw_2d
  - from: draw_2d
    to: name_png
  - from: name_png
    to: png_file
    label: writes
```

## PR 1: Read the sweep mode from the file

### What changes.

- **The sweep script saves a `mode` key.** The value names the sweep, 1D or 2D, and sits next to the arrays.
- **The plot script opens the file once and branches on that key.** The check on the end of the name is deleted.
- **A file without the key stops with a clear message.** Matthew chose not to handle old files.
- **File names stay as they are.** They are still readable, but nothing parses them.

```box box/pr1 wide
alt: >-
  compute_surface.py holds the 1D save and the 2D save, both amber because they now write a mode key.
  Files holds the 1D and 2D sweep files. plot.py holds main, the file name ending check in red, a new
  mode key read in green, plot_1d and plot_2d_contour. Red arrows run from main to the ending check and
  from the ending check to both plot functions. Green arrows run from main to the mode read, from the
  mode read to both sweep files and from the mode read to both plot functions.
diff:
  add:
    - read_mode
    - main~read_mode
    - read_mode~npz_1d
    - read_mode~npz_2d
    - read_mode~draw_1d
    - read_mode~draw_2d
  del:
    - suffix_check
    - main~suffix_check
    - suffix_check~draw_1d
    - suffix_check~draw_2d
  mod:
    - save_1d
    - save_2d
nodes:
  - id: compute
    label: compute_surface.py
    children:
      - id: save_1d
        label: save the 1D sweep
      - id: save_2d
        label: save the 2D sweep
  - id: files
    label: Sweep files
    children:
      - id: npz_1d
        label: RUN_1d.npz
      - id: npz_2d
        label: RUN_2d.npz
  - id: plot
    label: plot.py
    flow: down
    children:
      - id: main
        label: main
      - id: suffix_check
        label: read the file name ending
      - id: read_mode
        label: read the mode key
      - id: draw_1d
        label: plot_1d
      - id: draw_2d
        label: plot_2d_contour
edges:
  - from: save_1d
    to: npz_1d
    label: writes
  - from: save_2d
    to: npz_2d
    label: writes
  - from: main
    to: suffix_check
  - from: main
    to: read_mode
  - from: suffix_check
    to: draw_1d
  - from: suffix_check
    to: draw_2d
  - from: read_mode
    to: npz_1d
    label: reads
  - from: read_mode
    to: npz_2d
    label: reads
  - from: read_mode
    to: draw_1d
  - from: read_mode
    to: draw_2d
```

### PR description.

```md
Read the sweep mode from the file instead of its name

## Problem: the plot script parses file names
- The plot script picks 1D or 2D by checking if the file name ends in `_1d` or `_2d`.
- A renamed file breaks it, and the window files in PR 3 would have to keep an ending the check accepts.

## Solution: store the mode in the file
- The sweep script saves a `mode` key, `1d` or `2d`, next to the arrays.
- The plot script opens the file once and branches on that key.
- A file without the key fails with a clear message. Old files are not handled.
```

### Files.

| File | Change |
|---|---|
| `compute_surface.py` | Both saves add the `mode` key. |
| `plot.py` | Open the file once and read `mode`. Replace the file name error with a missing key error. Fix the help text for the file argument. |

### Tests and rollout.

- **Run the 1D sweep and plot it.** It takes about 20 seconds and the picture should match the earlier one.
- **Plot an old file on purpose.** It should stop with the missing key message.
- **Run the existing tests.** None of them touch plotting, so they stay green.
- **Old files are regenerated, not patched.** A 1D sweep takes about 20 seconds and a 2D sweep takes about 4 minutes. Matthew, 2026-10-16.

## PR 2: Name every image with a timestamp

### What changes.

- **The plot script makes one timestamp when it starts.** The format is year, month, day, a dash, then hour, minute, second.
- **Every image name ends with that stamp.** The loss and accuracy images from one run share it.
- **There is no overwrite flag and no existence check.** Each run writes new files, so nothing is lost.

```box box/pr2 wide
alt: >-
  plot.py holds main, a new timestamp step in green, plot_1d and plot_2d_contour. Images holds the 1D image
  and the 2D image, both amber because their names now end in a stamp. A green arrow runs from main to
  the timestamp step. The arrows from each plot function to its image are amber.
diff:
  add:
    - make_stamp
    - main~make_stamp
  mod:
    - png_1d
    - png_2d
    - draw_1d~png_1d
    - draw_2d~png_2d
nodes:
  - id: plot
    label: plot.py
    children:
      - id: main
        label: main
      - id: make_stamp
        label: make one timestamp
      - id: draw_1d
        label: plot_1d
      - id: draw_2d
        label: plot_2d_contour
  - id: images
    label: Images
    children:
      - id: png_1d
        label: RUN_1d_STAMP.png
      - id: png_2d
        label: RUN_2d_loss_contour_STAMP.png
edges:
  - from: main
    to: make_stamp
  - from: main
    to: draw_1d
  - from: main
    to: draw_2d
  - from: draw_1d
    to: png_1d
    label: writes
  - from: draw_2d
    to: png_2d
    label: writes
```

### PR description.

```md
Write plot images with a timestamp so they are never replaced

## Problem: replotting overwrites the last image
- Image names come from the sweep file name, so plotting the same file twice writes the same paths.
- Trying a plot change loses the picture it is compared against.

## Solution: add one timestamp per plot run
- The plot script makes one timestamp when it starts and puts it at the end of every image name.
- The loss and accuracy images from one run share the stamp.
- There is no overwrite flag and no existence check.
```

### Files.

| File | Change |
|---|---|
| `plot.py` | Make the stamp once. Use it in the 1D and 2D image names. |

### Tests and rollout.

- **Plot the same file twice.** There should be two sets of images and the pair in each set shares a stamp.
- **Old images keep their names.** Only new runs get the stamp.
- **The images folder is ignored by git.** Extra files cost nothing in the repo.

## PR 3: Plot a window of the first training steps

### What changes.

- **`SNAPSHOT_SPACING` becomes a shared constant.** Training uses it to decide when to snapshot and the sweep script uses it to turn steps into rows.
- **`--max-step` keeps the first rows of the snapshot matrix.** Each row is one snapshot, so the step limit divided by the spacing gives the row count.
- **The PCA, the projection and the grid range all use the window.** The center is the last snapshot in the window.
- **The sweep file carries the window.** The name gains a `first` tag and the file stores the last step used, only when the flag is passed.
- **The plot title says which window it shows.** The key is read if it is there.

```box box/pr3 wide
alt: >-
  train.py holds a new shared spacing constant in green and the snapshot step in amber. Checkpoints holds the
  snapshot file. compute_surface.py holds load snapshots, a new window slice in green, then PCA, project,
  grid range and save sweep, all amber. Sweep files holds a new window sweep file in green. plot.py holds
  plot_2d_contour in amber because its title shows the window. Green arrows run from the snapshot step and
  from the window slice to the spacing constant, from load snapshots to the window slice, from the slice to PCA,
  from save sweep to the window file and from plot_2d_contour to the window file. The old arrow from load
  snapshots straight to PCA is red.
diff:
  add:
    - spacing
    - slice_window
    - npz_window
    - snapshot_step~spacing
    - slice_window~spacing
    - load_snaps~slice_window
    - slice_window~pca
    - save_sweep~npz_window
    - draw_2d~npz_window
  del:
    - load_snaps~pca
  mod:
    - snapshot_step
    - pca
    - project
    - grid
    - save_sweep
    - draw_2d
nodes:
  - id: train
    label: train.py
    children:
      - id: spacing
        label: SNAPSHOT_SPACING
      - id: snapshot_step
        label: take a snapshot
  - id: checkpoints
    label: Checkpoints
    children:
      - id: snap_file
        label: training_snapshot_vectors.npz
  - id: compute
    label: compute_surface.py
    flow: down
    children:
      - id: load_snaps
        label: load_training_snapshots
      - id: slice_window
        label: keep the first rows
      - id: pca
        label: PCA on the window
      - id: project
        label: project onto the plane
      - id: grid
        label: grid range from the window path
      - id: save_sweep
        label: save the sweep
  - id: files
    label: Sweep files
    children:
      - id: npz_window
        label: RUN_first600_2d.npz
  - id: plot
    label: plot.py
    children:
      - id: draw_2d
        label: plot_2d_contour
edges:
  - from: snapshot_step
    to: spacing
    label: reads
  - from: load_snaps
    to: snap_file
    label: reads
  - from: load_snaps
    to: pca
  - from: load_snaps
    to: slice_window
  - from: slice_window
    to: spacing
    label: reads
  - from: slice_window
    to: pca
  - from: pca
    to: project
  - from: project
    to: grid
  - from: grid
    to: save_sweep
  - from: save_sweep
    to: npz_window
    label: writes
  - from: draw_2d
    to: npz_window
    label: reads
```

### PR description.

```md
Add --max-step to plot a window of the first training steps

## Problem: the early drop is hidden
- The plane is built from all 860 snapshots, so the whole run dominates it.
- The first 200 steps barely move and the drop at steps 200 to 400 sits in the flat top band.

## Solution: slice the snapshots before the PCA
- `--max-step N` keeps the snapshots up to step `N`.
- The spacing becomes the shared constant `SNAPSHOT_SPACING`.
- The center is the last snapshot in the window.
- The sweep file name carries the window and the file stores the last step used.
- The plot title says which window it shows.
```

### Files.

| File | Change |
|---|---|
| `train.py` | Add `SNAPSHOT_SPACING`. Use it for the snapshot check. Delete the local variable. |
| `compute_surface.py` | Add the flag and a guard that it needs the trajectory flag. Slice the snapshots. Add the window to the file name. Save `max_step` when the flag is passed. |
| `plot.py` | Show the window in the title when the key is present. |

### Tests and rollout.

- **Keep 60 snapshots with 600 steps.** A value that keeps fewer than three snapshots or more than exist fails with a clear message.
- **Check three things on the first run.** The explained variance of the two directions, whether the path fills the plane, and whether the contours cross the drop.
- **Run without the flag.** The result should match the full run, apart from small noise from the GPU.
- **The sweep takes about 4 minutes.** The `justfile` needs no change because it forwards extra flags.

```sh
just loss-landscape-compute RUN_ID --mode 2d --trajectory-plot --max-step 600
just loss-landscape-plot plots/RUN_ID_first600_2d.npz
```

## Later

- **Marks every 100 steps along the path.** They would show how fast the weights move.
- **A small panel of movement per 100 steps.** It can be computed from the points already in the sweep file.
- **The real loss at each snapshot.** It would color the dots truthfully and give a loss against step panel. It needs one evaluation pass.
- **Save the step numbers with the snapshots.** That removes the assumption about the spacing.
- **An interactive version.** A Plotly figure with a slider, or path values logged to wandb as time series.

## Out of scope

- **No rings on the path in these PRs.** Matthew, 2026-10-16.
- **No change to the random direction sweeps.** They still use the validation set and the best checkpoint.
- **No versioning of the sweep file when it is recomputed.** A plain rerun with the same options replaces it.

## Decisions

- **The first window is 600 steps.** Matthew, 2026-10-16.
- **The center is the last snapshot in the window.** Matthew, 2026-10-16.
- **No rings for now.** Matthew, 2026-10-16.
- **Images get a timestamp and there is no overwrite flag.** Matthew, 2026-10-16.
- **The sweep mode comes from a key and old files are not handled.** Matthew, 2026-10-16.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Retrain for fewer epochs | The smallest run is one epoch of 860 steps. The seeded early weights are the same, so slicing the saved snapshots gives the same result without a training run. |
| A window of the first 100 steps | The weights barely move before step 200, so the plot would show one cluster and no drop. |
| A numbered suffix on image names | A timestamp never collides and sorts by time. |
| An overwrite flag | It brings back the thing PR 2 removes. |
| Guess the mode from which keys exist | It only exists to support old files, which are not handled. |

## Open items

- **Confirm that `max_step` is saved only when the flag is passed.** The other option is to save it always, which makes full run titles say first 8600 steps.
- **Pick the branch names.** All three PRs are planned against `main` for now.
- **Tune the window after the first look.** 600 steps is the starting guess.
- **Only one run has snapshots.** Any other run needs a retrain first, which takes about 84 seconds.
