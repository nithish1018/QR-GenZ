# QR-Gen

A React + TypeScript QR code generator app styled with Tailwind CSS.

## Features

- Form for name, designation, email, phone, location, notes, and custom fields
- QR payload is plain readable text (not JSON and not vCard)
- QR center logo upload with improved upload card UI
- Download generated QR image as PNG
- Generate and download a details card image as PNG

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes

- QR scanners decode text or links. This app encodes readable text directly for offline use.
- A separate details image is generated and downloadable for visual sharing.
