# Wings Institution LMS - Stage 0 + 1 (Sign up, Login, Roles)

## 1. Database (Supabase)
1. Supabase dashboard -> SQL Editor -> paste `database/01_profiles_and_roles.sql` -> Run.
2. Authentication -> Providers -> Email: for quick testing you may turn OFF "Confirm email".
3. Authentication -> URL Configuration: Site URL = http://localhost:5173

## 2. Frontend
    cd frontend
    cp .env.example .env      (Windows: copy .env.example .env)
    # edit .env: paste Project URL + anon public key (Project Settings -> API)
    npm install
    npm run dev               -> http://localhost:5173

## 3. Backend
    cd backend
    python -m venv venv
    venv\Scripts\activate     (Mac/Linux: source venv/bin/activate)
    pip install -r requirements.txt
    uvicorn main:app --reload -> http://localhost:8000/health

## 4. Make yourself admin
Sign up on the site with your email, then run `database/02_make_admin.sql` (edit the email).
