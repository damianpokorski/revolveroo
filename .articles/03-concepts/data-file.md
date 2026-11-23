---
title: The data file
description: How Revolveroo stores its state in one YAML file, and how to edit it by hand.
sidebar:
  order: 1
---

Revolveroo has no database. All state (tabs, displays, time windows and settings) lives in one YAML file. In the Docker image that is `/data/revolver.yaml`, inside the `revolveroo-data` volume. The `DATA_FILE` environment variable overrides the path.

## Created on first boot

If the file does not exist, Revolveroo creates it with example data. Every field has a default, so a new setting introduced in a later release picks up its default on the next boot. There is no migration step.

## Edit it by hand

You can edit the file while the app is running.

- **Hot reload.** The server watches the file and applies changes, then pushes them to open kiosks and the settings page over the same live connection the UI uses.
- **Comments survive.** Comments you add are kept when the UI later saves a change.
- **Bad entries are skipped.** If a hand-edit leaves one entry invalid, such as a typo or a missing field, that entry is skipped or falls back to its last good value. The rest of the file still loads.
- **Writes are atomic.** The app writes to a temporary file and renames it, so a crash mid-save cannot leave a half-written file.

See the [data file schema](/revolveroo/reference/data-file-schema/) for every field.

## Upgrading an old file

A data file from before the Display and time window model is migrated automatically on first boot after upgrading:

- every distinct query-param value in use becomes a Display
- day-of-week selections move from time ranges onto the tabs that reference them
- `hiddenFromLoop` becomes its inverse, `inLoop`

## Back it up

Copy the file, or snapshot the volume. There is nothing else to back up.
