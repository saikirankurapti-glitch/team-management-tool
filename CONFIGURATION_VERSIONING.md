# Configuration Versioning Specifications (`ConfigurationVersion`)

## Configuration Change Auditing
Every policy update, workflow revision, or custom field change records an incremental `version` snapshot storing the JSON state, actor (`changedById`), and timestamp.
