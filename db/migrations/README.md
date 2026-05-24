# Database Migrations

The Java API currently runs Flyway migrations from `backend-java/src/main/resources/db/migration`.

Keep cross-service database notes here until the schema is split into shared migration packages.

Current baseline:

- `V1__init_schema.sql`: users, providers, agents, sessions, messages, code blocks, project files.
- `V2__add_task_and_review_tables.sql`: task plans, code reviews and patches, deployments, and project file soft-delete/content alignment.
- `V3__audit_preview_and_constraints.sql`: effective member uniqueness, previews, agent runs, trace events, and verification reports.
