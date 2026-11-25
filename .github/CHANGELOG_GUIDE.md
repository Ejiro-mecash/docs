# API changelog guide

Every API change needs an entry in `release-notes-api.mdx` before it ships. The page's RSS feed (`https://docs.me-cash.com/release-notes-api/rss.xml`) sends each new entry to subscribers, so publishing the entry is how customers find out.

Add new entries at the top of the `## API Platform` section, newest first. Add to an existing month's entry if one is already there.

## Entry template

```mdx
<Update label="Month YYYY" description="Version v1.x · Status: Live">
  **What changed**

  - **Short name**: One or two sentences on what changed, naming the endpoint, field or enum value in `code`.

  **Action needed:** What integrators must do, or "None. This change is backward compatible."
</Update>
```

For a breaking change, add the tag and a deadline:

```mdx
<Update label="Month YYYY" description="Version v1.x · Status: Live" tags={["Breaking"]}>
  **What changed**

  - **Short name**: What changed and which endpoints or fields are affected.

  **Action needed:** Exactly what integrators must change, with a before and after example if it helps.

  **Deadline:** The date the old behavior stops working (for example, 15 January 2027).
</Update>
```

- `Status` is `Live` or `Rolling out`.
- Only use the `Breaking` tag when existing integrations will fail or behave differently without changes: removed or renamed fields, endpoints or enum values, new required fields, or changed response shapes or validation.

## Breaking-change checklist

1. Announce it at least 6 months before the old behavior stops working, as a changelog entry with status `Rolling out` and a **Deadline**. This is the notice period the public [versioning policy](../api-reference/versioning.mdx) promises.
2. Email affected API customers directly. The RSS email isn't enough on its own.
3. Turn on the docs banner (below) until the deadline passes.
4. Ask engineering to return `Deprecation` and `Sunset` HTTP headers on affected endpoints.
5. Once it's live, update the entry's status to `Live` and remove the banner.

## Docs banner

Mintlify shows a site-wide banner whenever `banner` exists in `docs.json`. There's no on/off switch, so add this at the top level of `docs.json` to turn it on and delete it to turn it off:

```json
"banner": {
  "content": "**Breaking change:** `SWIFT` is being replaced by `SWIFT_OUR`, `SWIFT_SHARED` and `SWIFT_BENEFICIARY` on 15 January 2027. [See what to change](/release-notes-api)",
  "dismissible": true
}
```

Replace the example text with the actual change and deadline.
