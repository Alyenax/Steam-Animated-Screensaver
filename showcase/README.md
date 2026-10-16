# Demo page

The final MP4 is attached to the private development release and linked from the root README. The video and illustrated documentation can also be reviewed locally:

```sh
node scripts/showcase-preview.cjs
```

Open the printed localhost URL. This maintainer preview reads the actual README and changelog and serves the local final video; it does not expose app data or credentials.

To prepare a self-contained static folder for later hosting:

```sh
node scripts/showcase-preview.cjs --export
```

Output: `dist/showcase-site`. It includes the video, images, rendered README and changelog. Upload that folder to the chosen static host only when the public launch is approved. No hosting account, public GitHub Pages site or background workflow is created by this preparation.
