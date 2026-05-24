# Database Migrations

The Java API currently runs Flyway migrations from `backend-java/src/main/resources/db/migration`.

Keep cross-service database notes here until the schema is split into shared migration packages.

Current baseline:

- `V1__init_schema.sql`: users, providers, agents, sessions, messages, code blocks, project files.
- `V2__baseline_support_tables.sql`: member uniqueness, project file alignment, task plans, code reviews and patches, previews, deployments, agent runs, trace events, and verification reports.
