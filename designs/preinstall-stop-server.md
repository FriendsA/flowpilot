# Preinstall Script: Stop Server Before Update

## Problem

When updating flowpilot using `npm install`, the server daemon may be running with the old version of the code. This can cause issues:

1. The old server continues running even after files are replaced
2. Port 8787 may remain occupied
3. User may think they're using the new version but the old server is still running

## Current Flow

```bash
npm install -g flowpilot
  ↓
preinstall: (doesn't exist)
  ↓
npm replaces files
  ↓
postinstall: node dist/cli.js serve
  ↓
New server starts (but old might still be running on port 8787)
```

## Proposed Solution

Add a `preinstall` script that stops the server before npm replaces files:

```json
{
  "scripts": {
    "preinstall": "node -e \"const{execSync}=require('child_process');try{execSync('node ./dist/cli.js stop',{stdio:'ignore'})}catch(e){}\"",
    "postinstall": "node dist/cli.js serve"
  }
}
```

### Why this approach

1. **Node inline script**: Works on both Windows and Unix
2. **Try-catch**: Gracefully fails if server isn't running or this is first install
3. **stdio: 'ignore'**: Suppresses errors silently (user doesn't need to see "no server running" messages)

## How it works

```
npm install -g flowpilot
  ↓
preinstall: node -e "try { execSync('node ./dist/cli.js stop') } catch(e) {}"
  ↓ (quietly stops old server if running, fails silently if not)
npm replaces files with new version
  ↓
postinstall: node dist/cli.js serve
  ↓
New server starts with new code
```

## Edge Cases

1. **First install**: `dist/cli.js` doesn't exist yet → preinstall fails silently ✓
2. **No server running**: `flowpilot stop` returns error → caught and ignored ✓
3. **Server running as root**: Requires sudo, but preinstall runs in user context → fails silently (acceptable) ✓

## Testing

```bash
# Test preinstall script (simulate first install)
node -e "const{execSync}=require('child_process');try{execSync('node ./dist/cli.js stop',{stdio:'ignore'})}catch(e){console.log('Failed (expected):', e.message)}"

# Test with server running
node dist/cli.js serve
npm install -g flowpilot
# Should cleanly stop old server and start new one
```

## Implementation

Add to `package.json`:

```json
{
  "scripts": {
    "preinstall": "node -e \"const{execSync}=require('child_process');try{execSync('node ./dist/cli.js stop',{stdio:'ignore'})}catch(e){}\"",
    "postinstall": "node dist/cli.js serve"
  }
}
```
