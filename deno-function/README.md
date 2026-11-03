# Classcastle Maintenance API

A simple Deno function that provides maintenance mode status for Classcastle.

## Usage

Run with Deno:
```bash
deno run --allow-net src/main.ts
```

Or use the task:
```bash
deno task serve
```

## API Response

```json
{
  "maintenance": false,
  "message": "Classcastle is operational",
  "timestamp": "2026-10-13T12:00:00.000Z"
}
```

## Configuration

To enable maintenance mode, change `maintenance: false` to `maintenance: true` in src/main.ts.
