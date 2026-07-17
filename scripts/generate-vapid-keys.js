// Run with: npm run generate-vapid
// Prints a public/private VAPID key pair. Copy these into your Vercel
// project's environment variables (see README.md).
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();

console.log("\nAdd these to your Vercel project's Environment Variables:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("\nAlso set:");
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log("CRON_SECRET=<any random long string you make up>\n");
