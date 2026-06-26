# FlowPilot POM Configuration

FlowPilot commands rely on custom fields in your project's `pom.xml` to extract metadata for release management and Jenkins integration.

## Custom Fields

FlowPilot reads custom fields from two locations in `pom.xml`, with the following priority:

### 1. `<flowpilot>` Top-Level Element (Recommended)

```xml
<project>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.2.3</version>
  
  <flowpilot>
    <releaseName>my-service</releaseName>
    <jenkinsJob>my-service-deploy</jenkinsJob>
  </flowpilot>
  
  <!-- other content -->
</project>
```

**Fields:**

| Field | Purpose | Used By |
|-------|---------|---------|
| `<releaseName>` | Human-readable name for releases. Used to generate Jira version names and issue titles. | `release` command |
| `<jenkinsJob>` | Jenkins job name for pipeline monitoring and triggering. | `watch` command |

### 2. `<properties>` Element (Legacy/Compatibility)

```xml
<project>
  <!-- ... -->
  <properties>
    <flowPilotName>my-app</flowPilotName>
    <jenkinsJobName>my-app-deploy</jenkinsJobName>
  </properties>
</project>
```

**Fields:**

| Field | Purpose | Used By |
|-------|---------|---------|
| `<flowPilotName>` | Equivalent to `<releaseName>` in `<flowpilot>` element | `release` command |
| `<jenkinsJobName>` | Equivalent to `<jenkinsJob>` in `<flowpilot>` element | `watch` command |

## Priority Rules

When parsing `pom.xml`, FlowPilot applies the following priority for the release name (`releaseName` / `flowPilotName`):

1. **`<flowpilot>` element** — `<releaseName>` checked first
2. **`<properties>` element** — `<releaseName>` / `<flowPilotName>` fallback if `<flowpilot>` is missing
3. **`<artifactId>`** — the Maven `artifactId` from `pom.xml` (excludes `<parent>`'s `artifactId`)
4. **GitLab project name** — final fallback

The same priority is used to generate the Jira version name and issue summary:

```
releaseName = flowPilotName ?? artifactId ?? projectName
versionName = `${releaseName}-${cleanVersion(version)}`
```

### Example Scenarios

**Scenario 1: Both elements present**
```xml
<flowpilot>
  <releaseName>new-name</releaseName>
</flowpilot>
<properties>
  <flowPilotName>old-name</flowPilotName>
</properties>
```
Result: Uses `new-name` (from `<flowpilot>`)

**Scenario 2: Only `<properties>` present**
```xml
<properties>
  <flowPilotName>my-app</flowPilotName>
</properties>
```
Result: Uses `my-app` (from `<properties>`)

**Scenario 3: No `releaseName`, only `<artifactId>`**
```xml
<project>
  <artifactId>my-service</artifactId>
</project>
```
Result: Uses `my-service` (from `<artifactId>`)

**Scenario 4: No `releaseName` and no `<artifactId>`**
Result: Uses the GitLab project name as final fallback.

## Standard Fields

FlowPilot also reads standard Maven fields:

| Field | Purpose | Used By |
|-------|---------|---------|
| `<version>` | Project version (e.g., `1.2.3-SNAPSHOT`). Automatically strips `-SNAPSHOT`, `-beta`, etc. | All commands |
| `<groupId>` | Maven group ID | Internal use |
| `<artifactId>` | Maven artifact ID. Used as the release name fallback when no `releaseName`/`flowPilotName` is configured. | `release` command (fallback) |

### Version Field Extraction Rules

FlowPilot extracts the `<version>` field from `pom.xml` using regex pattern matching and automatically strips qualifiers (suffixes like `-SNAPSHOT`, `-RC1`, `-beta`, etc.) to derive a clean semantic version.

#### Extraction Logic

1. **Primary source**: `<version>` inside `<project>` (excluding `<parent>` block)
2. **Fallback**: `<version>` inside `<parent>` block (if project has no direct version)

#### Version Format Rules

FlowPilot accepts any Maven version string and extracts the base semantic version using this rule:

```
Input:   <version>MAJOR.MINOR.PATCH[-QUALIFIER]</version>
Output:  MAJOR.MINOR.PATCH
```

**Splitting rule**: Everything before the first hyphen `-` is kept as the base version.

#### Examples

| pom.xml `<version>` | Extracted Version | Notes |
|---------------------|-------------------|-------|
| `1.2.3` | `1.2.3` | No qualifier |
| `1.2.3-SNAPSHOT` | `1.2.3` | Strips `-SNAPSHOT` |
| `2.0.0-RC1` | `2.0.0` | Strips `-RC1` |
| `3.1.4-beta-2` | `3.1.4` | Strips `-beta-2` |
| `0.5.10-20240611.120000-1` | `0.5.10` | Strips timestamp qualifier |
| `1.0.0.Final` | `1.0.0.Final` | No hyphen, keeps full string |
| `1.0` | `1.0` | Two-part version, no stripping |

#### Edge Cases

- **No version tag**: Returns `null`, commands will fail with "version not found"
- **Empty version**: Treated as missing
- **Version with only qualifier**: e.g., `<version>-SNAPSHOT</version>` → extracts empty string (invalid)
- **Parent version fallback**: If project has `<parent><version>2.0.0</version></parent>` but no direct version, uses parent's version

#### Implementation Detail

```typescript
// Simplified extraction logic
function cleanVersion(v: string | null): string {
  return (v ?? "").split("-")[0];
}
```

The `split("-")[0]` operation takes everything before the first hyphen, which is the standard Maven convention for separating base version from qualifier.

#### Why This Approach?

Maven's version scheme is flexible (allows arbitrary qualifiers), but FlowPilot needs a stable, comparable version string for:
- Jira version name generation (e.g., `my-service-1.2.3`)
- Issue summary (e.g., `my-service 1.2.3 release`)
- Version deduplication in Jira

Stripping qualifiers ensures consistent version naming regardless of whether you're working with `SNAPSHOT`, `RC`, or final releases.

## Command-Specific Usage

### `release` Command

**Extracts:**
- `version` → stripped to `X.Y.Z` format
- `releaseName` (or `flowPilotName`) → used as display name; falls back to `<artifactId>`, then GitLab project name

**Generates:**
- Jira version: `{releaseName}-{version}` (e.g., `my-service-1.2.3`)
- Issue title: `{releaseName}-{version} release request`

### `watch` Command

**Extracts:**
- `jenkinsJob` (or `jenkinsJobName`) → Jenkins job identifier

**Usage:**
- Monitors Jenkins build status for the specified job
- Auto-polls every 60 seconds when build is in progress
- Stops polling on user request (no auto-stop on completion)

### `end` / `mr` Commands

**Extracts:**
- `version` → used in MR descriptions and Jira issue linking

## Best Practices

1. **Use `<flowpilot>` element** for new projects — cleaner separation from Maven's `<properties>`
2. **Keep `<properties>` for legacy projects** — no need to refactor existing configs
3. **Avoid naming conflicts** — don't use the same field name in both locations
4. **Version format** — use semantic versioning (`X.Y.Z`) with optional qualifier (`-SNAPSHOT`, `-RC1`, etc.)

## Validation

Run `flowpilot release --dry-run` (if available) or check the Web dashboard to verify your `pom.xml` is parsed correctly before creating releases.
