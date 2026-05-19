#!/usr/bin/env node
// Post-codegen fix: overwrite api-zod index to only export Zod schemas.
// This avoids TS2308 conflicts between Zod value exports and TypeScript
// interface exports that orval generates with the same names.
const fs = require("fs");
const path = require("path");
const indexPath = path.resolve(__dirname, "../../lib/api-zod/src/index.ts");
fs.writeFileSync(indexPath, 'export * from "./generated/api";\n');
console.log("Fixed api-zod index.ts");
