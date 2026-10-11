# A350 Study

Local, static study tool for the Airbus A350-900 and A350-1000 as a blueprint assembly. Two variants share one parametric loft, registered on the wing. Sourced figures are labelled. Everything else is schematic.

Independent study tool. Not affiliated with Airbus. Not for maintenance, training, or flight operations.

A number in the UI comes from `formatQuantity`. Do not print a raw float, and do not treat schematic geometry as an OEM dimension.

This repository does not contain Airbus maintenance artwork, the Aircraft Characteristics manual, the AMM, or the IPC. Do not add those documents or any CAD dump.

## Requirements

Node.js 22 or newer, and pnpm 9.

## Commands

```text
pnpm install
pnpm dev        # local dev server, default http://localhost:5173
pnpm test       # vitest and boundary script
pnpm lint
pnpm build      # tsc and vite build -> dist/
pnpm preview    # serves dist/ locally
```

The dev server does not open a browser on its own. Use the URL Vite prints.

There is no account, no telemetry, and no deploy configuration. Citation links are opened by the browser only when you choose them. The app does not fetch those URLs.
