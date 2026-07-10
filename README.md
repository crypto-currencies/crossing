## Installation

### Prerequisites

Make sure you have the following installed and/or ready to use:

- **[Node.js](https://nodejs.org/en/download)** 20+.
- **npm** (highly recommended) or your preferred package manager. *Please note that installation and setup will vary if you use a different package manager, which we do **not** offer support for!*
- **[Visual Studio Code](https://code.visualstudio.com/)** (recommended) or another code editor.
- **[Git](https://git-scm.com/install/)** is also necessary for developers.

### Cloning and Setup

```
git clone <this-repo-url>
cd crossing
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```
Once installed, go to [this link](http://localhost:3000) to see the app running locally.

## Build scripts & deployment
- **Local:** `npm run build` runs `next build` only — it never touches a database.
- **Vercel:** `npm run vercel-build` runs `prisma migrate deploy && next build`. Vercel picks this up automatically. Keep the Vercel dashboard **Build Command unset/default** (or set it explicitly to `npm run vercel-build`); don't set it to `npm run build`, or migrations won't run on deploy.

## Database safety
- Point your local `.env.local` `DATABASE_URL` at a **dev branch/database**, never production.
- The **production** `DATABASE_URL` lives only in your deployment platform's environment settings — never commit it or place it in a local file. This is what guarantees local work can't affect production data.

## Environment variables
Copy `.env.example` to `.env.local` and fill in the values you need. See the comments in that file for what each variable does and which features degrade gracefully when it's unset.
