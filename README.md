# BiliBili Video Embed

## Installation

To install dependencies, run:

```bash
bun install
```

---

## Execution Methods

### Method 1: Run the Main Program (Not Recommended)
To execute the program, use:

```bash
bun run index.ts
```

---

### Method 2: Linux-Specific Execution (Not Recommended)
For Linux environments (tested on Ubuntu server), use:

```bash
bun run linux.ts
```

**Note**: This method supports streaming but is unstable and contains bugs. Avoid using it unless necessary.

---

### Method 3: Cloudflare Worker Integration
Modify the `cfTest` setting in `./src/index.ts`:
- Set to `false` for local caching of video downloads before transmission.
- Set to `true` to use Cloudflare Worker as the video transmission medium.

Recommended to use with [bilibili-downloader-cloudflare-worker](https://github.com/Pikacnu/bilibili-downloder-cloudflare-worker/tree/master).  
**Note**: This method is recommended for short videos. Long videos may not work due to unknown issues.

---

### Method 4: Direct Response Transmission
Use the `./src/direct_send_to_response` script to directly transmit the `durl` as a response to the requester.
**Note**: This method is recommended for short videos.

---

### Method 5: High-Quality Video Setup
1. Run `./src/cookie.ts` to generate a QR Code and save the Cookie to the project directory.  
  (Open the link or scan the QR Code with your phone to activate it.)
2. Run `./src/refresh_cookie.ts` to refresh the saved Cookie.  
  **Note**: Automatic cookie refresh during runtime is not implemented, so manual refresh is required.
