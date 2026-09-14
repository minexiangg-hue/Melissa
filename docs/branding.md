# Melissa naming and upgrade compatibility

Use **Melissa** for the product name and `melissa` for package names and product-specific identifiers. The existing local directory remains `YourEnglishTeacher`; do not rename it or change references to that real path. The GitHub repository is [Melissa](https://github.com/minexiangg-hue/Melissa).

The page title, navigation brand, accessible home link, npm package metadata, concept documents, and downloaded practice export use the Melissa name. Exports are named `melissa-data.json`; the exported data structure is unchanged.

Existing installations keep their configured database path, including the default `.data/teacher.db`. This is a teaching-data filename, and retaining it preserves existing learner records without a file migration. Domain roles such as `TeacherProvider`, `GuardProvider`, and the orchestrator describe responsibilities and remain unchanged.

New guest credentials use the `melissa_guest` cookie. The server accepts the legacy `yet_guest` cookie during upgrades and migrates a valid existing guest to the new name while retaining that guest's stored data and original expiry. Keep the legacy identifier only in this compatibility path, its regression checks, and upgrade documentation. Browser cookies remain scoped to their original host; changing the preview hostname does not transfer a guest session to another host.
