# PropertyCare

A React and Supabase-based maintenance reporting system for landlords and tenants.

## Features

- **Tenant Maintenance Reporting**: Tenants can submit maintenance requests with photos, videos, location, and urgency.
- **Landlord Dashboard**: Landlords can view properties they manage and all associated maintenance reports.
- **Role-Based Authentication**: Secure login and signup flows for tenants and landlords using Supabase Auth.
- **Supabase Backend**: Uses Supabase for database (PostgreSQL) and file storage.
- **Responsive UI**: Built with React, Tailwind CSS, and Lucide icons.

## Tech Stack

- **Frontend**: React 18, React Router v6, Tailwind CSS, Lucide React, React Scripts
- **Backend**: Supabase (Auth, Postgres, Storage)
- **Deployment**: Vercel

## Getting Started

1. **Clone the repository**  
   ```bash
   git clone https://github.com/YourUsername/propertycare.git
   cd propertycare
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **Environment Variables**  
   Create a `.env.local` file in the root directory with the following content:  
   ```
   REACT_APP_SUPABASE_URL=<your_supabase_url>
   REACT_APP_SUPABASE_ANON_KEY=<your_supabase_anon_key>
   ```

4. **Run the development server**  
   ```bash
   npm start
   ```
   Open http://localhost:3000 to view the app.

## Deployment to Vercel

1. Push your code to GitHub.
2. In the Vercel dashboard, import the repository.
3. Set the environment variables (`REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`) in the Vercel project settings.
4. Deploy the project. Your app will be live at `https://<your-vercel-domain>.vercel.app`.

## Project Structure

```
propertycare/
├── public/
│   ├── index.html
│   └── logo.png
├── src/
│   ├── components/
│   │   ├── LandingPage.js
│   │   ├── LoginPage.js
│   │   ├── Signup.js
│   │   ├── MaintenanceReporter.js
│   │   ├── LandlordDashboard.js
│   │   └── ProtectedRoute.js
│   ├── App.js
│   ├── index.js
│   ├── index.css
│   ├── App.css
│   └── supabase.js
├── tailwind.config.js
├── package.json
└── README.md
```

## Contributing

Contributions are welcome! Please open issues or submit pull requests.

## License

This project is licensed under the MIT License.
