# Security

## MongoDB Connection String

The MongoDB connection string (`MONGODB_URI`) is **never exposed to users** or sent to the browser.

### How it's protected

1. **Server-side only**  
   Environment variables are only available in Node.js on the server. Next.js does not expose `process.env` to client-side JavaScript unless the variable is prefixed with `NEXT_PUBLIC_`.

2. **Not in the bundle**  
   `MONGODB_URI` is not prefixed with `NEXT_PUBLIC_`, so it never appears in the client bundle. Only API routes and server-side code can access it.

3. **Not in version control**  
   `.env` and `.env.local` are listed in `.gitignore`, so credentials are not committed to the repository.

4. **Where it runs**  
   The MongoDB driver connects from your server (or Vercel/serverless function) directly to MongoDB Atlas. The connection string is only used in server-side code (`src/lib/db.ts`, API routes).

### Best practices

- Use `.env.example` as a template; never put real credentials in it.
- In production, set `MONGODB_URI` in your hosting provider’s environment (e.g. Vercel, Railway).
- Use MongoDB Atlas IP access list and strong database user passwords.
