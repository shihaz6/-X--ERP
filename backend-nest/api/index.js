// Vercel entry point. Loads the compiled NestJS app from dist/, which `npm run build` creates during deployment.
module.exports = require('../dist/serverless.js').default;
